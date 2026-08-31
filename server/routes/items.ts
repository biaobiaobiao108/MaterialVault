import { Hono } from 'hono';
import { z } from 'zod';
import crypto from 'crypto';
import { db, sqlite } from '../db/db';
import { items, itemTopics, itemTags, assets, ingestionLogs } from '../db/schema';
import { eq, desc, inArray, and } from 'drizzle-orm';
import { normalizeUrl, processUrlItem } from '../services/capture';

export const itemsRouter = new Hono();

// Helper to fetch item with associated topics, tags, and assets
export async function getFullItem(id: string) {
  const item = await db.query.items.findFirst({
    where: eq(items.id, id),
  });
  if (!item) return null;

  // Fetch topics
  const topicList = sqlite
    .prepare(
      `SELECT t.* FROM topics t JOIN item_topics it ON it.topic_id = t.id WHERE it.item_id = ?`
    )
    .all(id);

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
    topics: topicList,
    tags: tagList,
    assets: assetList,
    logs: logList,
  };
}

// 1. Capture URL
itemsRouter.post('/url', async (c) => {
  const body = await c.req.json();
  const schema = z.object({
    url: z.string().min(1),
    title: z.string().optional(),
    description: z.string().optional(),
    topicIds: z.array(z.string()).optional(),
    tagIds: z.array(z.string()).optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: '无效请求参数', details: parsed.error.format() }, 400);
  }

  const { url, title, description, topicIds, tagIds } = parsed.data;
  const { url: normalized, domain } = normalizeUrl(url);

  // Check duplicate URL
  const existing = await db.query.items.findFirst({
    where: eq(items.canonicalUrl, normalized),
  });

  if (existing) {
    // If exists, optionally link topics/tags and return 200 with existing item
    if (topicIds && topicIds.length > 0) {
      for (const tId of topicIds) {
        try {
          await db.insert(itemTopics).values({ itemId: existing.id, topicId: tId, createdAt: Date.now() });
        } catch (_) {}
      }
    }
    const full = await getFullItem(existing.id);
    return c.json({ item: full, isDuplicate: true }, 200);
  }

  const id = crypto.randomUUID();
  const now = Date.now();

  const newItem = {
    id,
    type: 'url' as const,
    title: title?.trim() || normalized,
    description: description?.trim() || '',
    sourceUrl: url,
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

  // Link topics
  if (topicIds && topicIds.length > 0) {
    for (const tId of topicIds) {
      try {
        await db.insert(itemTopics).values({ itemId: id, topicId: tId, createdAt: now });
      } catch (_) {}
    }
  }

  // Link tags
  if (tagIds && tagIds.length > 0) {
    for (const tagId of tagIds) {
      try {
        await db.insert(itemTags).values({ itemId: id, tagId, createdAt: now });
      } catch (_) {}
    }
  }

  // Trigger background capture asynchronously without blocking user response
  setTimeout(() => {
    processUrlItem(id, normalized).catch((err) => console.error('Capture pipeline error:', err));
  }, 10);

  const full = await getFullItem(id);
  return c.json({ item: full, isDuplicate: false }, 202);
});

// 2. Create Note
itemsRouter.post('/note', async (c) => {
  const body = await c.req.json();
  const schema = z.object({
    title: z.string().optional(),
    content: z.string().min(1),
    topicIds: z.array(z.string()).optional(),
    tagIds: z.array(z.string()).optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: '请填写备忘内容', details: parsed.error.format() }, 400);
  }

  const { title, content, topicIds, tagIds } = parsed.data;
  const id = crypto.randomUUID();
  const now = Date.now();

  // Extract first line as title if title is empty
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

  if (topicIds && topicIds.length > 0) {
    for (const tId of topicIds) {
      try {
        await db.insert(itemTopics).values({ itemId: id, topicId: tId, createdAt: now });
      } catch (_) {}
    }
  }

  if (tagIds && tagIds.length > 0) {
    for (const tagId of tagIds) {
      try {
        await db.insert(itemTags).values({ itemId: id, tagId, createdAt: now });
      } catch (_) {}
    }
  }

  const full = await getFullItem(id);
  return c.json({ item: full }, 201);
});

// 3. List items (with filtering)
itemsRouter.get('/', async (c) => {
  const status = c.req.query('status') as 'inbox' | 'organized' | 'archived' | undefined;
  const type = c.req.query('type');
  const favorite = c.req.query('favorite');
  const topicId = c.req.query('topicId');
  const tagId = c.req.query('tagId');
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  let querySql = `
    SELECT DISTINCT i.* FROM items i
  `;
  const joins: string[] = [];
  const where: string[] = [];
  const params: any[] = [];

  if (topicId) {
    joins.push('JOIN item_topics it ON it.item_id = i.id');
    where.push('it.topic_id = ?');
    params.push(topicId);
  }

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

  // Attach topics & tags to list items in bulk
  const itemIds = rawItems.map((r) => r.id);
  let topicsByItem: Record<string, any[]> = {};
  let tagsByItem: Record<string, any[]> = {};
  let assetsByItem: Record<string, any[]> = {};

  if (itemIds.length > 0) {
    const placeholders = itemIds.map(() => '?').join(',');
    const topicLinks = sqlite
      .prepare(
        `SELECT it.item_id, t.* FROM topics t JOIN item_topics it ON it.topic_id = t.id WHERE it.item_id IN (${placeholders})`
      )
      .all(...itemIds) as any[];
    topicLinks.forEach((t) => {
      if (!topicsByItem[t.item_id]) topicsByItem[t.item_id] = [];
      topicsByItem[t.item_id].push({ id: t.id, title: t.title, status: t.status });
    });

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
    topics: topicsByItem[r.id] || [],
    tags: tagsByItem[r.id] || [],
    assets: assetsByItem[r.id] || [],
  }));

  return c.json({ items: result });
});

