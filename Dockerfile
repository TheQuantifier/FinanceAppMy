# =====================================================
# FinanceAppMy – Render-ready full image (Node + Python + Tesseract)
# =====================================================
FROM node:20-bullseye

# --- Install Python + Tesseract OCR dependencies ---
RUN apt-get update && apt-get install -y \
    python3 python3-pip tesseract-ocr \
 && rm -rf /var/lib/apt/lists/*

# --- Set working directory ---
WORKDIR /opt/app

# --- Copy and install Node dependencies for API ---
COPY api/package*.json api/
RUN cd api && npm install --omit=dev

# --- Copy the rest of the repo (API + worker + web) ---
COPY . .

# --- Install Python libraries for OCR ---
RUN python3 -m pip install --no-cache-dir pymupdf pillow pytesseract

# --- Environment defaults (can override in Render) ---
ENV NODE_ENV=production \
    OCR_ENABLED=true \
    PYTHON_BIN=python3 \
    UPLOAD_DIR=/opt/app/api/uploads \
    PORT=4000

# --- Final working directory and startup command ---
WORKDIR /opt/app/api
CMD ["node", "src/server.js"]