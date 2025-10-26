# =====================================================
# FinanceApp – Render-ready image (Node + Python + Tesseract)
# =====================================================
FROM node:20-bullseye

# --- System deps: Python + Tesseract (no extras) ---
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip tesseract-ocr \
 && rm -rf /var/lib/apt/lists/*

# --- Workdir ---
WORKDIR /opt/app

# --- Install Node deps for API using lockfile (prod only) ---
COPY api/package*.json ./api/
RUN cd api && npm ci --omit=dev

# --- Copy only the source you need at runtime ---
# API (server code)
COPY api ./api
# Worker (OCR script)
COPY worker ./worker
# If the web/ folder is served separately, omit this to reduce image size.
# COPY web ./web

# --- Python libs for OCR ---
RUN python3 -m pip install --no-cache-dir \
      pymupdf pillow pytesseract

# --- Prepare runtime dirs & permissions ---
# Your app uses tmp_uploads by default; create it in-image so it exists on first boot.
RUN mkdir -p /opt/app/api/tmp_uploads \
 && chown -R node:node /opt/app

# --- Environment (override in Render as needed) ---
ENV NODE_ENV=production \
    OCR_ENABLED=true \
    PYTHON_BIN=python3 \
    PYTHONIOENCODING=UTF-8 \
    UPLOAD_DIR=/opt/app/api/tmp_uploads \
    PORT=4000

# Optional: document port
EXPOSE 4000

# --- Drop privileges ---
USER node

# --- Start API ---
WORKDIR /opt/app/api
CMD ["node", "src/server.js"]
