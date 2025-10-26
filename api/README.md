# /api — Backend

Express API for auth, records, and receipt files (GridFS). Uses JWT auth and connects to MongoDB via Mongoose + native driver for GridFS.

## Layout
- **src/**
  - **config/** — app/env/mongo bootstrapping
  - **controllers/** — route handlers (business logic)
  - **lib/** — small libs (GridFS, multer, etc.)
  - **middlewares/** — Express middlewares (auth, error)
  - **models/** — Mongoose schemas
  - **routes/** — Express routers
  - **services/** — reusable domain services (OCR, parsing)
- **tmp_uploads/** — temp storage for uploads before GridFS

Entrypoints: `src/app.js` (app wiring), `src/server.js` (HTTP server).
