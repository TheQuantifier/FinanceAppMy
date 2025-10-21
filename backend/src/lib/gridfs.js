import fs from 'fs';
import { ObjectId, GridFSBucket } from 'mongodb';
import { getDb } from '../db/mongo.js';

export function getBucket() {
  const db = getDb();
  return new GridFSBucket(db, { bucketName: 'files' });
}

export async function saveFileFromDisk(localPath, filename, metadata = {}) {
  const bucket = getBucket();
  const uploadStream = bucket.openUploadStream(filename, { metadata });
  await new Promise((resolve, reject) => {
    fs.createReadStream(localPath)
      .pipe(uploadStream)
      .on('error', reject)
      .on('finish', resolve);
  });
  return uploadStream.id;
}

export function openDownloadStream(fileId) {
  const bucket = getBucket();
  return bucket.openDownloadStream(new ObjectId(fileId));
}
