import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { db } from '../db';
import { error } from '../utils';

export function handleGetAsset(id: string): Response {
  const asset: any = db.prepare('SELECT * FROM assets WHERE id = ?').get(id);
  if (!asset) return error('资产不存在', 404);

  const filePath = join(process.cwd(), 'data', asset.storage_path);
  if (!existsSync(filePath)) {
    return error('资产物理文件丢失', 404);
  }

  const file = Bun.file(filePath);
  return new Response(file, {
    headers: {
      'Content-Type': asset.mime_type || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(asset.file_name)}"`,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
