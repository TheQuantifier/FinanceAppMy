# /api/src/services — Domain Services

Business logic and reusable orchestration (DB + external tools).

- **fileParser.service.js** — parse OCR/receipt data into structured fields.
- **ocr.service.js** — call Python worker, manage OCR lifecycle, normalize output.

**Conventions**
- No Express types here (no `req/res`); return plain data/errors.
- Compose multiple repositories/adapters when needed.
