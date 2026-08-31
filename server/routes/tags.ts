import { z } from 'zod';
import crypto from 'crypto';
import { db, sqlite } from '../db/db';
import { tags } from '../db/schema';
import { eq } from 'drizzle-orm';
import { json, parseJsonBody } from '../utils';

export async function handleTags(req: Request, url: URL, subPath: string): Promise<Response> {
  const method = req.method;

  // 1. List tags: GET /api/tags
  if (method === 'GET' && !subPath) {
    const sql = `
      SELECT 
        tg.*,
        COUNT(itg.item_id) as itemCount
      FROM tags tg
      LEFT JOIN item_tags itg ON itg.tag_id = tg.id
      GROUP BY tg.id
      ORDER BY itemCount DESC, tg.name ASC
    `;
    const rows = sqlite.prepare(sql).all() as any[];
    return json({ tags: rows });
  }

  // 2. Create Tag: POST /api/tags
  if (method === 'POST' && !subPath) {
    const body = await parseJsonBody(req);
    const schema = z.object({
      name: z.string().min(1),
      color: z.string().optional(),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return json({ error: '标签名称不能为空' }, 400);
    }

    const name = parsed.data.name.trim();
    const existing = await db.query.tags.findFirst({ where: eq(tags.name, name) });
    if (existing) {
      return json({ tag: existing }, 200);
    }

    const newTag = {
      id: crypto.randomUUID(),
      name,
      color: parsed.data.color || 'stone',
      createdAt: Date.now(),
    };

    await db.insert(tags).values(newTag);
    return json({ tag: newTag }, 201);
  }

  // 3. Delete Tag: DELETE /api/tags/:id
  if (method === 'DELETE' && subPath) {
    const id = subPath;
    await db.delete(tags).where(eq(tags.id, id));
    return json({ success: true, id });
  }

  return json({ error: 'Not Found' }, 404);
}
