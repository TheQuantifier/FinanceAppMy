// api/src/routes/receipts.routes.js
// Defines all receipt-related API routes for uploading, listing, retrieving, downloading, and deleting receipts.
// Each route requires authentication and connects to controller functions that handle GridFS storage and parsing.

const { Router } = require("express");
const ctrl = require("../controllers/receipts.controller");
const { requireAuth } = require("../middlewares/auth");

const router = Router();

/**
 * Routes:
 *   POST   /api/receipts          → upload + parse new receipt (GridFS)
 *   GET    /api/receipts          → list all receipts (latest 100)
 *   GET    /api/receipts/:id      → get one receipt (metadata)
 *   GET    /api/receipts/:id/file → stream original file from GridFS
 *   DELETE /api/receipts/:id      → delete one receipt + GridFS file
 */

// Upload route (requires auth)
router.post("/", requireAuth, ctrl.uploadMulter, ctrl.upload);

// Get list of recent receipts
router.get("/", requireAuth, ctrl.list);

// Get a single receipt
router.get("/:id", requireAuth, ctrl.getOne);

// Stream/download the original file from GridFS
router.get("/:id/file", requireAuth, ctrl.download);

// Delete a receipt
router.delete("/:id", requireAuth, ctrl.remove);

module.exports = router;
