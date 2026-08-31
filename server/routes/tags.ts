import { db } from '../db';
import { json, error } from '../utils';
import { getFullItem } from './items';

export function handleGetTags(): Response {
  const tags: any[] = db.prepare(`
    SELECT t.id, t.name, t.color, t.created_at as createdAt
    FROM tags t
    LEFT JOIN item_tags it ON t.id = it.tag_id
    GROUP BY t.id
    ORDER BY COUNT(it.item_id) DESC, t.name ASC
  `).all();

  // Attach itemCount
  const counts: Record<string, number> = {};
  const countRows: any[] = db.prepare(`SELECT tag_id, COUNT(*) as c FROM item_tags GROUP BY tag_id`).all();
  countRows.forEach((r) => { counts[r.tag_id] = r.c; });

  tags.forEach((t) => {
    t.itemCount = counts[t.id] || 0;
  });

  return json({ tags });
}

export async function handleCreateTag(req: Request): Promise<Response> {
  const body: any = await req.json().catch(() => ({}));
  const rawName = String(body.name || '').trim().replace(/^#/, '');
  if (!rawName) return error('标签名不能为空');

  const existing: any = db.prepare('SELECT id, name, color, created_at as createdAt FROM tags WHERE name = ?').get(rawName);
  if (existing) {
    return json({ tag: existing });
  }

  const tagId = crypto.randomUUID();
  const now = Date.now();
  const color = body.color || 'rose';

  db.prepare(`
    INSERT INTO tags (id, name, color, created_at)
    VALUES (?, ?, ?, ?)
  `).run(tagId, rawName, color, now);

  return json(
    {
      tag: {
        id: tagId,
        name: rawName,
        color,
        createdAt: now,
      },
    },
    201
  );
}

export async function handleUpdateTag(id: string, req: Request): Promise<Response> {
  const body: any = await req.json().catch(() => ({}));
  const tag: any = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
  if (!tag) return error('标签不存在', 404);

  const updates: string[] = [];
  const params: any[] = [];

  if (body.name !== undefined) {
    const rawName = String(body.name).trim().replace(/^#/, '');
    if (!rawName) return error('标签名不能为空');
    updates.push('name = ?');
    params.push(rawName);
  }
  if (body.color !== undefined) {
    updates.push('color = ?');
    params.push(String(body.color));
  }

  if (updates.length > 0) {
    params.push(id);
    try {
      db.prepare(`UPDATE tags SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    } catch (err: any) {
      return error(err.message || '更新标签失败（名称可能已存在）');
    }
  }

  const updated: any = db.prepare('SELECT id, name, color, created_at as createdAt FROM tags WHERE id = ?').get(id);
  return json({ tag: updated });
}

export function handleDeleteTag(id: string): Response {
  const tag: any = db.prepare('SELECT id FROM tags WHERE id = ?').get(id);
  if (!tag) return error('标签不存在', 404);

  db.prepare('DELETE FROM tags WHERE id = ?').run(id);
  return json({ success: true, id });
}

export async function handleLinkTag(itemId: string, req: Request): Promise<Response> {
  const body: any = await req.json().catch(() => ({}));
  const item = getFullItem(itemId);
  if (!item) return error('素材不存在', 404);

  let tagId = body.tagId;
  const now = Date.now();

  if (!tagId && body.tagName) {
    const rawName = String(body.tagName).trim().replace(/^#/, '');
    let tag: any = db.prepare('SELECT id FROM tags WHERE name = ?').get(rawName);
    if (!tag) {
      tagId = crypto.randomUUID();
      db.prepare('INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)').run(tagId, rawName, 'rose', now);
    } else {
      tagId = tag.id;
    }
  }

  if (!tagId) return error('缺少 tagId 或 tagName');

  try {
    db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id, created_at) VALUES (?, ?, ?)').run(itemId, tagId, now);
  } catch (_) {}

  const updated = getFullItem(itemId);
  return json({ item: updated });
}

export function handleUnlinkTag(itemId: string, tagId: string): Response {
  db.prepare('DELETE FROM item_tags WHERE item_id = ? AND tag_id = ?').run(itemId, tagId);
  const updated = getFullItem(itemId);
  return json({ item: updated });
}
