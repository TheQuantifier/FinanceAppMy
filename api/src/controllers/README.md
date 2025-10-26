# /api/src/controllers — Controllers

Express handlers that orchestrate request → service → response. Keep them thin: validation + calling services, not business logic.

- **auth.controller.js** — register, login, refresh, profile.
- **receipts.controller.js** — upload to GridFS, list, download, delete, OCR trigger.
- **records.controller.js** — CRUD for transactions (income/expense).

**Conventions**
- Input validation (e.g., via Zod/Joi) at the controller boundary.
- No direct DB calls; use **services/** or **lib/**.
- Always `next(err)` on failure; rely on global error middleware.
