/**
 * JWT authentication middleware.
 * Protects routes by verifying the Authorization: Bearer <token> header.
 */

import jwt from "jsonwebtoken";

/**
 * Express middleware — verifies JWT and attaches req.user.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    req.user = {
      id: payload.sub,
      email: payload.email,
    };
    next();
  } catch (err) {
    console.error("JWT verification failed:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Utility for generating new JWT tokens (can be used in signup/login routes).
 * @param {object} user - user object { _id, email }
 */
export function createToken(user) {
  const secret = process.env.JWT_SECRET || "dev-secret";
  const payload = {
    sub: user._id.toString(),
    email: user.email,
  };
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}
