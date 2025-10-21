/**
 * Finance Web App Backend
 * Node.js + Express + MongoDB + GridFS
 * ------------------------------------
 * Handles user auth, receipts (file uploads), records, and reports.
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import { connectMongo } from "./src/db/mongo.js";
import authRouter from "./src/routes/auth.js";
import receiptsRouter from "./src/routes/receipts.js";
import recordsRouter from "./src/routes/records.js";
import reportsRouter from "./src/routes/reports.js";

// Resolve dirname (since we're using ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// -------- ROUTES --------
app.get("/api/health", (_req, res) => res.json({ ok: true, timestamp: new Date() }));
app.use("/api/auth", authRouter);
app.use("/api/receipts", receiptsRouter);
app.use("/api/records", recordsRouter);
app.use("/api/reports", reportsRouter);

// -------- START SERVER --------
const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    await connectMongo(process.env.MONGO_URI, process.env.MONGO_DB);
    app.listen(PORT, () => {
      console.log(`🚀 Finance API running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
