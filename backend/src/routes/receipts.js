import { Router } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { ObjectId } from 'mongodb';
import { getDb } from '../db/mongo.js';
import { saveFileFromDisk, openDownloadStream } from '../lib/gridfs.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'tmp_uploads');
await fs.mkdir(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir, limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB

// Upload a receipt file + metadata
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Missing file' });
  const userId = req.user.id;
  const { originalname, path: localPath, mimetype, size } = req.file;
  const { date, total, vendor, notes } = req.body;

  try {
    const fileId = await saveFileFromDisk(localPath, originalname, { userId, mimetype, size });
    // Remove temp
    fs.unlink(localPath).catch(() => {});

    const db = getDb();
    const now = new Date();
    const receipt = {
      userId: new ObjectId(userId),
      fileId,
      originalName: originalname,
      mimetype,
      size,
      parsed: null,  // to be filled by OCR pipeline
      vendor: vendor || null,
      total: total ? Number(total) : null,
      date: date ? new Date(date) : now,
      notes: notes || null,
      createdAt: now
    };
    const { insertedId } = await db.collection('receipts').insertOne(receipt);
    res.status(201).json({ id: insertedId.toString(), fileId: fileId.toString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// List recent receipts
router.get('/', requireAuth, async (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const items = await db.collection('receipts')
    .find({ userId: new ObjectId(userId) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  res.json(items.map(r => ({ 
    id: r._id.toString(),
    fileId: r.fileId.toString(),
    originalName: r.originalName,
    total: r.total,
    date: r.date,
    vendor: r.vendor,
    parsed: r.parsed
  })));
});

// Download raw file
router.get('/:id/file', requireAuth, async (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  const rec = await db.collection('receipts').findOne({ _id: new ObjectId(req.params.id), userId: new ObjectId(userId) });
  if (!rec) return res.status(404).json({ error: 'Not found' });
  const stream = openDownloadStream(rec.fileId);
  res.setHeader('Content-Disposition', `inline; filename="${rec.originalName}"`);
  stream.pipe(res);
});

export default router;
