import { Hono } from 'hono';
import { z } from 'zod';
import crypto from 'crypto';
import { db, sqlite } from '../db/db';
import { topics, itemTopics, items } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

export const topicsRouter = new Hono();

// 1. List topics with item count
topicsRouter.get('/', async (c) => {
  const status = c.req.query('status') as 'active' | 'archived' | undefined;

  let sql = `
    SELECT 
      t.*,
      COUNT(it.item_id) as itemCount
    FROM topics t
    LEFT JOIN item_topics it ON it.topic_id = t.id
  `;
  const params: any[] = [];
  if (status) {
    sql += ` WHERE t.status = ?`;
    params.push(status);
  }
  sql += ` GROUP BY t.id ORDER BY t.updated_at DESC`;

  const rows = sqlite.prepare(sql).all(...params) as any[];
  return c.json({ topics: rows });
});

// 2. Create Topic
topicsRouter.post('/', async (c) => {
  const body = await c.req.json();
  const schema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    externalTopicId: z.string().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: '选题名称不能为空', details: parsed.error.format() }, 400);
  }

  const id = crypto.randomUUID();
  const now = Date.now();

  const newTopic = {
    id,
    title: parsed.data.title.trim(),
    description: parsed.data.description?.trim() || '',
    status: 'active' as const,
    externalTopicId: parsed.data.externalTopicId || null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(topics).values(newTopic);
  return c.json({ topic: newTopic }, 201);
});

// 3. Get Topic by ID with items
topicsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const topic = await db.query.topics.findFirst({
    where: eq(topics.id, id),
  });
  if (!topic) return c.json({ error: '选题不存在' }, 404);

  // Fetch linked items
  const linkedItems = sqlite
    .prepare(
      `SELECT i.* FROM items i 
       JOIN item_topics it ON it.item_id = i.id 
       WHERE it.topic_id = ? 
       ORDER BY it.created_at DESC`
    )
    .all(id) as any[];

  return c.json({ topic: { ...topic, items: linkedItems } });
});

// 4. Update Topic
topicsRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const schema = z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(['active', 'archived']).optional(),
    externalTopicId: z.string().nullable().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: '无效更新参数', details: parsed.error.format() }, 400);
  }

  await db
    .update(topics)
    .set({
      ...parsed.data,
      updatedAt: Date.now(),
    })
    .where(eq(topics.id, id));

  const updated = await db.query.topics.findFirst({ where: eq(topics.id, id) });
  return c.json({ topic: updated });
});

// 5. Delete Topic
topicsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await db.delete(topics).where(eq(topics.id, id));
  return c.json({ success: true, id });
});

// 6. Export Topic Context (Section 21 & 26 of Dev Plan)
topicsRouter.get('/:id/export', async (c) => {
  const id = c.req.param('id');
  const format = c.req.query('format') || 'markdown'; // 'markdown' | 'excalidraw' | 'json'

  const topic = await db.query.topics.findFirst({ where: eq(topics.id, id) });
  if (!topic) return c.json({ error: '选题不存在' }, 404);

  const linkedItems = sqlite
    .prepare(
      `SELECT i.* FROM items i 
       JOIN item_topics it ON it.item_id = i.id 
       WHERE it.topic_id = ? 
       ORDER BY it.created_at ASC`
    )
    .all(id) as any[];

  if (format === 'excalidraw') {
    const excalidrawIntermediate = {
      topic: {
        id: topic.id,
        title: topic.title,
        description: topic.description,
      },
      items: linkedItems.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        url: item.source_url || item.canonical_url,
        description: item.description,
        contentText: item.content_text,
      })),
    };
    return c.json(excalidrawIntermediate);
  }

  // Format as clean AI Markdown Context for ChatGPT / Claude
  let markdown = `# 选题资料：${topic.title}\n\n`;
  if (topic.description) {
    markdown += `> 选题概述：${topic.description}\n\n`;
  }
  markdown += `## 素材清单 (共 ${linkedItems.length} 条)\n\n`;

  linkedItems.forEach((item, idx) => {
    markdown += `### ${idx + 1}. [${item.type.toUpperCase()}] ${item.title}\n`;
    if (item.source_url) {
      markdown += `- **原始链接**: ${item.source_url}\n`;
    }
    if (item.description) {
      markdown += `- **记录备注**: ${item.description}\n`;
    }
    if (item.content_text) {
      markdown += `\n**正文/关键内容摘要**:\n\`\`\`\n${item.content_text.slice(0, 1500)}${item.content_text.length > 1500 ? '\n... (正文较长已截断)' : ''}\n\`\`\`\n`;
    }
    markdown += `\n---\n\n`;
  });

  return c.text(markdown);
});
