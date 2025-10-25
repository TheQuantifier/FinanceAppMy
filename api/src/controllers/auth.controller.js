// api/src/controllers/auth.controller.js
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { jwtSecret } = require("../config/env");

/** Helper to set auth cookie consistently */
function setAuthCookie(res, token) {
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // requires HTTPS in prod
    sameSite: "lax",
    maxAge: 2 * 60 * 60 * 1000, // 2 hours
  });
}

exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name: name.trim(), email: normalizedEmail, passwordHash });

    const token = jwt.sign({ id: user._id, email: user.email }, jwtSecret, { expiresIn: "2h" });
    setAuthCookie(res, token);

    return res.status(201).json({
      message: "User registered",
      user: { id: String(user._id), name: user.name, email: user.email },
    });
  } catch (err) {
    return next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id, email: user.email }, jwtSecret, { expiresIn: "2h" });
    setAuthCookie(res, token);

    return res.json({
      message: "Login successful",
      user: { id: String(user._id), name: user.name, email: user.email },
    });
  } catch (err) {
    return next(err);
  }
};

exports.me = async (req, res, next) => {
  try {
    // req.user is set by requireAuth middleware
    const me = await User.findById(req.user.id).select("-passwordHash");
    if (!me) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.json(me);
  } catch (err) {
    return next(err);
  }
};

exports.logout = async (_req, res, _next) => {
  // Clear auth cookie
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  return res.json({ message: "Logged out" });
};
