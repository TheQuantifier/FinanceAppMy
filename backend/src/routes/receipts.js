/**
 * Receipts: upload to GridFS, list from GridFS, download, delete.
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
await fs.mkdir(uploadDir, { recursive: true });

// Multer setup (25 MB limit)
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

const toId = (s) => {
  try {
    return new ObjectId(s);
  } catch {
    return null;
  }
};

// Format GridFS file → frontend shape
function mapFileDoc(fileDoc, receiptDoc) {
  return {
    id: fileDoc._id.toString(),
    fileId: fileDoc._id.toString(),
    originalName: fileDoc.metadata?.originalName || fileDoc.filename,
    date: fileDoc.uploadDate,
    parsed: !!receiptDoc?.parsed
  };
}

/* ===========================================================
 * Upload a receipt → GridFS (metadata.userId as STRING) + doc
 * ===========================================================
 */
router.post("/upload", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Missing file" });

  const userIdStr = String(req.user.id);
  const { originalname, path: localPath, mimetype, size } = req.file;
  const { date, total, vendor, notes } = req.body;

  try {
    // Store file in GridFS (userId as string)
    const fileId = await saveFileFromDisk(localPath, originalname, {
      userId: userIdStr, // IMPORTANT: string type
      originalName: originalname,
      mimetype,
      size
    });

    // Remove temp file
    fs.unlink(localPath).catch(() => {});

    // Add receipt document
    const db = getDb();
    const now = new Date();
    const receipt = {
      userId: new ObjectId(userIdStr),
      fileId,
      originalName: originalname,
      mimetype,
      size,
      parsed: null,
      vendor: vendor || null,
      total: total != null && total !== "" ? Number(total) : null,
      date: date ? new Date(date) : now,
      notes: notes || null,
      createdAt: now
    };

    const { insertedId } = await db.collection("receipts").insertOne(receipt);
    res.status(201).json({
      id: insertedId.toString(),
      fileId: fileId.toString()
    });
  } catch (err) {
    console.error("Upload failed:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

/* ===========================================================
 * Recent uploads (last 7 days, max 3) from GridFS
 * ===========================================================
 */
router.get("/recent", requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const userIdStr = String(req.user.id);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const files = await db
      .collection("files.files")
      .find({
        "metadata.userId": userIdStr,
        uploadDate: { $gte: sevenDaysAgo }
      })
      .sort({ uploadDate: -1 })
      .limit(3)
      .toArray();

    const fileIds = files.map((f) => f._id);
    const rcv = await db
      .collection("receipts")
      .find({ fileId: { $in: fileIds } })
      .project({ fileId: 1, parsed: 1 })
      .toArray();
    const byFile = new Map(rcv.map((r) => [r.fileId.toString(), r]));

    const out = files.map((f) => mapFileDoc(f, byFile.get(f._id.toString())));
    res.json(out);
  } catch (err) {
    next(err);
  }
});

/* ===========================================================
 * All uploads (newest first, optional ?limit=)
 * ===========================================================
 */
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const userIdStr = String(req.user.id);
    const limit = Math.max(
      1,
      Math.min(parseInt(req.query.limit || "100", 10) || 100, 1000)
    );

    const files = await db
      .collection("files.files")
      .find({ "metadata.userId": userIdStr })
      .sort({ uploadDate: -1 })
      .limit(limit)
      .toArray();

    const fileIds = files.map((f) => f._id);
    const rcv = await db
      .collection("receipts")
      .find({ fileId: { $in: fileIds } })
      .project({ fileId: 1, parsed: 1 })
      .toArray();
    const byFile = new Map(rcv.map((r) => [r.fileId.toString(), r]));

    const out = files.map((f) => mapFileDoc(f, byFile.get(f._id.toString())));
    res.json(out);
  } catch (err) {
    next(err);
  }
});

/* ===========================================================
 * Download raw file (receipt id OR GridFS file id)
 * ===========================================================
 */
router.get("/:id/file", requireAuth, async (req, res) => {
  const db = getDb();
  const userIdStr = String(req.user.id);
  const paramId = toId(req.params.id);
  if (!paramId) return res.status(400).json({ error: "Invalid id" });

  try {
    // 1) Try as a receipt id
    const rec = await db
      .collection("receipts")
      .findOne({ _id: paramId, userId: new ObjectId(userIdStr) });

    let fileId = null;
    let filename = null;

    if (rec) {
      fileId = rec.fileId;
      filename = rec.originalName;
    } else {
      // 2) Try as GridFS file id
      const fileDoc = await db
        .collection("files.files")
        .findOne({ _id: paramId, "metadata.userId": userIdStr });

      if (!fileDoc) return res.status(404).json({ error: "Not found" });

      fileId = fileDoc._id;
      filename = fileDoc.metadata?.originalName || fileDoc.filename || "download.bin";
      if (fileDoc.contentType) res.setHeader("Content-Type", fileDoc.contentType);
    }

    // Stream
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${String(filename).replace(/"/g, "")}"`
    );

    const stream = openDownloadStream(fileId);
    stream.on("error", (err) => {
      if (!res.headersSent) {
        const code = err?.code === "ENOENT" ? 404 : 500;
        res
          .status(code)
          .json({
            error:
              err?.code === "ENOENT"
                ? "File not found in GridFS"
                : "Download failed"
          });
      } else res.destroy();
    });
    return stream.pipe(res);
  } catch (err) {
    console.error("Download failed:", err);
    res.status(500).json({ error: "Failed to download file" });
  }
});

/* ===========================================================
 * Delete (receipt id OR GridFS file id)
 * ===========================================================
 */
router.delete("/:id", requireAuth, async (req, res) => {
  const db = getDb();
  const userIdStr = String(req.user.id);
  const paramId = toId(req.params.id);
  if (!paramId) return res.status(400).json({ error: "Invalid id" });

  try {
    // 1) Try as receipt id
    const rec = await db
      .collection("receipts")
      .findOne({ _id: paramId, userId: new ObjectId(userIdStr) });

    if (rec) {
      try {
        await deleteFile(rec.fileId);
      } catch (e) {
        if (e?.code !== "ENOENT") throw e;
      }
      await db.collection("receipts").deleteOne({ _id: paramId });
      return res.json({ ok: true, id: paramId.toString(), mode: "by-receipt" });
    }

    // 2) Try as GridFS file id
    const fileDoc = await db
      .collection("files.files")
      .findOne({ _id: paramId, "metadata.userId": userIdStr });
    if (!fileDoc) return res.status(404).json({ error: "Not found" });

    try {
      await deleteFile(fileDoc._id);
    } catch (e) {
      if (e?.code !== "ENOENT") throw e;
    }

    await db
      .collection("receipts")
      .deleteMany({ fileId: fileDoc._id, userId: new ObjectId(userIdStr) });

    res.json({ ok: true, id: paramId.toString(), mode: "by-file" });
  } catch (err) {
    console.error("Delete failed:", err);
    res.status(500).json({ error: "Failed to delete receipt" });
  }
});

export default router;
