import { db } from '../db';
import { json, error, cleanUrl, extractDomain, extractHashtags } from '../utils';
import { startCapturePipeline } from '../services/capture';
import { detectVideoInfo } from '../services/video';

export function getFullItem(id: string) {
  const item: any = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  if (!item) return null;

  // Format boolean and field names
  item.favorite = Boolean(item.favorite);
  item.capturedAt = item.captured_at;
  item.createdAt = item.created_at;
  item.updatedAt = item.updated_at;
  item.sourceUrl = item.source_url;
  item.canonicalUrl = item.canonical_url;
  item.sourceDomain = item.source_domain;
  item.contentText = item.content_text;
  item.organizationStatus = item.organization_status;
  item.processingStatus = item.processing_status;

  // Get Tags
  item.tags = db.prepare(`
    SELECT t.id, t.name, t.color, t.created_at as createdAt
    FROM tags t
    JOIN item_tags it ON t.id = it.tag_id
    WHERE it.item_id = ?
    ORDER BY t.name ASC
  `).all(id);

  // Get Assets
  item.assets = db.prepare(`
    SELECT id, item_id as itemId, kind, mime_type as mimeType, file_name as fileName,
           file_size as fileSize, sha256 as fileHash, storage_path as storagePath, created_at as createdAt
    FROM assets
    WHERE item_id = ?
    ORDER BY created_at ASC
  `).all(id);

  // Get Processing Logs
  item.processingLogs = db.prepare(`
    SELECT id, item_id as itemId, status, message, error_detail as errorDetail, created_at as createdAt
    FROM processing_logs
    WHERE item_id = ?
    ORDER BY created_at ASC
  `).all(id);

  return item;
}

export function handleGetItems(req: Request): Response {
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const type = url.searchParams.get('type');
  const favorite = url.searchParams.get('favorite');
  const tagId = url.searchParams.get('tagId');
  const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 200);
  const offset = Number(url.searchParams.get('offset')) || 0;

  const conditions: string[] = [];
  const params: any[] = [];

  if (status) {
    conditions.push('items.organization_status = ?');
    params.push(status);
  }
  if (type) {
    conditions.push('items.type = ?');
    params.push(type);
  }
  if (favorite === 'true' || favorite === '1') {
    conditions.push('items.favorite = 1');
  }
  if (tagId) {
    conditions.push('EXISTS (SELECT 1 FROM item_tags WHERE item_tags.item_id = items.id AND item_tags.tag_id = ?)');
    params.push(tagId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `
    SELECT items.id FROM items
    ${whereClause}
    ORDER BY items.created_at DESC
    LIMIT ? OFFSET ?
  `;
  params.push(limit, offset);

  const rows: any[] = db.prepare(query).all(...params);
  const items = rows.map((r) => getFullItem(r.id)).filter(Boolean);

  return json({ items });
}

export function handleGetItem(id: string): Response {
  const item = getFullItem(id);
  if (!item) return error('素材不存在', 404);
  return json({ item });
}

export async function handleCaptureUrl(req: Request): Promise<Response> {
  const body: any = await req.json().catch(() => ({}));
  let targetUrl = String(body.url || '').trim();
  if (!targetUrl) return error('URL 不能为空');

  targetUrl = cleanUrl(targetUrl);
  const domain = extractDomain(targetUrl);

  // Detect if video
  const videoInfo = await detectVideoInfo(targetUrl);
  const itemType = videoInfo ? 'video' : 'url';

  // Check duplicate
  const existing: any = db.prepare(`
    SELECT id FROM items WHERE source_url = ? OR canonical_url = ? LIMIT 1
  `).get(targetUrl, targetUrl);

  if (existing) {
    const full = getFullItem(existing.id);
    return json({ item: full, isDuplicate: true }, 200);
  }

  const itemId = crypto.randomUUID();
  const now = Date.now();
  const title = body.title ? String(body.title).trim() : domain ? `来自 ${domain} 的网页` : targetUrl;
  const description = body.description ? String(body.description).trim() : '';

  db.prepare(`
    INSERT INTO items (
      id, type, title, description, source_url, canonical_url, source_domain,
      organization_status, processing_status, favorite, captured_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'inbox', 'pending', 0, ?, ?, ?)
  `).run(itemId, itemType, title, description, targetUrl, targetUrl, domain, now, now, now);

  // Link explicit tags
  if (Array.isArray(body.tagIds)) {
    for (const tagId of body.tagIds) {
      try {
        db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id, created_at) VALUES (?, ?, ?)').run(itemId, tagId, now);
      } catch (_) {}
    }
  }

  // Auto-extract tags from text
  const hashtags = extractHashtags(`${title} ${description}`);
  for (const name of hashtags) {
    let tag: any = db.prepare('SELECT id FROM tags WHERE name = ?').get(name);
    if (!tag) {
      const tagId = crypto.randomUUID();
      db.prepare(`INSERT INTO tags (id, name, color, created_at, updated_at) VALUES (?, ?, 'rose', ?, ?)`).run(tagId, name, now, now);
      tag = { id: tagId };
    }
    try {
      db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id, created_at) VALUES (?, ?, ?)').run(itemId, tag.id, now);
    } catch (_) {}
  }

  // Trigger background capture pipeline (non-blocking)
  setTimeout(() => {
    startCapturePipeline(itemId, targetUrl);
  }, 10);

  const full = getFullItem(itemId);
  return json({ item: full, isDuplicate: false }, 202);
}

