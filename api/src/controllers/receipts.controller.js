// api/src/controllers/receipts.controller.js
const fs = require("fs");
const path = require("path");
const Receipt = require("../models/Receipt");
const { upload, isAllowedFile } = require("../lib/multer");
const { runOCR } = require("../services/ocr.service");
const { parseFile } = require("../services/fileParser.service");

// Expose the Multer middleware so routes can do: r.post("/", requireAuth, uploadMulter, upload)
exports.uploadMulter = upload.single("receipt");

/**
 * POST /api/receipts
 * Form-Data: receipt (file)
 */
exports.upload = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    if (!isAllowedFile(req.file)) {
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(400).json({ error: "Only PDF/PNG/JPG allowed" });
    }

    const absPath = path.resolve(req.file.path);

    // OCR (respects env flag; returns { ocr_text, error? })
    const { ocr_text } = await runOCR(absPath);

    // Parse the file (PDF/TXT/CSV) with OCR fallback text
    let parsed = {};
    try {
      parsed = (await parseFile(absPath, req.file.mimetype, ocr_text || "")) || {};
    } catch (e) {
      console.warn("Parse failed:", e.message || e);
    }

    // Create DB record
    const doc = await Receipt.create({
      original_filename: req.file.originalname,
      stored_filename: req.file.filename,
      path: absPath,
      mimetype: req.file.mimetype,
      size_bytes: req.file.size,
      uploaded_at: new Date(),
      parse_status: Object.keys(parsed).length ? "parsed" : "raw",
      ocr_text: ocr_text || "",

      // Parsed fields
      date: parsed?.Date || null,
      source: parsed?.Source || (ocr_text ? ocr_text.slice(0, 100) : null),
      category: parsed?.Category || "other",
      amount: parsed?.Amount ?? null,
      method: parsed?.Method || null,
      notes: parsed?.Notes || (ocr_text || null),
      type: parsed?.Type || "expense",
      currency: "USD",
    });

    return res.json({ message: "File uploaded and parsed.", receipt: doc });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/receipts
 * Returns the most recent 100 receipts with parsed financial fields
 */
exports.list = async (_req, res, next) => {
  try {
    const rows = await Receipt.find({})
      .sort({ uploaded_at: -1 })
      .limit(100)
      .lean();

    const cleaned = rows.map((r) => ({
      _id: String(r._id),
      date: r.date || null,
      source: r.source || null,
      category: r.category || null,
      amount: r.amount ?? null,
      method: r.method || null,
      notes: r.notes || null,
      parse_status: r.parse_status,
      uploaded_at: r.uploaded_at,
    }));

    return res.json(cleaned);
  } catch (e) {
    return next(e);
  }
};

/**
 * GET /api/receipts/:id
 * Returns normalized financial fields for a single receipt
 */
exports.getOne = async (req, res, next) => {
  try {
    const r = await Receipt.findById(req.params.id).lean();
    if (!r) return res.status(404).json({ error: "Not found" });

    return res.json({
      _id: String(r._id),
      Date: r.date || null,
      Source: r.source || null,
      Category: r.category || null,
      Amount: r.amount || null,
      Method: r.method || null,
      Notes: r.notes || null,
    });
  } catch (e) {
    return next(e);
  }
};

/**
 * DELETE /api/receipts/:id
 * Removes DB record and the stored file (if present)
 */
exports.remove = async (req, res, next) => {
  try {
    const r = await Receipt.findById(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });

    // Best-effort local file cleanup
    try {
      if (r.path && fs.existsSync(r.path)) fs.unlinkSync(r.path);
    } catch {
      // swallow unlink errors
    }

    await Receipt.findByIdAndDelete(req.params.id);
    return res.json({ deleted: req.params.id });
  } catch (e) {
    return next(e);
  }
};
