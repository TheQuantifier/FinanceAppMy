# /api/src/routes — HTTP Routers

Router modules that map paths to controllers.

- **auth.routes.js** — `/api/auth/*` (register, login, refresh, me).
- **receipts.routes.js** — `/api/receipts/*` (upload, list, download, delete).
- **records.routes.js** — `/api/records/*` (CRUD, filters, export).
- **index.js** — mounts all routers on the app.

**Conventions**
- Prefix within each file (e.g., `router.get('/')` for list).
- Apply middlewares per-route (e.g., `requireAuth`).
