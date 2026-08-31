import { z } from 'zod';
import crypto from 'crypto';
import { db, sqlite } from '../db/db';
import { items, itemTags, assets, ingestionLogs, tags } from '../db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { normalizeUrl, processUrlItem } from '../services/capture';
import { json, parseJsonBody } from '../utils';

// Helper to extract hashtags from any text: #标签名 #tech #ai_123
export function extractHashtags(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu);
  if (!matches) return [];

  const tagSet = new Set<string>();
  for (const m of matches) {
    const cleaned = m.trim().replace(/^#/, '').trim();
    if (cleaned.length > 0) {
      tagSet.add(cleaned);
    }
  }
  return Array.from(tagSet);
}

// Helper to ensure tag exists and link to item
export async function syncItemTags(itemId: string, explicitTagIds: string[] = [], textToScan = '') {
  const extractedTagNames = extractHashtags(textToScan);
  const now = Date.now();
  const finalTagIds = new Set<string>(explicitTagIds.filter(Boolean));

  for (const name of extractedTagNames) {
    let existing = await db.query.tags.findFirst({
      where: eq(tags.name, name),
    });

    if (!existing) {
      const newTagId = crypto.randomUUID();
      await db.insert(tags).values({
        id: newTagId,
        name,
        color: 'stone',
        createdAt: now,
      });
      finalTagIds.add(newTagId);
    } else {
      finalTagIds.add(existing.id);
    }
  }

  // Insert links
  for (const tagId of finalTagIds) {
    try {
      await db.insert(itemTags).values({ itemId, tagId, createdAt: now });
    } catch (_) {}
  }
}

// Helper to fetch item with associated tags, assets, and logs
export async function getFullItem(id: string) {
  const item = await db.query.items.findFirst({
    where: eq(items.id, id),
  });
  if (!item) return null;

  // Fetch tags
  const tagList = sqlite
    .prepare(
      `SELECT tg.* FROM tags tg JOIN item_tags itg ON itg.tag_id = tg.id WHERE itg.item_id = ?`
    )
    .all(id);

  // Fetch assets
  const assetList = await db.query.assets.findMany({
    where: eq(assets.itemId, id),
    orderBy: [desc(assets.createdAt)],
  });

  // Fetch logs
  const logList = await db.query.ingestionLogs.findMany({
    where: eq(ingestionLogs.itemId, id),
    orderBy: [desc(ingestionLogs.createdAt)],
  });

  return {
    ...item,
    favorite: Boolean(item.favorite),
    tags: tagList,
    assets: assetList,
    logs: logList,
  };
}

