// api/src/middlewares/auth.js
const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config/env");

/**
 * Extract JWT from either:
 * - Cookie: token
 * - Header: Authorization: Bearer <token>
 */
function getToken(req) {
  const cookieToken = req.cookies && req.cookies.token;
  const header = req.headers.authorization || req.headers.Authorization;
  const bearer = header && /^Bearer\s+(.+)$/i.exec(header);
  return cookieToken || (bearer && bearer[1]) || null;
}

/**
 * Strict auth: request must be authenticated.
 */
function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    req.user = jwt.verify(token, jwtSecret);
    return next();
  } catch (_e) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Optional auth: attaches req.user if present; otherwise continues.
 * Useful for endpoints that behave differently for guests vs. users.
 */
function optionalAuth(req, _res, next) {
  const token = getToken(req);
  if (!token) return next();
  try {
    req.user = jwt.verify(token, jwtSecret);
  } catch {
    // ignore invalid token in optional mode
  }
  return next();
}

module.exports = { requireAuth, optionalAuth };
