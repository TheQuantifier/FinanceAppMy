// api/src/models/Receipt.js
// Defines the MongoDB schema for uploaded receipts, including file metadata, OCR text, and parsed financial details.
// Adds indexes for efficient querying and custom JSON formatting for API responses. Tracks GridFS file IDs.

const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

/**
 * Receipt Schema
 * Stores uploaded receipt metadata, parsed OCR fields, and derived finance data.
 */
const ReceiptSchema = new Schema(
  {
    // ---- File Metadata (GridFS) ----
    file_id: { type: Types.ObjectId },                 // GridFS _id
    bucket: { type: String, default: "uploads" },      // GridFS bucket
    original_filename: { type: String },
    stored_filename: { type: String },                 // GridFS filename
    path: { type: String },                            // (legacy; may be null when using GridFS)
    mimetype: { type: String },
    size_bytes: { type: Number },
    uploaded_at: { type: Date, default: Date.now },

    // ---- Parsing & OCR ----
    parse_status: { type: String, enum: ["parsed", "raw", "error"], default: "raw" },
    ocr_text: { type: String },

    // ---- Parsed Financial Fields ----
    date: { type: String }, // keep as String for now (can convert to Date later)
    source: { type: String },
    category: { type: String, default: "other" },
    amount: { type: Number },
    method: { type: String },
    notes: { type: String },
    type: { type: String, enum: ["expense", "income"], default: "expense" },
    currency: { type: String, default: "USD" },
  },
  { timestamps: true }
);

// Helpful indexes for dashboard filtering/sorting
ReceiptSchema.index({ uploaded_at: -1 });
ReceiptSchema.index({ date: -1 });
ReceiptSchema.index({ category: 1 });
ReceiptSchema.index({ method: 1 });

// Clean JSON output for API responses
ReceiptSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret._id = String(ret._id);
    if (ret.file_id) ret.file_id = String(ret.file_id);
    return ret;
  },
});

module.exports =
  mongoose.models.Receipt || mongoose.model("Receipt", ReceiptSchema);
