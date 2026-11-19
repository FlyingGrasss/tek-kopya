import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { ImageMime } from "../shared/constants.js";
import type { BlobMeta } from "../shared/types.js";
import type { AppDatabase } from "./db.js";

export interface BlobRow {
  id: string;
  mime: string;
  size: number;
  ref_count: number;
  created_at: number;
  path: string;
}

const BLOB_ID_PATTERN = /^[0-9a-f]{64}$/;

export function isValidBlobId(value: string): boolean {
  return BLOB_ID_PATTERN.test(value);
}

export function hashBytes(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function blobPath(blobsDir: string, id: string): string {
  if (!isValidBlobId(id)) {
    throw new Error(`Geçersiz blob kimliği: ${id}`);
  }
  return join(blobsDir, id);
}

export function relativeBlobPath(id: string): string {
  return `blobs/${id}`;
}

export function findBlob(db: AppDatabase, id: string): BlobRow | undefined {
  return db
    .prepare(
      "SELECT id, mime, size, ref_count, created_at, path FROM blobs WHERE id = ?",
    )
    .get(id) as BlobRow | undefined;
}

export function toBlobMeta(row: BlobRow): BlobMeta {
  return {
    id: row.id,
    mime: row.mime as ImageMime,
    size: row.size,
    refCount: row.ref_count,
    createdAt: row.created_at,
  };
}

/**
 * Writes the content-addressed file once. Concurrent requests are serialized
 * by the synchronous single-process server, so a simple exclusive temp file
 * followed by rename is enough.
 */
export function writeBlobFile(
  blobsDir: string,
  id: string,
  bytes: Buffer,
): void {
  mkdirSync(blobsDir, { recursive: true });
  const finalPath = blobPath(blobsDir, id);

  if (existsSync(finalPath)) {
    const existing = statSync(finalPath);
    if (existing.size !== bytes.length) {
      throw new Error(`Blob dosyası boyutu uyuşmuyor: ${id}`);
    }
    return;
  }

  const tempPath = `${finalPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(tempPath, bytes, { flag: "wx" });
    renameSync(tempPath, finalPath);
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw error;
  }
}

export function readBlobFile(blobsDir: string, id: string): Buffer {
  return readFileSync(blobPath(blobsDir, id));
}

export function removeBlobFile(blobsDir: string, id: string): boolean {
  try {
    rmSync(blobPath(blobsDir, id), { force: true });
    return true;
  } catch (error) {
    console.error(`[blobs] ${id} dosyası silinemedi:`, error);
    return false;
  }
}
