import { Router } from 'express';
import { getDb } from '../db/mongo.js';
import { requireAuth } from '../middleware/auth.js';
import { ObjectId } from 'mongodb';

const router = Router();

// Simple summary for dashboard
router.get('/summary', requireAuth, async (req, res) => {
  const db = getDb();
  const userId = new ObjectId(req.user.id);
  const since = req.query.since ? new Date(req.query.since) : new Date(new Date().getFullYear(), 0, 1);
  const pipeline = [
    { $match: { userId, date: { $gte: since } } },
    { $group: {
        _id: "$type",
        total: { $sum: "$amount" }
      } 
    }
  ];
  const rows = await db.collection('records').aggregate(pipeline).toArray();
  const out = { expenses: 0, income: 0 };
  for (const r of rows) out[r._id] = r.total;
  res.json(out);
});

// Category breakdown
router.get('/by-category', requireAuth, async (req, res) => {
  const db = getDb();
  const userId = new ObjectId(req.user.id);
  const pipeline = [
    { $match: { userId } },
    { $group: { _id: "$category", total: { $sum: "$amount" } } },
    { $sort: { total: -1 } }
  ];
  const rows = await db.collection('records').aggregate(pipeline).toArray();
  res.json(rows.map(r => ({ category: r._id, total: r.total })));
});

export default router;
