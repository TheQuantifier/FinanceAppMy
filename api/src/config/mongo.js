// api/src/config/mongo.js
const mongoose = require("mongoose");
const { mongoUri, mongoDb } = require("./env");

/**
 * Handles MongoDB connection via Mongoose.
 * Connects once and reuses the same connection.
 */

let connected = false;

async function connectMongo() {
  if (connected) return mongoose.connection;

  try {
    await mongoose.connect(mongoUri, {
      dbName: mongoDb,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 8000,
    });

    connected = true;
    console.log(`✅ Mongoose connected → database: ${mongoDb}`);
    return mongoose.connection;
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  }
}

async function closeMongo() {
  try {
    if (connected) {
      await mongoose.connection.close();
      connected = false;
      console.log("🔌 Mongoose connection closed");
    }
  } catch (err) {
    console.error("Error closing MongoDB connection:", err.message);
  }
}

function getDb() {
  if (!connected) throw new Error("MongoDB not connected. Call connectMongo() first.");
  return mongoose.connection.db;
}

module.exports = { connectMongo, closeMongo, getDb };
