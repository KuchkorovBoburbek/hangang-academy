#!/usr/bin/env python3
"""Recover underlined source text from local page pixels and OCR character boxes.

Adds optional annotations without changing raw OCR text. Character indexes are
zero-based Unicode codepoints, with exclusive ends. No network calls are used.
"""

from __future__ import annotations

import argparse
import html
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
VERSION = 3


def black_runs(row: np.ndarray) -> list[tuple[int, int]]:
    changes = np.diff(np.r_[False, row, False].astype(np.int8))
    return list(zip(np.flatnonzero(changes == 1), np.flatnonzero(changes == -1)))


def annotate_line(line: dict, pixels: np.ndarray) -> list[dict]:
    height, width = pixels.shape
    box = line['bbox']
    line_x = box['x'] * width
    line_right = (box['x'] + box['width']) * width
    line_y = box['y'] * height
    line_height = box['height'] * height
    chars = [c for c in line.get('charBoxes', [])
             if c['text'].strip() and c['bbox']['width'] > 0 and c['bbox']['height'] > 0]
    if len(chars) < 2 or line_height < 8:
        return []
    char_widths = [c['bbox']['width'] * width for c in chars if '\uac00' <= c['text'] <= '\ud7a3']
    typical_width = float(np.median(char_widths)) if char_widths else line_height * .7
    minimum_run = max(18, typical_width * 1.55)
    y_start = max(0, int(line_y + line_height * .62))
    y_end = min(height, int(line_y + line_height * 1.18) + 1)
    candidates = []
    for y in range(y_start, y_end):
        for start, end in black_runs(pixels[y] < 170):
            run_width = end - start
            if run_width < minimum_run or end < line_x or start > line_right:
                continue
            # A border extends outside the text line, while an underline tracks
            # the characters. Read the complete pixel row rather than clipping
            # it to the OCR box, which could otherwise hide the border's ends.
            if start < line_x - typical_width * .6 and end > line_right + typical_width * .6:
                continue
            if run_width > box['width'] * width + typical_width * 1.3:
                continue
            # An underline is separated from the glyph bodies by clear paper.
            # Adjacent ㅡ/ㅗ/ㅜ bottom strokes can otherwise form long horizontal
            # runs in Korean, especially in bold fonts. Require a nearly empty
            # complete row above the rule, not merely a low average ink count.
            gap_band = pixels[max(y_start - 8, y - max(6, int(line_height * .22))):y,
                              start:end] < 170
            if not gap_band.size or np.min(gap_band.mean(axis=1)) > .012:
                continue
            # Korean syllables such as 스/트 have a detached lower bar. A true
            # underline must also sit below the baseline of the other letters
            # in this OCR line, not simply below the upper parts of one glyph.
            body_x0 = max(0, int(line_x))
            body_x1 = min(width, int(line_right) + 1)
            body_y0 = max(0, int(line_y))
            # The wider search strip may reach the next line's ascenders;
            # estimate this line's baseline inside its own OCR height only.
            body_y1 = min(y_end, max(y + 1, int(line_y + line_height)))
            body = (pixels[body_y0:body_y1, body_x0:body_x1] < 170).copy()
            body[:, max(0, start - body_x0 - 3):min(body.shape[1], end - body_x0 + 3)] = False
            remaining_y = np.flatnonzero(body.any(axis=1))
            if len(remaining_y) > 6 and run_width < (line_right - line_x) * .94:
                body_ink_y = np.where(body)[0]
                baseline = float(np.quantile(body_ink_y, .99)) + body_y0
                if y < baseline + 1.5:
                    continue
            # Reject table and passage-box bottom edges joined to tall sides.
            vertical_length = max(10, int(line_height * .8))
            has_side = False
            for edge in (start, end - 1):
                segment = pixels[max(0, y - vertical_length):y + 1,
                                 max(0, edge - 2):min(width, edge + 3)] < 170
                if segment.size and np.max(segment.sum(axis=0)) > vertical_length * .8:
                    has_side = True
            if has_side:
                continue
            selected = []
            for character in chars:
                cb = character['bbox']
                centre = (cb['x'] + cb['width'] / 2) * width
                if start - 1 <= centre <= end + 1:
                    selected.append(character['index'])
            if len(selected) < 2:
                continue
            first, last = min(selected), max(selected) + 1
            # Underlines use Korean words/phrases. This also rejects ornamental
            # rules below a bare number or a small punctuation-only label.
            if not any('\uac00' <= c <= '\ud7a3' for c in line['text'][first:last]):
                continue
            candidates.append((first, last, int(start), int(end), y))

    grouped = {}
    for start, end, x0, x1, y in candidates:
        grouped.setdefault((start, end), []).append((x0, x1, y))
    spans = []
    for (start, end), evidence in grouped.items():
        ys = [item[2] for item in evidence]
        thickness = max(ys) - min(ys) + 1
        # One-pixel anti-aliased rules are real; broad text strokes are not.
        if thickness > max(7, line_height * .22):
            continue
        spans.append({'start': start, 'end': end})
    spans.sort(key=lambda span: (span['start'], -span['end']))
    merged = []
    for span in spans:
        if merged and span['start'] <= merged[-1]['end']:
            merged[-1]['end'] = max(merged[-1]['end'], span['end'])
        else:
            merged.append(dict(span))
    return merged


def html_text(text: str, spans: list[dict]) -> str:
    pieces = []
    previous = 0
    for span in spans:
        pieces.append(html.escape(text[previous:span['start']]))
        pieces.append('<u>' + html.escape(text[span['start']:span['end']]) + '</u>')
        previous = span['end']
    pieces.append(html.escape(text[previous:]))
    return ''.join(pieces)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exam', type=int, action='append')
    parser.add_argument('--page', type=int, action='append')
    args = parser.parse_args()
    annotated = []
    missing_character_pages = []
    for path in sorted((ROOT / 'content/topik-source').glob('*/reading/page-*.json')):
        page = json.loads(path.read_text())
        if args.exam and page['exam'] not in args.exam:
            continue
        if args.page and page['pdfPage'] not in args.page:
            continue
        if page['isBlank'] or page['isFrontMatter']:
            continue
        if any('charBoxes' not in line for line in page['lines']):
            missing_character_pages.append(str(path.relative_to(ROOT)))
            continue
        pixels = np.asarray(Image.open(ROOT / page['imagePath']).convert('L'))
        page['characterIndexing'] = 'zero-based Unicode codepoints; exclusive end'
        page['underlineExtractionVersion'] = VERSION
        for index, line in enumerate(page['lines']):
            spans = annotate_line(line, pixels)
            line['underlineSpans'] = spans
            line['textWithUnderlines'] = html_text(line['text'], spans)
            if spans:
                annotated.append({'exam': page['exam'], 'pdfPage': page['pdfPage'],
                                  'line': index, 'text': line['textWithUnderlines'], 'spans': spans})
        temporary = path.with_suffix('.json.tmp')
        temporary.write_text(json.dumps(page, ensure_ascii=False, indent=2) + '\n')
        temporary.replace(path)
    report = {'schemaVersion': 1, 'method': 'horizontal source-pixel runs near text baseline, mapped to OCR character centres',
              'annotatedLines': len(annotated), 'missingCharacterPages': missing_character_pages, 'lines': annotated}
    report_path = ROOT / 'content/topik-source/underline-validation.json'
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
