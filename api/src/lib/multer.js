// api/src/lib/multer.js
// Configures Multer for secure file uploads, ensuring the upload directory exists and allowing only PDF/PNG/JPG files.
// Provides an upload instance with a 50 MB limit and timestamped, sanitized filenames.
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { uploadDir } = require("../config/env");

/**
 * Ensure upload directory exists
 */
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("📂 Created uploads directory:", path.resolve(uploadDir));
}

/**
 * Validate allowed file types (PDF, PNG, JPG)
 */
function isAllowedFile(file) {
  const allowedMimes = new Set(["application/pdf", "image/png", "image/jpeg"]);
  if (allowedMimes.has(file.mimetype)) return true;

  const ext = path.extname(file.originalname).toLowerCase();
  return [".pdf", ".png", ".jpg", ".jpeg"].includes(ext);
}

/**
 * Multer storage configuration
 * Creates a timestamped, sanitized filename
 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.resolve(uploadDir)),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^\w.\-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

/**
 * Multer upload instance
 * Limits: 50 MB max
 */
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

module.exports = { upload, isAllowedFile };
