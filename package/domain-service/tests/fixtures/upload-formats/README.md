# Synthetic upload format fixtures

These files contain no personal or external data. JPEG, PNG, WebP, GIF and the one-page PDF were generated locally with Pillow 12.1.1 from a solid 2×2 RGB image `(32, 96, 160)`. APNG adds a second `(160, 96, 32)` frame with 100 ms duration and loop zero. PDF dates are fixed to 2026-01-01 UTC.

`synthetic.docx` is a minimal ZIP package made with Python's standard `zipfile`: content types, root officeDocument relationship and `word/document.xml` containing “Synthetic upload fixture”. Entries use a fixed 2026-01-01 timestamp and deflate compression. `unrelated.zip` contains only `unrelated.txt` and must not be accepted as DOCX. Tests read these checked-in files; Pillow/Python are not runtime or CI dependencies.

The tests exercise the real upload admission/completion path with deliberately uninformative `upload.bin` filenames. This qualifies the supported signature/MIME matrix, not full document parsing, image decoding, malware detection or feature-specific animation/dimension policy.
