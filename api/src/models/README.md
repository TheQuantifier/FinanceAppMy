# /api/src/models — Mongoose Models

MongoDB schemas and models.

- **User.js** — user credentials, email (unique), password hash, profile basics.
- **Record.js** — transactions: amount, type (income/expense), date, category, notes, userId.
- **Receipt.js** — metadata for GridFS files (filename, uploadDate, contentType, size, userId, recordId?).

**Conventions**
- Use schema-level validation and indexes only once (avoid duplicates).
- Keep schemas focused; complicated logic belongs in **services/**.
