import { db } from '../db/db';
import { assets } from '../db/schema';
import { eq } from 'drizzle-orm';
import { getAssetFilePath } from '../services/storage';
import fs from 'fs';
import { json } from '../utils';

export async function handleAssets(req: Request, url: URL, assetId: string): Promise<Response> {
  if (req.method !== 'GET') {
    return json({ error: 'Method Not Allowed' }, 405);
  }

  const asset = await db.query.assets.findFirst({
    where: eq(assets.id, assetId),
  });

  if (!asset) {
    return json({ error: '资源不存在' }, 404);
  }

  const filePath = getAssetFilePath(asset.storagePath);
  if (!fs.existsSync(filePath)) {
    return json({ error: '文件未在磁盘中找到' }, 404);
  }

  const file = Bun.file(filePath);
  return new Response(file, {
    headers: {
      'Content-Type': asset.mimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(asset.fileName)}"`,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
