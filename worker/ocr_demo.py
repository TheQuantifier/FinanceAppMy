#!/usr/bin/env python3
"""
worker/ocr_demo.py
Extracts text from PDFs or images using PyMuPDF + pytesseract.
Outputs JSON for Node.js integration via stdout.
"""

import sys
import json
import re
from datetime import datetime
from io import BytesIO

try:
    import fitz  # PyMuPDF
    from PIL import Image
    import pytesseract
except ImportError as e:
    print(json.dumps({
        "source": sys.argv[1] if len(sys.argv) > 1 else None,
        "ocr_text": "",
        "error": f"Missing dependency: {e}"
    }))
    sys.exit(1)


# ---------- PDF to Image Conversion ----------
def pdf_to_images(path, dpi=300):
    """Convert each page of a PDF into a PIL image."""
    images = []
    try:
        doc = fitz.open(path)
        for page in doc:
            pix = page.get_pixmap(dpi=dpi)
            img = Image.open(BytesIO(pix.tobytes("png")))
            images.append(img)
        doc.close()
    except Exception as e:
        raise RuntimeError(f"PDF processing error: {e}")
    return images


# ---------- OCR Text Extraction ----------
def ocr(path):
    """Extract text from a PDF or image using pytesseract."""
    try:
        if path.lower().endswith(".pdf"):
            images = pdf_to_images(path)
            text = "\n".join(pytesseract.image_to_string(img) for img in images)
        else:
            text = pytesseract.image_to_string(Image.open(path))
        return text.strip()
    except Exception as e:
        return f"OCR failed: {e}"


# ---------- Field Extraction ----------
def extract_fields(text):
    """Extract simple structured data from OCR text."""
    result = {
        "Date": None,
        "Amount": None,
        "Source": None,
        "Category": None,
        "Notes": text.strip(),
        "Type": "expense"
    }

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if lines:
        result["Source"] = lines[0]
        if len(lines) > 1:
            result["Notes"] = "\n".join(lines[1:])

    # Date: yyyy-mm-dd or mm/dd/yyyy
    date_match = re.search(r"(\d{4}-\d{2}-\d{2})|(\d{1,2}/\d{1,2}/\d{4})", text)
    if date_match:
        raw_date = date_match.group(0)
        for fmt in ("%Y-%m-%d", "%m/%d/%Y"):
            try:
                dt = datetime.strptime(raw_date, fmt)
                result["Date"] = dt.strftime("%Y-%m-%d")
                break
            except ValueError:
                continue

    # Amount: numeric with optional $
    amount_match = re.search(r"\$?\s*([\d,]+(?:\.\d{1,2})?)", text)
    if amount_match:
        try:
            result["Amount"] = float(amount_match.group(1).replace(",", ""))
        except ValueError:
            pass

    # Category detection (basic keyword mapping)
    categories = {
        "food": ["restaurant", "cafe", "coffee", "burger", "food"],
        "transport": ["uber", "lyft", "taxi", "bus", "train", "flight"],
        "utilities": ["electric", "water", "internet", "rent", "bill"],
        "shopping": ["store", "amazon", "target", "walmart", "mall"],
        "entertainment": ["movie", "concert", "spotify", "netflix"],
    }
    lower = text.lower()
    for cat, keywords in categories.items():
        if any(word in lower for word in keywords):
            result["Category"] = cat
            break

    return result


# ---------- Main ----------
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"source": None, "ocr_text": "", "error": "No file path provided"}))
        sys.exit(1)

    path = sys.argv[1]

    try:
        text = ocr(path)
        parsed = extract_fields(text)
        output = {"source": path, "ocr_text": text}
        output.update(parsed)
        print(json.dumps(output))
    except Exception as e:
        print(json.dumps({"source": path, "ocr_text": "", "error": str(e)}))
        sys.exit(1)
