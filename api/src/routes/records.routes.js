// api/src/routes/records.routes.js
const { Router } = require("express");
const ctrl = require("../controllers/records.controller");
const { requireAuth } = require("../middlewares/auth");

const router = Router();

// List all records (with optional filters)
router.get("/", requireAuth, ctrl.list);

// Create a new record
router.post("/", requireAuth, ctrl.create);

module.exports = router;
