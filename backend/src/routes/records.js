/**
 * Transaction records: create and list normalized entries
 * for use in Records and Reports pages.
 */

import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { getDb } from "../db/mongo.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const createRecordSchema = z.object({
  type: z.enum(["expense", "income"]).default("expense"),
  amount: z.coerce.number().nonnegative(),
  currency: z.string().default("USD"),
  category: z.string().default("Uncategorized"),
  date: z.string().datetime().optional(), // ISO string
  vendor: z.string().optional(),
  description: z.string().optional(),
  sourceReceiptId: z.string().optional()
});

// -------- Create a record --------
router.post("/", requireAuth, async (req, res) => {
  const parsed = createRecordSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const body = parsed.data;
  const db = getDb();
  const now = new Date();

  const doc = {
    userId: new ObjectId(req.user.id),
    type: body.type,
    amount: Number(body.amount || 0),
    currency: body.currency || "USD",
    category: body.category || "Uncategorized",
    date: body.date ? new Date(body.date) : now,
    vendor: body.vendor ?? null,
    description: body.description ?? null,
    sourceReceiptId: body.sourceReceiptId ? new ObjectId(body.sourceReceiptId) : null,
    createdAt: now,
    updatedAt: now
  };

  try {
    const { insertedId } = await db.collection("records").insertOne(doc);
    return res.status(201).json({ id: insertedId.toString() });
  } catch (err) {
    console.error("Create record failed:", err);
    return res.status(500).json({ error: "Failed to create record" });
  }
});

// -------- List records --------
router.get("/", requireAuth, async (req, res) => {
  const db = getDb();
  const userId = req.user.id;

  const limit = Math.min(200, Number(req.query.limit) || 50);

  try {
    const items = await db
      .collection("records")
      .find({ userId: new ObjectId(userId) })
      .sort({ date: -1 })
      .limit(limit)
      .toArray();

    const out = items.map((r) => ({
      id: r._id.toString(),
      userId: r.userId.toString(),
      type: r.type,
      amount: r.amount,
      currency: r.currency,
      category: r.category,
      date: r.date,
      vendor: r.vendor,
      description: r.description,
      sourceReceiptId: r.sourceReceiptId ? r.sourceReceiptId.toString() : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));

    return res.json(out);
  } catch (err) {
    console.error("List records failed:", err);
    return res.status(500).json({ error: "Failed to list records" });
  }
});

export default router;
