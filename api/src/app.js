// api/src/app.js
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const routes = require("./routes");
const errorHandler = require("./middlewares/error");
const { corsOrigin } = require("./config/env");
const mongoose = require("mongoose");

const app = express();

// Core middleware
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Basic health / root endpoints
app.get("/", (_req, res) => res.send("Finance Tracker API is live"));
app.get("/health", (_req, res) => {
  const ok = mongoose.connection.readyState === 1; // 1 = connected
  res.status(ok ? 200 : 503).json({ ok });
});

// Mount all API routes under /api
app.use("/api", routes);

// Centralized error handler (must be last)
app.use(errorHandler);

module.exports = app;
