import { MongoClient } from 'mongodb';

let client;
let db;

export async function connectMongo(uri, dbName) {
  if (!uri) throw new Error('MONGO_URI missing');
  if (!dbName) throw new Error('MONGO_DB missing');
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  // helpful indexes
  await Promise.all([
    db.collection('users').createIndex({ email: 1 }, { unique: true }),
    db.collection('receipts').createIndex({ userId: 1, createdAt: -1 }),
    db.collection('records').createIndex({ userId: 1, date: -1 }),
  ]);
  return db;
}

export function getDb() {
  if (!db) throw new Error('DB not initialized');
  return db;
}
