// api/src/app.js
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");

const routes = require("./routes");
const errorHandler = require("./middlewares/error");
const { corsOrigin } = require("./config/env");

const app = express();

/**
 * 1) Trust the Render proxy so Secure cookies are accepted by the browser.
 */
app.set("trust proxy", 1);

/**
 * 2) CORS: build a strict whitelist from env (comma-separated allowed origins).
 *    Examples:
 *      - local:  http://127.0.0.1:5500
 *      - prod:   https://webapp.thequantifier.com
 */
const ORIGINS = String(corsOrigin || "http://127.0.0.1:5500")
  .split(",")
  .map(s => s.trim());

const corsOptions = {
  origin(origin, cb) {
    // allow same-origin tools (no Origin header) and explicit whitelist
    if (!origin || ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET","HEAD","PUT","PATCH","POST","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// CORS MUST come before any routes/middleware
app.use(cors(corsOptions));
// Answer all preflights explicitly
app.options("*", cors(corsOptions));

/**
 * 3) Core parsers
 */
app.use(express.json());
app.use(cookieParser());

/**
 * 4) Health / root
 */
app.get("/", (_req, res) => res.send("Finance Tracker API is live"));
app.get("/health", (_req, res) => {
  const ok = mongoose.connection.readyState === 1; // 1 = connected
  res.status(ok ? 200 : 503).json({ ok });
});

/**
 * 5) API routes
 */
app.use("/api", routes);

/**
 * 6) Centralized error handler (keep CORS headers on errors too)
 */
app.use((err, req, res, next) => {
  try {
    const origin = req.headers.origin;
    if (origin && ORIGINS.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
  } catch {}
  return errorHandler(err, req, res, next);
});

module.exports = app;