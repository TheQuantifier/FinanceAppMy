/**
 * Simple email-based signup/login.
 * Returns a JWT and a minimal user payload.
 */

import { Router } from "express";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { getDb } from "../db/mongo.js";
import { createToken } from "../middleware/auth.js";

const router = Router();

const authSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional()
});

router.post("/signup-or-login", async (req, res) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { email, name } = parsed.data;
  const db = getDb();

  try {
    let user = await db.collection("users").findOne({ email });

    if (!user) {
      const now = new Date();
      const doc = {
        email,
        name: name || email.split("@")[0],
        createdAt: now,
        updatedAt: now
      };
      const { insertedId } = await db.collection("users").insertOne(doc);
      user = { _id: insertedId, ...doc };
    }

    const token = createToken(user);
    return res.json({
      token,
      user: {
        id: user._id instanceof ObjectId ? user._id.toString() : String(user._id),
        email: user.email,
        name: user.name
      }
    });
  } catch (err) {
    console.error("Auth error:", err);
    return res.status(500).json({ error: "Auth failed" });
  }
});

export default router;
