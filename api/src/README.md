# /api/src — Source

Holds all backend source code, organized by responsibility:

- **config/** initialize env + DB.
- **controllers/** contain request handlers.
- **lib/** low-level helpers (GridFS IO).
- **middlewares/** auth, error, etc.
- **models/** DB schemas.
- **routes/** HTTP route definitions.
- **services/** domain logic (OCR, parsing).

Top-level:
- **app.js** — builds Express app, mounts routes/middleware.
- **server.js** — starts HTTP server.
