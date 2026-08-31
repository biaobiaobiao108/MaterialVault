import { join, extname } from 'node:path';
import { existsSync } from 'node:fs';
import { db, ASSETS_DIR } from '../db';

export interface SaveAssetParams {
  itemId: string;
  kind: 'original' | 'thumbnail' | 'screenshot' | 'markdown';
  mimeType: string;
  fileName: string;
  data: Uint8Array | ArrayBuffer;
}

export async function saveAssetFile(params: SaveAssetParams) {
  const { itemId, kind, mimeType, fileName, data } = params;

  // Bun native SHA-256 hasher for zero-overhead physical deduplication
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(data);
  const fileHash = hasher.digest('hex');

  const ext = extname(fileName) || (mimeType.includes('image/jpeg') ? '.jpg' : mimeType.includes('image/png') ? '.png' : mimeType.includes('markdown') ? '.md' : '.bin');
  const storageFileName = `${fileHash}${ext}`;
  const absolutePath = join(ASSETS_DIR, storageFileName);
  const relativePath = `assets/${storageFileName}`;

  // Only write to disk if physical file with same sha256 doesn't exist yet
  if (!existsSync(absolutePath)) {
    await Bun.write(absolutePath, data);
  }

  const assetId = crypto.randomUUID();
  const now = Date.now();
  const fileSize = data.byteLength;

  db.prepare(`
    INSERT INTO assets (id, item_id, kind, mime_type, file_name, file_size, sha256, storage_path, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(assetId, itemId, kind, mimeType, fileName, fileSize, fileHash, relativePath, now);

  return {
    id: assetId,
    itemId,
    kind,
    mimeType,
    fileName,
    fileSize,
    fileHash,
    storagePath: relativePath,
    createdAt: now,
  };
}
