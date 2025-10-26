// api/src/routes/auth.routes.js
// Defines authentication-related API routes for registration, login, logout, and fetching the current user.
// Connects each route to its controller logic and applies JWT-based protection for authenticated endpoints.
const { Router } = require("express");
const ctrl = require("../controllers/auth.controller");
const { requireAuth } = require("../middlewares/auth");

const router = Router();

// Public routes
router.post("/register", ctrl.register);
router.post("/login", ctrl.login);

// Protected route — only accessible with a valid JWT
router.get("/me", requireAuth, ctrl.me);

// Logout route (clears cookie)
router.post("/logout", ctrl.logout);

module.exports = router;