export async function handleItems(req: Request, url: URL, subPath: string): Promise<Response> {
  const method = req.method;

  // 1. Capture URL: POST /api/items/url
  if (method === 'POST' && subPath === 'url') {
    const body = await parseJsonBody(req);
    const schema = z.object({
      url: z.string().min(1),
      title: z.string().optional(),
      description: z.string().optional(),
      tagIds: z.array(z.string()).optional(),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return json({ error: '无效请求参数', details: parsed.error.format() }, 400);
    }

    const { url: rawUrl, title, description, tagIds } = parsed.data;
    const { url: normalized, domain } = normalizeUrl(rawUrl);

    // Check duplicate URL
    const existing = await db.query.items.findFirst({
      where: eq(items.canonicalUrl, normalized),
    });

    if (existing) {
      await syncItemTags(existing.id, tagIds || [], `${title || ''} ${description || ''}`);
      const full = await getFullItem(existing.id);
      return json({ item: full, isDuplicate: true }, 200);
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    const newItem = {
      id,
      type: 'url' as const,
      title: title?.trim() || normalized,
      description: description?.trim() || '',
      sourceUrl: rawUrl,
      canonicalUrl: normalized,
      sourceDomain: domain,
      contentText: '',
      organizationStatus: 'inbox' as const,
      processingStatus: 'pending' as const,
      favorite: false,
      capturedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(items).values(newItem);

    // Link & extract tags from text
    await syncItemTags(id, tagIds || [], `${title || ''} ${description || ''}`);

    setTimeout(() => {
      processUrlItem(id, normalized).catch((err) => console.error('Capture pipeline error:', err));
    }, 10);

    const full = await getFullItem(id);
    return json({ item: full, isDuplicate: false }, 202);
  }

  // 2. Create Note: POST /api/items/note
  if (method === 'POST' && subPath === 'note') {
    const body = await parseJsonBody(req);
    const schema = z.object({
      title: z.string().optional(),
      content: z.string().min(1),
      tagIds: z.array(z.string()).optional(),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return json({ error: '请填写备忘内容', details: parsed.error.format() }, 400);
    }

    const { title, content, tagIds } = parsed.data;
    const id = crypto.randomUUID();
    const now = Date.now();

    const lines = content.trim().split('\n');
    const derivedTitle = title?.trim() || lines[0].slice(0, 60) || '未命名备忘';
    const derivedDesc = lines.length > 1 ? lines.slice(1).join('\n').trim() : '';

    const newItem = {
      id,
      type: 'note' as const,
      title: derivedTitle,
      description: derivedDesc,
      sourceUrl: null,
      canonicalUrl: null,
      sourceDomain: null,
      contentText: content.trim(),
      organizationStatus: 'inbox' as const,
      processingStatus: 'ready' as const,
      favorite: false,
      capturedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(items).values(newItem);

    // Auto extract #tags from entire content & title
    await syncItemTags(id, tagIds || [], `${derivedTitle} ${content}`);

    const full = await getFullItem(id);
    return json({ item: full }, 201);
  }

  // 3. Batch operations: POST /api/items/batch
  if (method === 'POST' && subPath === 'batch') {
    const body = await parseJsonBody(req);
    const schema = z.object({
      itemIds: z.array(z.string()).min(1),
      action: z.enum(['set_status', 'add_tag', 'remove_tag', 'favorite', 'unfavorite', 'delete']),
      status: z.enum(['inbox', 'organized', 'archived']).optional(),
      tagId: z.string().optional(),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return json({ error: '无效批量请求参数' }, 400);
    }

    const { itemIds, action, status, tagId } = parsed.data;

    switch (action) {
      case 'set_status':
        if (status) {
          await db.update(items).set({ organizationStatus: status, updatedAt: Date.now() }).where(inArray(items.id, itemIds));
        }
        break;
      case 'favorite':
        await db.update(items).set({ favorite: true, updatedAt: Date.now() }).where(inArray(items.id, itemIds));
        break;
      case 'unfavorite':
        await db.update(items).set({ favorite: false, updatedAt: Date.now() }).where(inArray(items.id, itemIds));
        break;
      case 'delete':
        await db.delete(items).where(inArray(items.id, itemIds));
        break;
      case 'add_tag':
        if (tagId) {
          for (const itemId of itemIds) {
            try {
              await db.insert(itemTags).values({ itemId, tagId, createdAt: Date.now() });
            } catch (_) {}
          }
        }
        break;
      case 'remove_tag':
        if (tagId) {
          await db.delete(itemTags).where(inArray(itemTags.itemId, itemIds));
        }
        break;
    }

    return json({ success: true, count: itemIds.length });
  }

  // 4. Retry Ingestion: POST /api/items/:id/retry
  if (method === 'POST' && subPath.endsWith('/retry')) {
    const id = subPath.replace(/\/retry$/, '');
    const item = await db.query.items.findFirst({ where: eq(items.id, id) });
    if (!item) return json({ error: '素材不存在' }, 404);
    if (item.type !== 'url' || !item.sourceUrl) {
      return json({ error: '仅支持 URL 类型的素材重新抓取' }, 400);
    }

    setTimeout(() => {
      processUrlItem(id, item.canonicalUrl || item.sourceUrl!).catch(console.error);
    }, 10);

    return json({ message: '重新归档任务已提交' });
  }

  // 5. Link / Unlink Tag: POST/DELETE /api/items/:id/tags...
  if (subPath.includes('/tags')) {
    const parts = subPath.split('/tags');
    const itemId = parts[0];
    const rest = parts[1] ? parts[1].replace(/^\//, '') : '';

    if (method === 'POST') {
      const body = await parseJsonBody(req);
      let targetTagId = body?.tagId;
      const tagName = body?.tagName;

      if (!targetTagId && tagName) {
        const cleanedName = tagName.trim().replace(/^#/, '');
        const existing = await db.query.tags.findFirst({ where: eq(tags.name, cleanedName) });
        if (existing) {
          targetTagId = existing.id;
        } else {
          targetTagId = crypto.randomUUID();
          await db.insert(tags).values({
            id: targetTagId,
            name: cleanedName,
            color: 'stone',
            createdAt: Date.now(),
          });
        }
      }

      if (!targetTagId) return json({ error: '缺少 tagId 或 tagName' }, 400);

      try {
        await db.insert(itemTags).values({ itemId, tagId: targetTagId, createdAt: Date.now() });
      } catch (_) {}

      const full = await getFullItem(itemId);
      return json({ item: full });
    }

    if (method === 'DELETE' && rest) {
      const tagId = rest;
      const { and } = await import('drizzle-orm');
      await db.delete(itemTags).where(and(eq(itemTags.itemId, itemId), eq(itemTags.tagId, tagId)));
      const full = await getFullItem(itemId);
      return json({ item: full });
    }
  }

  // 6. Get single Item: GET /api/items/:id
  if (method === 'GET' && subPath) {
    const item = await getFullItem(subPath);
    if (!item) return json({ error: '素材不存在' }, 404);
    return json({ item });
  }

  // 7. Update Item: PATCH /api/items/:id
  if (method === 'PATCH' && subPath) {
    const body = await parseJsonBody(req);
    const schema = z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      contentText: z.string().optional(),
      organizationStatus: z.enum(['inbox', 'organized', 'archived']).optional(),
      favorite: z.boolean().optional(),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return json({ error: '无效更新参数' }, 400);
    }

    const updates: any = {
      ...parsed.data,
      updatedAt: Date.now(),
    };

    await db.update(items).set(updates).where(eq(items.id, subPath));

    // Auto extract #tags from updated title/description/content
    const textToScan = `${parsed.data.title || ''} ${parsed.data.description || ''} ${parsed.data.contentText || ''}`;
    if (textToScan.includes('#')) {
      await syncItemTags(subPath, [], textToScan);
    }

    const full = await getFullItem(subPath);
    return json({ item: full });
  }

  // 8. Delete Item: DELETE /api/items/:id
  if (method === 'DELETE' && subPath) {
    await db.delete(items).where(eq(items.id, subPath));
    return json({ success: true, id: subPath });
  }

  // 9. List items: GET /api/items
  if (method === 'GET' && !subPath) {
    const status = url.searchParams.get('status') as any;
    const type = url.searchParams.get('type');
    const favorite = url.searchParams.get('favorite');
    const tagId = url.searchParams.get('tagId');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    let querySql = `SELECT DISTINCT i.* FROM items i`;
    const joins: string[] = [];
    const where: string[] = [];
    const params: any[] = [];

    if (tagId) {
      joins.push('JOIN item_tags itg ON itg.item_id = i.id');
      where.push('itg.tag_id = ?');
      params.push(tagId);
    }

    if (status) {
      where.push('i.organization_status = ?');
      params.push(status);
    }

    if (type) {
      where.push('i.type = ?');
      params.push(type);
    }

    if (favorite === 'true' || favorite === '1') {
      where.push('i.favorite = 1');
    }

    querySql += ' ' + joins.join(' ');
    if (where.length > 0) {
      querySql += ' WHERE ' + where.join(' AND ');
    }
    querySql += ' ORDER BY i.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rawItems = sqlite.prepare(querySql).all(...params) as any[];
    const itemIds = rawItems.map((r) => r.id);
    let tagsByItem: Record<string, any[]> = {};
    let assetsByItem: Record<string, any[]> = {};

    if (itemIds.length > 0) {
      const placeholders = itemIds.map(() => '?').join(',');

      const tagLinks = sqlite
        .prepare(
          `SELECT itg.item_id, tg.* FROM tags tg JOIN item_tags itg ON itg.tag_id = tg.id WHERE itg.item_id IN (${placeholders})`
        )
        .all(...itemIds) as any[];
      tagLinks.forEach((tg) => {
        if (!tagsByItem[tg.item_id]) tagsByItem[tg.item_id] = [];
        tagsByItem[tg.item_id].push({ id: tg.id, name: tg.name, color: tg.color });
      });

      const assetRows = sqlite
        .prepare(
          `SELECT id, item_id, kind, mime_type, file_name, file_size, storage_path, created_at FROM assets WHERE item_id IN (${placeholders})`
        )
        .all(...itemIds) as any[];
      assetRows.forEach((a) => {
        if (!assetsByItem[a.item_id]) assetsByItem[a.item_id] = [];
        assetsByItem[a.item_id].push(a);
      });
    }

    const result = rawItems.map((r) => ({
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
      tags: tagsByItem[r.id] || [],
      assets: assetsByItem[r.id] || [],
    }));

    return json({ items: result });
  }

  return json({ error: 'Not Found' }, 404);
}
