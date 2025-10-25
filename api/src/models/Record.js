// api/src/models/Record.js
const mongoose = require("mongoose");

const RecordSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["expense", "income"], required: true },
    // Keep as String for backward compatibility with your current data.
    // (You can migrate to Date later.)
    date: { type: String, required: true },
    source: { type: String, default: "" },
    category: { type: String, default: "" },
    amount: { type: Number, required: true },
    method: { type: String, default: "" },
    notes: { type: String, default: "" },
    currency: { type: String, default: "USD" },
  },
  { timestamps: true }
);

// Helpful indexes
RecordSchema.index({ date: -1 });
RecordSchema.index({ type: 1 });
RecordSchema.index({ method: 1 });

// Optional: normalize JSON output (_id as string, remove __v)
RecordSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret._id = String(ret._id);
    return ret;
  },
});

module.exports =
  mongoose.models.Record || mongoose.model("Record", RecordSchema);
