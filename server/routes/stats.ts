import { db } from '../db';
import { json } from '../utils';

export function handleGetStats(): Response {
  const inboxRow: any = db.prepare(`SELECT COUNT(*) as count FROM items WHERE organization_status = 'inbox'`).get();
  const totalRow: any = db.prepare(`SELECT COUNT(*) as count FROM items`).get();
  const tagRow: any = db.prepare(`SELECT COUNT(*) as count FROM tags`).get();
  const assetRow: any = db.prepare(`SELECT COUNT(*) as count, coalesce(SUM(file_size), 0) as bytes FROM assets`).get();

  return json({
    inboxCount: inboxRow?.count || 0,
    totalItems: totalRow?.count || 0,
    tagCount: tagRow?.count || 0,
    assetCount: assetRow?.count || 0,
    storageBytes: assetRow?.bytes || 0,
  });
}

export function handleBackup(): Response {
  const items: any[] = db.prepare('SELECT * FROM items ORDER BY created_at ASC').all();
  const tags: any[] = db.prepare('SELECT * FROM tags ORDER BY name ASC').all();
  const itemTags: any[] = db.prepare('SELECT * FROM item_tags').all();
  const assets: any[] = db.prepare('SELECT * FROM assets').all();

  const backupData = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    items,
    tags,
    itemTags,
    assets,
  };

  return new Response(JSON.stringify(backupData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="material_vault_backup_${Date.now()}.json"`,
      'Access-Control-Allow-Origin': '*',
    },
  });
}
