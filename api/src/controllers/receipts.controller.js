// api/src/controllers/receipts.controller.js
// Handles receipt file operations: upload (to GridFS), OCR extraction, parsing, listing, retrieval, download, and deletion.
// Integrates Multer (memory) for file uploads, OCR for text recognition, and MongoDB GridFS for storing originals.

const fs = require("fs");
const os = require("os");
const path = require("path");
const Receipt = require("../models/receipt");
const { uploadMem, isAllowedFile } = require("../lib/multer");
const { runOCR } = require("../services/ocr.service");
const { parseFile } = require("../services/fileParser.service");
const { uploadBufferToGridFS, openDownloadStream, deleteFile } = require("../lib/gridfs");

// Expose memory-based Multer for GridFS uploads
exports.uploadMulter = uploadMem.single("receipt");

// Write a buffer to a temp file (for OCR/parse that expect a path)
async function writeTempFile(buffer, originalName) {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "receipt-"));
  const safe = (originalName || "upload.bin").replace(/[^\w.\-]/g, "_");
  const filePath = path.join(dir, `${Date.now()}-${safe}`);
  await fs.promises.writeFile(filePath, buffer);
  return filePath;
}

/**
 * POST /api/receipts
 * Form-Data: receipt (file)
 */
exports.upload = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    if (!isAllowedFile(req.file)) {
      return res.status(400).json({ error: "Only PDF/PNG/JPG allowed" });
    }

    const { originalname, mimetype, buffer, size } = req.file;

    // 1) Store file in GridFS
    const stampedName = `${Date.now()}-${originalname.replace(/[^\w.\-]/g, "_")}`;
    const { fileId, filename } = await uploadBufferToGridFS(stampedName, buffer, {
      contentType: mimetype,
      metadata: { uploader: req.user?.id || null },
    });

    // 2) OCR + Parse (via temp file to reuse existing pipeline)
    let tempPath;
    let ocr_text = "";
    let parsed = {};
    try {
      tempPath = await writeTempFile(buffer, originalname);
      const ocrResult = await runOCR(tempPath); // returns { ocr_text, error? }
      ocr_text = ocrResult?.ocr_text || "";

      try {
        parsed = (await parseFile(tempPath, mimetype, ocr_text || "")) || {};
      } catch (e) {
        console.warn("Parse failed:", e.message || e);
      }
    } finally {
      // Best-effort cleanup
      if (tempPath) {
        try { await fs.promises.unlink(tempPath); } catch {}
        try { await fs.promises.rmdir(path.dirname(tempPath)); } catch {}
      }
    }

    // 3) Create DB record
    const doc = await Receipt.create({
      file_id: fileId,
      bucket: "uploads",
      original_filename: originalname,
      stored_filename: filename,
      mimetype,
      size_bytes: size || null,
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
 * Returns the most recent 100 receipts with all metadata fields.
 */
exports.list = async (_req, res, next) => {
  try {
    const rows = await Receipt.find({})
      .sort({ uploaded_at: -1 })
      .limit(100)
      .lean();

    const cleaned = rows.map((r) => ({
      _id: String(r._id),

      // File metadata
      file_id: r.file_id ? String(r.file_id) : null,
      bucket: r.bucket || "uploads",
      original_filename: r.original_filename || null,
      stored_filename:   r.stored_filename   || null,
      mimetype:          r.mimetype          || null,
      size_bytes:        r.size_bytes ?? null,
      uploaded_at:       r.uploaded_at,
      parse_status:      r.parse_status || "raw",

      // Parsed fields
      date:     r.date || null,
      source:   r.source || null,
      category: r.category || null,
      amount:   r.amount ?? null,
      method:   r.method || null,
      notes:    r.notes || null,
    }));

    return res.json(cleaned);
  } catch (e) {
    return next(e);
  }
};

/**
 * GET /api/receipts/:id
 * Returns all metadata + parsed financial fields for a single receipt.
 */
exports.getOne = async (req, res, next) => {
  try {
    const r = await Receipt.findById(req.params.id).lean();
    if (!r) return res.status(404).json({ error: "Not found" });

    return res.json({
      _id: String(r._id),

      // File metadata
      file_id: r.file_id ? String(r.file_id) : null,
      bucket: r.bucket || "uploads",
      original_filename: r.original_filename || null,
      stored_filename:   r.stored_filename   || null,
      mimetype:          r.mimetype          || null,
      size_bytes:        r.size_bytes ?? null,
      uploaded_at:       r.uploaded_at,
      parse_status:      r.parse_status || "raw",

      // Parsed fields (Title Case for UI compatibility)
      Date:     r.date || null,
      Source:   r.source || null,
      Category: r.category || null,
      Amount:   r.amount ?? null,
      Method:   r.method || null,
      Notes:    r.notes || null,
      Type:     r.type || "expense",
    });
  } catch (e) {
    return next(e);
  }
};

/**
 * GET /api/receipts/:id/file
 * Streams the original file from GridFS.
 */
exports.download = async (req, res, next) => {
  try {
    const r = await Receipt.findById(req.params.id).lean();
    if (!r || !r.file_id) return res.status(404).json({ error: "File not found" });

    res.setHeader("Content-Type", r.mimetype || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${r.original_filename || r.stored_filename || "file"}"`
    );

    const stream = openDownloadStream(r.file_id);
    stream.on("error", (err) => next(err));
    stream.pipe(res);
  } catch (e) {
    return next(e);
  }
};

/**
 * DELETE /api/receipts/:id
 * Removes DB record and the stored GridFS file (if present)
 */
exports.remove = async (req, res, next) => {
  try {
    const r = await Receipt.findById(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });

    // Delete GridFS file first (best-effort)
    if (r.file_id) {
      try { await deleteFile(r.file_id); } catch {}
    }

    await Receipt.findByIdAndDelete(req.params.id);
    return res.json({ deleted: req.params.id });
  } catch (e) {
    return next(e);
  }
};
