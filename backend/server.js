import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { connectMongo, getDb } from './src/db/mongo.js';
import authRouter from './src/routes/auth.js';
import receiptsRouter from './src/routes/receipts.js';
import recordsRouter from './src/routes/records.js';
import reportsRouter from './src/routes/reports.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Routers
app.use('/api/auth', authRouter);
app.use('/api/receipts', receiptsRouter);
app.use('/api/records', recordsRouter);
app.use('/api/reports', reportsRouter);

const PORT = process.env.PORT || 4000;

const start = async () => {
  await connectMongo(process.env.MONGO_URI, process.env.MONGO_DB);
  app.listen(PORT, () => console.log(`🚀 API listening on http://localhost:${PORT}`));
};

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
