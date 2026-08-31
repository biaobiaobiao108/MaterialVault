import { sqlite } from '../db/db';

export interface SearchFilters {
  q?: string;
  type?: string;
  organizationStatus?: 'inbox' | 'organized' | 'archived';
  tagId?: string;
  domain?: string;
  favorite?: boolean;
  startDate?: number;
  endDate?: number;
  limit?: number;
  offset?: number;
}

export function searchItems(filters: SearchFilters) {
  const {
    q,
    type,
    organizationStatus,
    tagId,
    domain,
    favorite,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  } = filters;

  const whereClauses: string[] = [];
  const params: any[] = [];
  const joins: string[] = [];

  // FTS5 Subquery Match
  if (q && q.trim()) {
    const rawTerms = q.trim().split(/\s+/).filter(Boolean);
    const cleaned = rawTerms
      .map((t) => t.replace(/["*]/g, ''))
      .filter((t) => t.length > 0);

    if (cleaned.length > 0) {
      const ftsQuery = cleaned.map((t) => `"${t}"*`).join(' AND ');
      whereClauses.push(
        `(i.id IN (SELECT id FROM items_fts WHERE items_fts MATCH ?) OR i.title LIKE ? OR i.content_text LIKE ? OR i.description LIKE ?)`
      );
      params.push(ftsQuery);
      params.push(`%${q.trim()}%`);
      params.push(`%${q.trim()}%`);
      params.push(`%${q.trim()}%`);
    }
  }

  if (type) {
    whereClauses.push(`i.type = ?`);
    params.push(type);
  }

  if (organizationStatus) {
    whereClauses.push(`i.organization_status = ?`);
    params.push(organizationStatus);
  }

  if (domain) {
    whereClauses.push(`i.source_domain LIKE ?`);
    params.push(`%${domain}%`);
  }

  if (favorite === true) {
    whereClauses.push(`i.favorite = 1`);
  }

  if (startDate) {
    whereClauses.push(`i.created_at >= ?`);
    params.push(startDate);
  }

  if (endDate) {
    whereClauses.push(`i.created_at <= ?`);
    params.push(endDate);
  }

  if (tagId) {
    joins.push(`JOIN item_tags itg ON itg.item_id = i.id`);
    whereClauses.push(`itg.tag_id = ?`);
    params.push(tagId);
  }

  let sql = `SELECT DISTINCT i.* FROM items i`;
  if (joins.length > 0) {
    sql += ` ` + joins.join(' ');
  }
  if (whereClauses.length > 0) {
    sql += ` WHERE ` + whereClauses.join(' AND ');
  }

  sql += ` ORDER BY i.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const results = sqlite.prepare(sql).all(...params) as any[];

  return results.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    description: r.description,
    sourceUrl: r.source_url,
    canonicalUrl: r.canonical_url,
    sourceDomain: r.source_domain,
    contentText: r.content_text,
    organizationStatus: r.organization_status,
    processingStatus: r.processing_status,
    favorite: Boolean(r.favorite),
    capturedAt: r.captured_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}
