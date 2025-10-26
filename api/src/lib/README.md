# /api/src/lib — Libraries & Adapters

Low-level utilities with minimal dependencies.

- **gridfs.js** — create GridFS buckets, `saveFileFromDisk`, `openDownloadStream`, `deleteFile`, metadata helpers.
- **multer.js** — Multer setup for temp disk uploads; size limits.

**Conventions**
- No business rules here—only IO/adapters.
- Keep functions small, pure where possible.
