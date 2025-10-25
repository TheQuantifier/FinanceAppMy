// api/src/routes/index.js
const { Router } = require("express");
const authRoutes = require("./auth.routes");
const recordsRoutes = require("./records.routes");
const receiptsRoutes = require("./receipts.routes");

const router = Router();

/**
 * Mount all route modules under their respective paths.
 * These will be prefixed by /api when used in app.js
 *
 * Example:
 *   /api/auth
 *   /api/records
 *   /api/receipts
 */
router.use("/auth", authRoutes);
router.use("/records", recordsRoutes);
router.use("/receipts", receiptsRoutes);

module.exports = router;
