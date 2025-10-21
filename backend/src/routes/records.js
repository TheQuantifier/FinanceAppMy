import { Router } from 'express';
import { getDb } from '../db/mongo.js';
import { requireAuth } from '../middleware/auth.js';
import { ObjectId } from 'mongodb';

const router = Router();

// Create a record (transaction)
router.post('/', requireAuth, async (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  const body = req.body || {};
  const now = new Date();
  const doc = {
    userId: new ObjectId(userId),
    type: body.type || 'expense', // 'expense' | 'income'
    amount: Number(body.amount || 0),
    currency: body.currency || 'USD',
    category: body.category || 'Uncategorized',
    date: body.date ? new Date(body.date) : now,
    vendor: body.vendor || null,
    description: body.description || null,
    sourceReceiptId: body.sourceReceiptId ? new ObjectId(body.sourceReceiptId) : null,
    createdAt: now,
    updatedAt: now
  };
  const { insertedId } = await db.collection('records').insertOne(doc);
  res.status(201).json({ id: insertedId.toString() });
});

// Read list
router.get('/', requireAuth, async (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  const limit = Math.min(200, Number(req.query.limit) || 50);
  const items = await db.collection('records')
    .find({ userId: new ObjectId(userId) })
    .sort({ date: -1 })
    .limit(limit)
    .toArray();
  res.json(items.map(r => ({ ...r, id: r._id.toString(), _id: undefined })));
});

export default router;
