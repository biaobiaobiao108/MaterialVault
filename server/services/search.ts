import { sqlite } from '../db/db';

export interface SearchOptions {
  q?: string;
  type?: string;
  organizationStatus?: 'inbox' | 'organized' | 'archived';
  topicId?: string;
  tagId?: string;
  domain?: string;
  favorite?: boolean;
  startDate?: number;
  endDate?: number;
  limit?: number;
  offset?: number;
}

export function searchItems(options: SearchOptions) {
  const {
    q,
    type,
    organizationStatus,
    topicId,
    tagId,
    domain,
    favorite,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  } = options;

  let querySql = `
    SELECT DISTINCT 
      i.id,
      i.type,
      i.title,
      i.description,
      i.source_url as sourceUrl,
      i.canonical_url as canonicalUrl,
      i.source_domain as sourceDomain,
      i.organization_status as organizationStatus,
      i.processing_status as processingStatus,
      i.favorite,
      i.captured_at as capturedAt,
      i.created_at as createdAt,
      i.updated_at as updatedAt
  `;

  const params: any[] = [];
  const joins: string[] = [];
  const whereClauses: string[] = [];

  if (q && q.trim()) {
    const rawTerm = q.trim();
    const sanitizedQ = rawTerm.replace(/"/g, '""');
    const tokens = sanitizedQ
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => `"${t}"*`)
      .join(' ');

    whereClauses.push(
      `(i.id IN (SELECT id FROM items_fts WHERE items_fts MATCH ?) OR i.title LIKE ? OR i.content_text LIKE ? OR i.description LIKE ? OR i.source_url LIKE ?)`
    );
    params.push(tokens, `%${rawTerm}%`, `%${rawTerm}%`, `%${rawTerm}%`, `%${rawTerm}%`);
  }

  if (topicId) {
    joins.push(`JOIN item_topics it ON it.item_id = i.id`);
    whereClauses.push(`it.topic_id = ?`);
    params.push(topicId);
  }

  if (tagId) {
    joins.push(`JOIN item_tags itg ON itg.item_id = i.id`);
    whereClauses.push(`itg.tag_id = ?`);
    params.push(tagId);
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

  if (favorite !== undefined) {
    whereClauses.push(`i.favorite = ?`);
    params.push(favorite ? 1 : 0);
  }

  if (startDate) {
    whereClauses.push(`i.created_at >= ?`);
    params.push(startDate);
  }

  if (endDate) {
    whereClauses.push(`i.created_at <= ?`);
    params.push(endDate);
  }

  querySql += ` FROM items i ` + joins.join(' ');

  if (whereClauses.length > 0) {
    querySql += ` WHERE ` + whereClauses.join(' AND ');
  }

  querySql += ` ORDER BY i.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const stmt = sqlite.prepare(querySql);
  const rows = stmt.all(...params) as any[];

  // Convert SQLite boolean integer 0/1 to boolean
  return rows.map((r) => ({
    ...r,
    favorite: Boolean(r.favorite),
  }));
}
