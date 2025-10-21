import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { getDb } from '../db/mongo.js';
import { ObjectId } from 'mongodb';

const router = Router();
const authSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional()
});

router.post('/signup-or-login', async (req, res) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, name } = parsed.data;
  const db = getDb();
  let user = await db.collection('users').findOne({ email });
  if (!user) {
    const now = new Date();
    const doc = { email, name: name || email.split('@')[0], createdAt: now, updatedAt: now };
    const { insertedId } = await db.collection('users').insertOne(doc);
    user = { _id: insertedId, ...doc };
  }
  const token = jwt.sign({ sub: user._id.toString(), email: user.email }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' });
  res.json({ token, user: { id: user._id.toString(), email: user.email, name: user.name } });
});

export default router;
