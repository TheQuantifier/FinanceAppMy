/**
 * Reports routes — provide spending summaries, category breakdowns,
 * and other aggregated statistics for dashboard charts.
 */

import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDb } from "../db/mongo.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

/**
 * GET /api/reports/summary
 * Returns total income and expenses since a given date (defaults to start of year)
 */
router.get("/summary", requireAuth, async (req, res) => {
  const db = getDb();
  const userId = new ObjectId(req.user.id);
  const since = req.query.since
    ? new Date(req.query.since)
    : new Date(new Date().getFullYear(), 0, 1);

  try {
    const pipeline = [
      { $match: { userId, date: { $gte: since } } },
      { $group: { _id: "$type", total: { $sum: "$amount" } } }
    ];

    const rows = await db.collection("records").aggregate(pipeline).toArray();
    const out = { expenses: 0, income: 0 };

    for (const r of rows) {
      if (r._id === "expense") out.expenses = r.total;
      if (r._id === "income") out.income = r.total;
    }

    res.json(out);
  } catch (err) {
    console.error("Summary report failed:", err);
    res.status(500).json({ error: "Failed to generate summary report" });
  }
});

/**
 * GET /api/reports/by-category
 * Returns total spending per category for the authenticated user.
 */
router.get("/by-category", requireAuth, async (req, res) => {
  const db = getDb();
  const userId = new ObjectId(req.user.id);

  try {
    const pipeline = [
      { $match: { userId } },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
      { $sort: { total: -1 } }
    ];

    const rows = await db.collection("records").aggregate(pipeline).toArray();
    res.json(rows.map(r => ({ category: r._id, total: r.total })));
  } catch (err) {
    console.error("Category report failed:", err);
    res.status(500).json({ error: "Failed to generate category report" });
  }
});

export default router;
