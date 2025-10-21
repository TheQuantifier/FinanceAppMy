/**
 * GridFS utilities for storing and retrieving files.
 * Used by the receipts upload and download endpoints.
 */

import fs from "fs";
import { ObjectId, GridFSBucket } from "mongodb";
import { getDb } from "../db/mongo.js";

/**
 * Create or retrieve the active GridFS bucket.
 */
export function getBucket() {
  const db = getDb();
  return new GridFSBucket(db, { bucketName: "files" });
}

/**
 * Save a local file (from multer temp upload) into GridFS.
 * @param {string} localPath - Path to the local file.
 * @param {string} filename - Original filename.
 * @param {object} metadata - Optional metadata (userId, mimetype, etc.)
 * @returns {Promise<ObjectId>} The new GridFS file ID.
 */
export async function saveFileFromDisk(localPath, filename, metadata = {}) {
  const bucket = getBucket();
  const uploadStream = bucket.openUploadStream(filename, { metadata });

  await new Promise((resolve, reject) => {
    fs.createReadStream(localPath)
      .pipe(uploadStream)
      .on("error", reject)
      .on("finish", resolve);
  });

  return uploadStream.id;
}

/**
 * Open a readable stream for downloading a file by its ObjectId.
 */
export function openDownloadStream(fileId) {
  const bucket = getBucket();
  return bucket.openDownloadStream(new ObjectId(fileId));
}

/**
 * Delete a file from GridFS (optional utility for later).
 */
export async function deleteFile(fileId) {
  const bucket = getBucket();
  await bucket.delete(new ObjectId(fileId));
  console.log(`🗑️ Deleted GridFS file ${fileId}`);
}
