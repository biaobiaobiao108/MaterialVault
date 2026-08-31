import path from 'path';
import { ASSETS_DIR, db } from '../db/db';
import { assets } from '../db/schema';

// High performance native Bun SHA-256 hasher
export function computeSha256(data: Buffer | Uint8Array | string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(data);
  return hasher.digest('hex');
}

export async function saveAssetFile({
  itemId,
  kind,
  mimeType,
  fileName,
  data,
}: {
  itemId: string;
  kind: 'original' | 'screenshot' | 'html' | 'markdown' | 'pdf' | 'thumbnail';
  mimeType: string;
  fileName: string;
  data: Buffer | Uint8Array | string;
}) {
  const buffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : Buffer.from(data);
  const sha256 = computeSha256(buffer);
  const ext = path.extname(fileName) || getExtensionFromMime(mimeType);
  const safeFileName = `${sha256}${ext}`;
  const filePath = path.join(ASSETS_DIR, safeFileName);

  const destinationFile = Bun.file(filePath);
  if (!(await destinationFile.exists())) {
    await Bun.write(filePath, buffer);
  }

  const assetId = crypto.randomUUID();
  const newAsset = {
    id: assetId,
    itemId,
    kind,
    mimeType,
    fileName,
    fileSize: buffer.length,
    sha256,
    storagePath: safeFileName,
    createdAt: Date.now(),
  };

  await db.insert(assets).values(newAsset);
  return newAsset;
}

export function getAssetFilePath(storagePath: string): string {
  return path.join(ASSETS_DIR, storagePath);
}

function getExtensionFromMime(mime: string): string {
  switch (mime) {
    case 'text/html':
      return '.html';
    case 'text/markdown':
      return '.md';
    case 'text/plain':
      return '.txt';
    case 'image/png':
      return '.png';
    case 'image/jpeg':
      return '.jpg';
    case 'image/webp':
      return '.webp';
    case 'application/pdf':
      return '.pdf';
    case 'video/mp4':
      return '.mp4';
    default:
      return '';
  }
}
