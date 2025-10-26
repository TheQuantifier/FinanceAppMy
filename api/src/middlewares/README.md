# /api/src/middlewares — Express Middlewares

Request/response cross-cutting concerns.

- **auth.js** — `requireAuth` JWT verification; attaches `req.user`.
- **error.js** — centralized error handler; consistent JSON error shape.

**Conventions**
- Middlewares must be idempotent and composable.
- Do not throw raw errors—wrap with HTTP status + message.
