import { z } from 'zod';
import crypto from 'crypto';
import { db, sqlite } from '../db/db';
import { topics, itemTopics, items } from '../db/schema';
import { eq } from 'drizzle-orm';
import { json, parseJsonBody } from '../utils';

export async function handleTopics(req: Request, url: URL, subPath: string): Promise<Response> {
  const method = req.method;

  // 1. List topics: GET /api/topics
  if (method === 'GET' && !subPath) {
    const status = url.searchParams.get('status') as 'active' | 'archived' | undefined;

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
    return json({ topics: rows });
  }

  // 2. Create Topic: POST /api/topics
  if (method === 'POST' && !subPath) {
    const body = await parseJsonBody(req);
    const schema = z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      externalTopicId: z.string().optional(),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return json({ error: '选题名称不能为空' }, 400);
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
    return json({ topic: newTopic }, 201);
  }

  // 3. Export Topic: GET /api/topics/:id/export
  if (method === 'GET' && subPath.endsWith('/export')) {
    const topicId = subPath.replace(/\/export$/, '');
    const format = url.searchParams.get('format') || 'markdown';

    const topic = await db.query.topics.findFirst({ where: eq(topics.id, topicId) });
    if (!topic) return json({ error: '选题不存在' }, 404);

    const linkedItems = sqlite
      .prepare(
        `SELECT i.* FROM items i 
         JOIN item_topics it ON it.item_id = i.id 
         WHERE it.topic_id = ? 
         ORDER BY it.created_at ASC`
      )
      .all(topicId) as any[];

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
      return json(excalidrawIntermediate);
    }

    // Markdown
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

    return new Response(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // 4. Get single Topic: GET /api/topics/:id
  if (method === 'GET' && subPath) {
    const topicId = subPath;
    const topic = await db.query.topics.findFirst({
      where: eq(topics.id, topicId),
    });
    if (!topic) return json({ error: '选题不存在' }, 404);

    const linkedItems = sqlite
      .prepare(
        `SELECT i.* FROM items i 
         JOIN item_topics it ON it.item_id = i.id 
         WHERE it.topic_id = ? 
         ORDER BY it.created_at DESC`
      )
      .all(topicId) as any[];

    return json({ topic: { ...topic, items: linkedItems } });
  }

  // 5. Update Topic: PATCH /api/topics/:id
  if (method === 'PATCH' && subPath) {
    const topicId = subPath;
    const body = await parseJsonBody(req);
    const schema = z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(['active', 'archived']).optional(),
      externalTopicId: z.string().nullable().optional(),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return json({ error: '无效更新参数' }, 400);
    }

    await db
      .update(topics)
      .set({
        ...parsed.data,
        updatedAt: Date.now(),
      })
      .where(eq(topics.id, topicId));

    const updated = await db.query.topics.findFirst({ where: eq(topics.id, topicId) });
    return json({ topic: updated });
  }

  // 6. Delete Topic: DELETE /api/topics/:id
  if (method === 'DELETE' && subPath) {
    const topicId = subPath;
    await db.delete(topics).where(eq(topics.id, topicId));
    return json({ success: true, id: topicId });
  }

  return json({ error: 'Not Found' }, 404);
}
