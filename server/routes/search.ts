import { db } from '../db';
import { json } from '../utils';
import { getFullItem } from './items';

export function handleSearch(req: Request): Response {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  const type = url.searchParams.get('type');
  const status = url.searchParams.get('status');
  const tagId = url.searchParams.get('tagId');
  const domain = url.searchParams.get('domain');
  const favorite = url.searchParams.get('favorite');
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const limit = Math.min(Number(url.searchParams.get('limit')) || 60, 200);
  const offset = Number(url.searchParams.get('offset')) || 0;

  const conditions: string[] = [];
  const params: any[] = [];

  // 1. FTS5 Search match or LIKE fallback
  if (q) {
    // Sanitize FTS5 query: replace quotes/special syntax
    const cleanQ = q.replace(/['"^*]/g, ' ').trim();
    if (cleanQ) {
      // Use subquery with FTS5 table
      conditions.push(`(
        items.rowid IN (SELECT rowid FROM items_fts WHERE items_fts MATCH ?)
        OR items.title LIKE ?
        OR items.description LIKE ?
        OR items.source_url LIKE ?
      )`);
      params.push(`"${cleanQ}"*`, `%${cleanQ}%`, `%${cleanQ}%`, `%${cleanQ}%`);
    }
  }

  // 2. Filters
  if (type) {
    conditions.push('items.type = ?');
    params.push(type);
  }
  if (status) {
    conditions.push('items.organization_status = ?');
    params.push(status);
  }
  if (domain) {
    conditions.push('items.source_domain LIKE ?');
    params.push(`%${domain}%`);
  }
  if (favorite === 'true' || favorite === '1') {
    conditions.push('items.favorite = 1');
  }
  if (tagId) {
    conditions.push('EXISTS (SELECT 1 FROM item_tags WHERE item_tags.item_id = items.id AND item_tags.tag_id = ?)');
    params.push(tagId);
  }
  if (startDate) {
    const s = Number(startDate);
    if (!isNaN(s) && s > 0) {
      conditions.push('items.created_at >= ?');
      params.push(s);
    }
  }
  if (endDate) {
    const e = Number(endDate);
    if (!isNaN(e) && e > 0) {
      conditions.push('items.created_at <= ?');
      params.push(e);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countRow: any = db.prepare(`SELECT COUNT(*) as total FROM items ${whereClause}`).get(...params);
  const totalCount = countRow?.total || 0;

  // Get items
  const query = `
    SELECT items.id FROM items
    ${whereClause}
    ORDER BY items.created_at DESC
    LIMIT ? OFFSET ?
  `;
  params.push(limit, offset);

  const rows: any[] = db.prepare(query).all(...params);
  const items = rows.map((r) => getFullItem(r.id)).filter(Boolean);

  return json({ items, count: totalCount });
}
