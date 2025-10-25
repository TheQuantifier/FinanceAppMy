// api/src/controllers/records.controller.js
const Record = require("../models/Record");

/**
 * GET /api/records
 * Optional query params:
 *   - category=Food
 *   - method=Credit Card
 *   - type=income|expense
 */
exports.list = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.category) query.category = req.query.category;
    if (req.query.method) query.method = req.query.method;
    if (req.query.type) query.type = req.query.type;

    const records = await Record.find(query)
      .sort({ date: -1, createdAt: -1 })
      .lean();

    const cleaned = records.map((r) => ({
      _id: String(r._id),
      type: r.type || "expense",
      date: r.date || null,
      source: r.source || null,
      category: r.category || null,
      amount: r.amount || 0,
      method: r.method || null,
      notes: r.notes || null,
      currency: r.currency || "USD",
    }));

    return res.json(cleaned);
  } catch (err) {
    console.error("Error fetching records:", err);
    return next(err);
  }
};

/**
 * POST /api/records
 * Body: {
 *   type: "expense" | "income",
 *   date: "YYYY-MM-DD",
 *   source?: string,
 *   category?: string,
 *   amount: number,
 *   method?: string,
 *   notes?: string,
 *   currency?: string
 * }
 */
exports.create = async (req, res, next) => {
  try {
    const payload = req.body || {};

    // Basic validation
    if (!payload.date || typeof payload.amount !== "number") {
      return res.status(400).json({
        error: "Missing required fields: 'date' (string) and 'amount' (number)",
      });
    }

    const record = await Record.create({
      type: payload.type || "expense",
      date: payload.date,
      source: payload.source || "",
      category: payload.category || "",
      amount: payload.amount,
      method: payload.method || "",
      notes: payload.notes || "",
      currency: payload.currency || "USD",
    });

    return res.status(201).json({
      _id: String(record._id),
      type: record.type,
      date: record.date,
      source: record.source,
      category: record.category,
      amount: record.amount,
      method: record.method,
      notes: record.notes,
      currency: record.currency,
    });
  } catch (err) {
    console.error("Error saving record:", err.message || err);
    return next(err);
  }
};
