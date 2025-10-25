// api/src/models/Receipt.js
const mongoose = require("mongoose");

/**
 * Receipt Schema
 * Stores uploaded receipt metadata, parsed OCR fields, and derived finance data.
 */
const ReceiptSchema = new mongoose.Schema(
  {
    // ---- File Metadata ----
    original_filename: { type: String },
    stored_filename: { type: String },
    path: { type: String },
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
    return ret;
  },
});

module.exports =
  mongoose.models.Receipt || mongoose.model("Receipt", ReceiptSchema);
