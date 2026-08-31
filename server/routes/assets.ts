import { Hono } from 'hono';
import { db } from '../db/db';
import { assets } from '../db/schema';
import { eq } from 'drizzle-orm';
import { getAssetFilePath } from '../services/storage';
import fs from 'fs';

export const assetsRouter = new Hono();

assetsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const asset = await db.query.assets.findFirst({
    where: eq(assets.id, id),
  });

  if (!asset) {
    return c.json({ error: '资源不存在' }, 404);
  }

  const filePath = getAssetFilePath(asset.storagePath);
  if (!fs.existsSync(filePath)) {
    return c.json({ error: '文件未在磁盘中找到' }, 404);
  }

  const file = Bun.file(filePath);
  return new Response(file, {
    headers: {
      'Content-Type': asset.mimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(asset.fileName)}"`,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
});
