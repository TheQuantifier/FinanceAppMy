// api/src/lib/gridfs.js
// Utilities for MongoDB GridFS: get bucket, upload buffers, stream downloads, and delete files.
// Uses the active Mongoose connection and a configurable bucket name ("uploads" by default).

const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");

let _bucket = null;

function getBucket() {
  if (_bucket) return _bucket;
  const conn = mongoose.connection;
  if (conn.readyState !== 1) {
    throw new Error("MongoDB not connected yet");
  }
  _bucket = new mongoose.mongo.GridFSBucket(conn.db, { bucketName: "uploads" });
  return _bucket;
}

function uploadBufferToGridFS(filename, buffer, { contentType, metadata } = {}) {
  return new Promise((resolve, reject) => {
    const bucket = getBucket();
    const uploadStream = bucket.openUploadStream(filename, { contentType, metadata });
    uploadStream.on("error", reject);
    uploadStream.on("finish", (file) => resolve({ fileId: file._id, filename: file.filename }));
    uploadStream.end(buffer);
  });
}

function openDownloadStream(fileId) {
  return getBucket().openDownloadStream(new ObjectId(String(fileId)));
}

function deleteFile(fileId) {
  return getBucket().delete(new ObjectId(String(fileId)));
}

module.exports = {
  getBucket,
  uploadBufferToGridFS,
  openDownloadStream,
  deleteFile,
};
