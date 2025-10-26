# Finance App — Monorepo

This project is a full-stack receipt/expense manager with OCR.

## Structure
- **api/** — Node/Express backend with MongoDB (Atlas) + GridFS.
- **web/** — Front-end (static HTML/CSS/JS) with shared includes.
- **worker/** — Python OCR worker (PyMuPDF + Tesseract).

## Quick Start
- Backend: `cd api && npm i && npm run dev`
- Front-end: open `web/pages/index.html` via local server
- Worker: `cd worker && python -m venv .venv && pip install -r requirements.txt`
