// api/src/routes/receipts.routes.js
const { Router } = require("express");
const ctrl = require("../controllers/receipts.controller");
const { requireAuth } = require("../middlewares/auth");

const router = Router();

/**
 * Routes:
 *   POST   /api/receipts       → upload + parse new receipt
 *   GET    /api/receipts       → list all receipts (latest 100)
 *   GET    /api/receipts/:id   → get one receipt
 *   DELETE /api/receipts/:id   → delete one receipt + file
 */

// Upload route (requires auth)
router.post("/", requireAuth, ctrl.uploadMulter, ctrl.upload);

// Get list of recent receipts
router.get("/", requireAuth, ctrl.list);

// Get a single receipt
router.get("/:id", requireAuth, ctrl.getOne);

// Delete a receipt
router.delete("/:id", requireAuth, ctrl.remove);

module.exports = router;
