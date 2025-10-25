// api/src/server.js
const app = require("./app");
const { connectMongo } = require("./config/mongo");
const { port } = require("./config/env");

/**
 * Bootstraps the Finance App API
 * - Connects to MongoDB via Mongoose
 * - Starts the Express server
 */
(async () => {
  try {
    await connectMongo();

    app.listen(port, () => {
      console.log(`🚀 Finance App API running at http://localhost:${port}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
})();