// 4. Get single Item detail
itemsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const item = await getFullItem(id);
  if (!item) {
    return c.json({ error: '素材不存在' }, 404);
  }
  return c.json({ item });
});

// 5. Update Item
itemsRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  const schema = z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    contentText: z.string().optional(),
    organizationStatus: z.enum(['inbox', 'organized', 'archived']).optional(),
    favorite: z.boolean().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: '无效更新参数', details: parsed.error.format() }, 400);
  }

  const existing = await db.query.items.findFirst({ where: eq(items.id, id) });
  if (!existing) return c.json({ error: '素材不存在' }, 404);

  const updates: any = {
    ...parsed.data,
    updatedAt: Date.now(),
  };

  await db.update(items).set(updates).where(eq(items.id, id));
  const full = await getFullItem(id);
  return c.json({ item: full });
});

// 6. Delete Item
itemsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await db.delete(items).where(eq(items.id, id));
  return c.json({ success: true, id });
});

// 7. Retry ingestion
itemsRouter.post('/:id/retry', async (c) => {
  const id = c.req.param('id');
  const item = await db.query.items.findFirst({ where: eq(items.id, id) });
  if (!item) return c.json({ error: '素材不存在' }, 404);
  if (item.type !== 'url' || !item.sourceUrl) {
    return c.json({ error: '仅支持 URL 类型的素材重新抓取' }, 400);
  }

  setTimeout(() => {
    processUrlItem(id, item.canonicalUrl || item.sourceUrl!).catch(console.error);
  }, 10);

  return c.json({ message: '重新归档任务已提交' });
});

// 8. Batch operations
itemsRouter.post('/batch', async (c) => {
  const body = await c.req.json();
  const schema = z.object({
    itemIds: z.array(z.string()).min(1),
    action: z.enum(['set_status', 'add_topic', 'remove_topic', 'add_tag', 'remove_tag', 'favorite', 'unfavorite', 'delete']),
    status: z.enum(['inbox', 'organized', 'archived']).optional(),
    topicId: z.string().optional(),
    tagId: z.string().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: '无效批量请求参数' }, 400);
  }

  const { itemIds, action, status, topicId, tagId } = parsed.data;

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
    case 'add_topic':
      if (topicId) {
        for (const itemId of itemIds) {
          try {
            await db.insert(itemTopics).values({ itemId, topicId, createdAt: Date.now() });
          } catch (_) {}
        }
      }
      break;
    case 'remove_topic':
      if (topicId) {
        await db.delete(itemTopics).where(and(inArray(itemTopics.itemId, itemIds), eq(itemTopics.topicId, topicId)));
      }
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
        await db.delete(itemTags).where(and(inArray(itemTags.itemId, itemIds), eq(itemTags.tagId, tagId)));
      }
      break;
  }

  return c.json({ success: true, count: itemIds.length });
});

// 9. Link / Unlink Topic
itemsRouter.post('/:id/topics', async (c) => {
  const id = c.req.param('id');
  const { topicId } = await c.req.json();
  if (!topicId) return c.json({ error: '缺少 topicId' }, 400);

  try {
    await db.insert(itemTopics).values({ itemId: id, topicId, createdAt: Date.now() });
  } catch (e) {}

  const full = await getFullItem(id);
  return c.json({ item: full });
});

itemsRouter.delete('/:id/topics/:topicId', async (c) => {
  const itemId = c.req.param('id');
  const topicId = c.req.param('topicId');
  await db.delete(itemTopics).where(and(eq(itemTopics.itemId, itemId), eq(itemTopics.topicId, topicId)));
  const full = await getFullItem(itemId);
  return c.json({ item: full });
});

// 10. Link / Unlink Tag
itemsRouter.post('/:id/tags', async (c) => {
  const id = c.req.param('id');
  const { tagId, tagName } = await c.req.json();
  let targetTagId = tagId;

  if (!targetTagId && tagName) {
    const existing = await db.query.tags.findFirst({ where: eq(itemTags.tagId, tagName) });
    if (existing) {
      targetTagId = existing.id;
    } else {
      targetTagId = crypto.randomUUID();
      await db.insert(db.query.tags ? tags : tags).values({
        id: targetTagId,
        name: tagName.trim(),
        color: 'stone',
        createdAt: Date.now(),
      });
    }
  }

  if (!targetTagId) return c.json({ error: '缺少 tagId 或 tagName' }, 400);

  try {
    await db.insert(itemTags).values({ itemId: id, tagId: targetTagId, createdAt: Date.now() });
  } catch (e) {}

  const full = await getFullItem(id);
  return c.json({ item: full });
});

itemsRouter.delete('/:id/tags/:tagId', async (c) => {
  const itemId = c.req.param('id');
  const tagId = c.req.param('tagId');
  await db.delete(itemTags).where(and(eq(itemTags.itemId, itemId), eq(itemTags.tagId, tagId)));
  const full = await getFullItem(itemId);
  return c.json({ item: full });
});
