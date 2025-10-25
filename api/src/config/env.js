// api/src/config/env.js
require("dotenv").config();

/**
 * Centralized environment configuration.
 * Loads and validates all required environment variables.
 */

const port = Number(process.env.PORT || 4000);
const mongoUri = process.env.MONGODB_URI;
const mongoDb = process.env.MONGODB_DB || "financeapp";
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";
const jwtSecret = process.env.JWT_SECRET || "supersecretkey";
const uploadDir = process.env.UPLOAD_DIR || "uploads";
const ocrEnabled = (process.env.OCR_ENABLED || "false").toLowerCase() === "true";
const pythonBin = process.env.PYTHON_BIN || "";

// ---- Validation ----
if (!mongoUri) {
  console.error("❌ MONGODB_URI is not set in .env");
  process.exit(1);
}

// ---- Exported Config ----
module.exports = {
  port,
  mongoUri,
  mongoDb,
  corsOrigin,
  jwtSecret,
  uploadDir,
  ocrEnabled,
  pythonBin,
};
