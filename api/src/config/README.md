# /api/src/config — Configuration

Centralized app configuration and startup.

- **env.js** — Loads `.env`, validates required vars, exports config object.
- **mongo.js** — Connects to MongoDB (Mongoose + native client when needed), exports `getDb()`, connection lifecycle, and health checks.

**Conventions**
- Do not import `dotenv` elsewhere—only here.
- All modules use values from `env.js` (single source of truth).
