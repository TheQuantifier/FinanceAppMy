// api/src/models/User.js
const mongoose = require("mongoose");

/**
 * User Schema
 * Stores account credentials and profile metadata.
 */
const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

// Clean JSON output (remove sensitive fields)
UserSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret.passwordHash; // never expose hashes
    ret._id = String(ret._id);
    return ret;
  },
});

module.exports =
  mongoose.models.User || mongoose.model("User", UserSchema);
