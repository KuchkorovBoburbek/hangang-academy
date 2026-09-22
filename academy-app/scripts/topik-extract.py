#!/usr/bin/env python3
"""Render and OCR local TOPIK reading/answer-key PDFs without modifying sources.

Requires macOS Vision, swiftc, pypdfium2 and Pillow. Uses no network service.
Run with the bundled Codex Python if these packages are not in system Python.
Outputs per-page OCR JSON in content/topik-source and disposable PNGs in tmp.
Reruns resume from matching source hashes and extraction versions.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import time
import unicodedata

import pypdfium2 as pdfium

VERSION = 2
APP_ROOT = Path(__file__).resolve().parents[1]
EXAMS = (35, 36, 37, 41, 47, 52, 60, 64, 83, 91, 96, 102)


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)


def relative(path: Path) -> str:
    try:
        return str(path.relative_to(APP_ROOT))
    except ValueError:
        return str(path)


def inventory(source: Path) -> list[dict]:
    records = []
    for exam in EXAMS:
        folder = source / str(exam)
        if not folder.is_dir():
            raise FileNotFoundError(f'Missing source exam folder: {folder}')
        for path in sorted(folder.glob('*.pdf')):
            name = unicodedata.normalize('NFC', path.name)
            if '정답' in name:
                if exam == 35 and '읽기' not in name:
                    continue
                kind = 'answer-key'
            elif '읽기' in name:
                kind = 'reading'
            else:
                continue
            with pdfium.PdfDocument(path) as document:
                page_count = len(document)
            # Both combined B-form booklets were visually checked: listening /
            # writing ends on PDF page 17; the reading cover is PDF page 18.
            first_page = 18 if exam in (36, 37) and kind == 'reading' else 1
            question_start = (20 if exam in (36, 37) else
                              3 if exam in (35, 41) else 5) if kind == 'reading' else None
            records.append({
                'exam': exam,
                'kind': kind,
                'sourceFile': str(path),
                'sourceName': name,
                'sourceSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                'sourcePageCount': page_count,
                'selectedPdfPages': list(range(first_page, page_count + 1)),
                'firstQuestionPdfPage': question_start,
                'outputDirectory': f'content/topik-source/{exam}/{kind}',
            })
    return sorted(records, key=lambda item: (item['exam'], item['kind']))


def compile_ocr() -> Path:
    swift_file = APP_ROOT / 'scripts/topik-extract-ocr.swift'
    signature = hashlib.sha256(swift_file.read_bytes()).hexdigest()[:16]
    cache = Path(tempfile.gettempdir()) / 'hangang-topik-ocr'
    cache.mkdir(exist_ok=True)
    binary = cache / f'ocr-{signature}'
    if not binary.exists():
        subprocess.run([
            '/usr/bin/swiftc', '-O', '-module-cache-path', str(cache / 'modules'),
            str(swift_file), '-o', str(binary),
        ], check=True)
    return binary


def extract_page(job: tuple[dict, int, str, bool]) -> dict:
    record, page_number, binary, force = job
    output = APP_ROOT / record['outputDirectory'] / f'page-{page_number:03d}.json'
    image_path = APP_ROOT / 'tmp/topik-pages' / str(record['exam']) / record['kind'] / f'page-{page_number:03d}.png'
    if output.exists() and image_path.exists() and not force:
        data = json.loads(output.read_text())
        if data.get('sourceSha256') == record['sourceSha256'] and data.get('extractionVersion') == VERSION:
            return {'exam': record['exam'], 'kind': record['kind'], 'pdfPage': page_number, 'status': 'cached', 'lines': len(data['lines'])}

    started = time.monotonic()
    image_path.parent.mkdir(parents=True, exist_ok=True)
    with pdfium.PdfDocument(record['sourceFile']) as document:
        page = document[page_number - 1]
        image = page.render(scale=3).to_pil().convert('RGB')
        image.save(image_path, optimize=True)
        text_page = page.get_textpage()
        native_text = text_page.get_text_range()
        text_page.close()
        width, height = image.size
        is_blank = image.convert('L').getextrema()[0] > 250
        page.close()
    if is_blank:
        result = {'engine': 'Apple Vision', 'languages': ['ko-KR', 'en-US'], 'text': '', 'lines': []}
    else:
        process = subprocess.run([binary, str(image_path)], capture_output=True, text=True, timeout=180)
        if process.returncode:
            raise RuntimeError(f"OCR {record['exam']} {record['kind']} p{page_number}: {process.stderr.strip()}")
        result = json.loads(process.stdout)
    first_question = record['firstQuestionPdfPage']
    data = {
        'schemaVersion': 1,
        'extractionVersion': VERSION,
        'exam': record['exam'],
        'kind': record['kind'],
        'sourceFile': record['sourceFile'],
        'sourceName': record['sourceName'],
        'sourceSha256': record['sourceSha256'],
        'pdfPage': page_number,
        'sourcePageCount': record['sourcePageCount'],
        'sectionPage': page_number - first_question + 1 if first_question and page_number >= first_question else None,
        'isFrontMatter': bool(first_question and page_number < first_question),
        'isBlank': is_blank,
        'imagePath': relative(image_path),
        'width': width,
        'height': height,
        'bboxConvention': 'normalized top-left x,y,width,height',
        'nativeText': native_text,
        **result,
    }
    write_json(output, data)
    return {'exam': record['exam'], 'kind': record['kind'], 'pdfPage': page_number, 'status': 'extracted', 'lines': len(data['lines']), 'seconds': round(time.monotonic() - started, 2)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path('/Users/boburbek/Desktop/TOPIK_2'))
    parser.add_argument('--exam', type=int, action='append', help='Repeat to select exams; default all twelve.')
    parser.add_argument('--kind', choices=['reading', 'answer-key'])
    parser.add_argument('--page', type=int, action='append', help='Original, one-based PDF page; repeatable.')
    parser.add_argument('--workers', type=int, default=2)
    parser.add_argument('--force', action='store_true')
    parser.add_argument('--ocr-binary', type=Path, help='Use an already compiled OCR binary.')
    args = parser.parse_args()
    records = inventory(args.source)
    output_root = APP_ROOT / 'content/topik-source'
    manifest = {
        'schemaVersion': 1,
        'extractionVersion': VERSION,
        'sourceDirectory': str(args.source),
        'scope': 'Reading exam booklets and answer-key PDFs only; no audio or unrelated documents.',
        'bboxConvention': 'normalized top-left x,y,width,height',
        'pageRenderingScale': 3,
        'ocrEngine': 'Apple Vision, accurate, ko-KR/en-US, language correction disabled',
        'missingAnswerKeyExams': [exam for exam in EXAMS if not any(r['exam'] == exam and r['kind'] == 'answer-key' for r in records)],
        'sources': records,
    }
    write_json(output_root / 'manifest.json', manifest)
    binary = args.ocr_binary or compile_ocr()
    jobs = [
        (record, page, str(binary), args.force)
        for record in records
        if (not args.exam or record['exam'] in args.exam) and (not args.kind or record['kind'] == args.kind)
        for page in record['selectedPdfPages']
        if not args.page or page in args.page
    ]
    print(json.dumps({'scheduledPages': len(jobs), 'workers': args.workers}), flush=True)
    failures = []
    completed = 0
    # Processes keep PDFium's non-thread-safe document state separate.
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(extract_page, job): job for job in jobs}
        for future in concurrent.futures.as_completed(futures):
            job = futures[future]
            try:
                result = future.result()
                completed += 1
                print(json.dumps({**result, 'completed': completed, 'total': len(jobs)}), flush=True)
            except Exception as error:
                failure = {'exam': job[0]['exam'], 'kind': job[0]['kind'], 'pdfPage': job[1], 'error': str(error)}
                failures.append(failure)
                print(json.dumps({'failure': failure}), flush=True)
    all_pages = []
    for record in records:
        for page in record['selectedPdfPages']:
            path = APP_ROOT / record['outputDirectory'] / f'page-{page:03d}.json'
            if path.exists():
                data = json.loads(path.read_text())
                all_pages.append({'exam': record['exam'], 'kind': record['kind'], 'pdfPage': page,
                                  'path': relative(path), 'lines': len(data['lines']), 'blank': data['isBlank']})
    write_json(output_root / 'status.json', {
        'schemaVersion': 1,
        'expectedPages': sum(len(record['selectedPdfPages']) for record in records),
        'extractedPages': len(all_pages),
        'pages': all_pages,
        'latestRunFailures': failures,
    })
    print(json.dumps({'completedPages': completed, 'failedPages': len(failures), 'allCachedPages': len(all_pages)}), flush=True)
    if failures:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