export async function handleCreateNote(req: Request): Promise<Response> {
  const body: any = await req.json().catch(() => ({}));
  const rawContent = String(body.content || '').trim();
  if (!rawContent) return error('备忘内容不能为空');

  const lines = rawContent.split('\n');
  const firstLine = lines.find((l) => l.trim().length > 0) || '新建灵感备忘';
  const firstLineIdx = lines.indexOf(firstLine);
  const title = body.title ? String(body.title).trim() : firstLine.trim();
  const description = lines.slice(firstLineIdx + 1).join('\n').trim();

  const itemId = crypto.randomUUID();
  const now = Date.now();

  db.prepare(`
    INSERT INTO items (
      id, type, title, description, content_text, organization_status, processing_status,
      favorite, captured_at, created_at, updated_at
    ) VALUES (?, 'note', ?, ?, ?, 'inbox', 'ready', 0, ?, ?, ?)
  `).run(itemId, title, description, rawContent, now, now, now);

  // Link explicit tags
  if (Array.isArray(body.tagIds)) {
    for (const tagId of body.tagIds) {
      try {
        db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id, created_at) VALUES (?, ?, ?)').run(itemId, tagId, now);
      } catch (_) {}
    }
  }

  // Auto-extract tags from note text
  const hashtags = extractHashtags(rawContent);
  for (const name of hashtags) {
    let tag: any = db.prepare('SELECT id FROM tags WHERE name = ?').get(name);
    if (!tag) {
      const tagId = crypto.randomUUID();
      db.prepare(`INSERT INTO tags (id, name, color, created_at, updated_at) VALUES (?, ?, 'rose', ?, ?)`).run(tagId, name, now, now);
      tag = { id: tagId };
    }
    try {
      db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id, created_at) VALUES (?, ?, ?)').run(itemId, tag.id, now);
    } catch (_) {}
  }

  const full = getFullItem(itemId);
  return json({ item: full }, 201);
}

export async function handleUpdateItem(id: string, req: Request): Promise<Response> {
  const body: any = await req.json().catch(() => ({}));
  const item = getFullItem(id);
  if (!item) return error('素材不存在', 404);

  const updates: string[] = [];
  const params: any[] = [];
  const now = Date.now();

  if (body.title !== undefined) {
    updates.push('title = ?');
    params.push(String(body.title).trim());
  }
  if (body.description !== undefined) {
    updates.push('description = ?');
    params.push(String(body.description).trim());
  }
  if (body.organizationStatus !== undefined) {
    updates.push('organization_status = ?');
    params.push(String(body.organizationStatus));
  }
  if (body.favorite !== undefined) {
    updates.push('favorite = ?');
    params.push(body.favorite ? 1 : 0);
  }

  if (updates.length > 0) {
    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    db.prepare(`UPDATE items SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  const updated = getFullItem(id);
  return json({ item: updated });
}

export function handleDeleteItem(id: string): Response {
  const item = getFullItem(id);
  if (!item) return error('素材不存在', 404);

  db.prepare('DELETE FROM items WHERE id = ?').run(id);
  return json({ success: true, id });
}

export function handleRetryItem(id: string): Response {
  const item: any = db.prepare('SELECT id, type, source_url FROM items WHERE id = ?').get(id);
  if (!item) return error('素材不存在', 404);

  if (item.type !== 'url' && item.type !== 'video') {
    return error('仅支持 URL / 视频类型的素材重新抓取');
  }

  setTimeout(() => {
    startCapturePipeline(item.id, item.source_url);
  }, 10);

  return json({ message: '已重新触发后台抓取流水线' });
}

export async function handleBatchAction(req: Request): Promise<Response> {
  const body: any = await req.json().catch(() => ({}));
  const itemIds: string[] = Array.isArray(body.itemIds) ? body.itemIds : [];
  const action = String(body.action || '');

  if (itemIds.length === 0) return error('未选择任何素材');

  const now = Date.now();
  let count = 0;

  for (const id of itemIds) {
    if (action === 'set_status' && body.status) {
      db.prepare('UPDATE items SET organization_status = ?, updated_at = ? WHERE id = ?').run(body.status, now, id);
      count++;
    } else if (action === 'favorite') {
      db.prepare('UPDATE items SET favorite = 1, updated_at = ? WHERE id = ?').run(now, id);
      count++;
    } else if (action === 'unfavorite') {
      db.prepare('UPDATE items SET favorite = 0, updated_at = ? WHERE id = ?').run(now, id);
      count++;
    } else if (action === 'delete') {
      db.prepare('DELETE FROM items WHERE id = ?').run(id);
      count++;
    } else if (action === 'add_tag' && body.tagId) {
      try {
        db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id, created_at) VALUES (?, ?, ?)').run(id, body.tagId, now);
        count++;
      } catch (_) {}
    } else if (action === 'remove_tag' && body.tagId) {
      db.prepare('DELETE FROM item_tags WHERE item_id = ? AND tag_id = ?').run(id, body.tagId);
      count++;
    }
  }

  return json({ success: true, count });
}
