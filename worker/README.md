# /worker — OCR Worker

Python worker for OCR and PDF/image parsing.

- **ocr_demo.py** — converts PDF pages to images (PyMuPDF), OCR with Tesseract, prints JSON to stdout for Node intake.
- **requirements.txt** — Python dependencies.
- **.venv/** — local virtual environment (not committed typically).

**Run**
```bash
python -m venv .venv
. .venv/Scripts/activate  # Windows
pip install -r requirements.txt
python ocr_demo.py <path>
