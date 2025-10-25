// api/src/middlewares/error.js

/**
 * Centralized error-handling middleware.
 * Catches thrown or forwarded errors from routes and services.
 */
function errorHandler(err, _req, res, _next) {
  // Default values
  const status = err.status || 500;
  const message =
    typeof err === "string"
      ? err
      : err.message || "Internal Server Error";

  // Log internal details (stack shown only in dev)
  if (process.env.NODE_ENV !== "test") {
    console.error("❌ Error:", message);
    if (process.env.NODE_ENV !== "production" && err.stack)
      console.error(err.stack);
  }

  // Send consistent JSON response
  res.status(status).json({
    ok: false,
    error: message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
}

module.exports = errorHandler;
