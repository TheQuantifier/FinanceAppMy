/**
 * Receipts: upload file to GridFS, store metadata, list, and download.
 */

import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { ObjectId } from "mongodb";

import { getDb } from "../db/mongo.js";
import { saveFileFromDisk, openDownloadStream, deleteFile } from "../lib/gridfs.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Temp upload dir (created if missing)
const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || "tmp_uploads");

// Ensure directory exists
await fs.mkdir(uploadDir, { recursive: true });

// Multer setup (25 MB limit; adjust as needed)
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

// -------- Upload a receipt file --------
router.post("/upload", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Missing file" });

  const userId = req.user.id;
  const { originalname, path: localPath, mimetype, size } = req.file;
  const { date, total, vendor, notes } = req.body;

  try {
    const fileId = await saveFileFromDisk(localPath, originalname, {
      userId,
      mimetype,
      size
    });

    // Clean up temp file (best effort)
    fs.unlink(localPath).catch(() => {});

    const db = getDb();
    const now = new Date();
    const receipt = {
      userId: new ObjectId(userId),
      fileId,
      originalName: originalname,
      mimetype,
      size,
      parsed: null, // placeholder for OCR pipeline results
      vendor: vendor || null,
      total: total != null && total !== "" ? Number(total) : null,
      date: date ? new Date(date) : now,
      notes: notes || null,
      createdAt: now
    };

    const { insertedId } = await db.collection("receipts").insertOne(receipt);
    return res.status(201).json({
      id: insertedId.toString(),
      fileId: fileId.toString()
    });
  } catch (err) {
    console.error("Upload failed:", err);
    return res.status(500).json({ error: "Upload failed" });
  }
});

// -------- List recent receipts --------
router.get("/", requireAuth, async (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  const limit = Math.min(100, Number(req.query.limit) || 20);

  try {
    const items = await db
      .collection("receipts")
      .find({ userId: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    const out = items.map((r) => ({
      id: r._id.toString(),
      fileId: r.fileId.toString(),
      originalName: r.originalName,
      total: r.total,
      date: r.date,
      vendor: r.vendor,
      parsed: r.parsed
    }));

    return res.json(out);
  } catch (err) {
    console.error("List receipts failed:", err);
    return res.status(500).json({ error: "Failed to list receipts" });
  }
});

// -------- Download the raw file --------
router.get("/:id/file", requireAuth, async (req, res) => {
  const db = getDb();
  const userId = req.user.id;

  try {
    const rec = await db
      .collection("receipts")
      .findOne({ _id: new ObjectId(req.params.id), userId: new ObjectId(userId) });

    if (!rec) return res.status(404).json({ error: "Not found" });

    const stream = openDownloadStream(rec.fileId);
    res.setHeader("Content-Disposition", `inline; filename="${rec.originalName}"`);
    return stream.pipe(res);
  } catch (err) {
    console.error("Download failed:", err);
    return res.status(500).json({ error: "Failed to download file" });
  }
});

// -------- (Optional) Delete a receipt --------
router.delete("/:id", requireAuth, async (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  const _id = new ObjectId(req.params.id);

  try {
    const rec = await db.collection("receipts").findOne({ _id, userId: new ObjectId(userId) });
    if (!rec) return res.status(404).json({ error: "Not found" });

    await deleteFile(rec.fileId);
    await db.collection("receipts").deleteOne({ _id });

    return res.json({ ok: true });
  } catch (err) {
    console.error("Delete failed:", err);
    return res.status(500).json({ error: "Failed to delete receipt" });
  }
});

export default router;
