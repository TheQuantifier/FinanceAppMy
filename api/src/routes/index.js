// api/src/routes/index.js
// Central router that combines all route modules (auth, records, receipts) under their respective paths.
// Each route is mounted below the /api prefix defined in the main Express app.
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
