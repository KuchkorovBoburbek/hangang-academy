# Local TOPIK source extraction

This directory contains source material for review and import, not a finished
question bank. The original PDFs are read in place and are never modified.
Audio files, the unrelated 서울대 directory, and other documents are excluded.
All OCR runs locally through macOS Vision; there is no external AI request.

- `manifest.json`: 23 selected PDFs, source hashes, original page ranges, and
  first reading-question page for each of the 12 exams.
- `<exam>/reading/page-NNN.json`: reading pages, including cover pages.
- `<exam>/answer-key/page-NNN.json`: every page in each selected answer-key PDF.
- `answer-keys.json`: 550 visually transcribed **reading** answers for 11 exams.
  The structure is `{ "35": { "1": 3 } }`; choices are one-based, from 1 to 4.
- `answer-key-sources.json`: the exact source page and verification provenance
  for each reading key. Exam 96 has no answer-key PDF and is intentionally absent.
- `status.json` and `extraction-validation.json`: extraction completeness and
  structural validation results.
- `source-omissions.json`: passage text intentionally absent from the provided
  PDFs. Every exam withholds the q42–43 passage; exam 102 also withholds q23–24.
- `underline-validation.json`: 60 detected line annotations, all visually
  checked against the rendered source after filtering glyph strokes and borders.

`pdfPage` is the original one-based PDF page number. `sectionPage` starts at 1
on the first reading question page; covers use `null`. For combined exam 36/37
booklets, only PDF pages 18–40 are included, with questions starting on page 20.
For exams 35/41 questions begin on PDF page 3; for the remaining exams, page 5.

Each OCR line has `text`, `confidence`, and a normalized `bbox` with a **top-left
origin**: `{ x, y, width, height }`. Multiply by the page's `width` and `height`
to obtain image crop coordinates. `imagePath` is relative to the application
root and points into disposable `tmp/topik-pages`; pages render at 3× PDF points.
`nativeText` preserves directly extractable PDF text when available. `text` and
`lines` retain raw OCR and may contain errors, particularly in headers, small
symbols, punctuation, circled options, and dense answer tables. The rendered
source image is the reference for corrections and underlining.

Reading pages also contain `charBoxes: [{ text, index, bbox }]` on OCR lines.
`index` is a zero-based Unicode codepoint offset into the raw line text (matching
Python string indexes, not JavaScript UTF-16 offsets). Vision may return zero
width/height for whitespace or punctuation; ignore those boxes for pixel work.
Character bounds are approximate and should not replace the original image.
Reading content lines have `underlineSpans: [{ start, end }]` with exclusive
ends and `textWithUnderlines` with escaped HTML text and `<u>` tags. Raw `text`
is unchanged. The detector requires a horizontal rule separated from the text
and below its baseline, and rejects connected box/table borders. All 60 positive
line detections in these source files have been visually checked.

To resume extraction on macOS with Python dependencies `pypdfium2` and `Pillow`:

```sh
python3 scripts/topik-extract.py --workers 3
python3 scripts/topik-extract-underlines.py
```

Useful filters are `--exam 52`, `--kind reading`, and `--page 5`. `--force`
reprocesses existing pages. Otherwise matching source hashes and extraction
versions are reused. Swift builds into a temporary cache, not the source tree.
In a restricted execution sandbox, the macOS Vision service may require the
same local execution permission used for the initial extraction.
