/**
 * MongoDB connection helper.
 * Connects once at startup and provides a shared db instance.
 */

import { MongoClient } from "mongodb";

let client;
let db;

/**
 * Connect to MongoDB using the URI and DB name.
 * Also creates useful indexes for common collections.
 */
export async function connectMongo(uri, dbName) {
  if (!uri) throw new Error("❌ MONGO_URI missing");
  if (!dbName) throw new Error("❌ MONGO_DB missing");

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);

  console.log(`✅ Connected to MongoDB database: ${dbName}`);

  // Helpful indexes for performance and uniqueness
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("receipts").createIndex({ userId: 1, createdAt: -1 }),
    db.collection("records").createIndex({ userId: 1, date: -1 }),
  ]);

  return db;
}

/**
 * Retrieve the active database instance.
 * Throws an error if connectMongo() hasn’t been called.
 */
export function getDb() {
  if (!db) throw new Error("Database not initialized. Call connectMongo() first.");
  return db;
}

/**
 * Gracefully close the connection (for shutdowns or tests).
 */
export async function closeMongo() {
  if (client) {
    await client.close();
    console.log("🔒 MongoDB connection closed.");
  }
}
