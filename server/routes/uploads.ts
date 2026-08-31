import { Hono } from 'hono';
import crypto from 'crypto';
import { db } from '../db/db';
import { items, itemTopics, itemTags } from '../db/schema';
import { saveAssetFile } from '../services/storage';
import { getFullItem } from './items';

export const uploadsRouter = new Hono();

uploadsRouter.post('/', async (c) => {
  const body = await c.req.parseBody({ all: true });
  const files = Array.isArray(body.file) ? body.file : [body.file];
  const title = typeof body.title === 'string' ? body.title : undefined;
  const description = typeof body.description === 'string' ? body.description : '';
  const topicIds = body.topicIds ? (Array.isArray(body.topicIds) ? body.topicIds : [body.topicIds]) : [];
  const tagIds = body.tagIds ? (Array.isArray(body.tagIds) ? body.tagIds : [body.tagIds]) : [];

  if (!files || files.length === 0 || !files[0]) {
    return c.json({ error: '没有上传任何文件' }, 400);
  }

  const createdItems: any[] = [];

  for (const f of files) {
    if (!(f instanceof File)) continue;

    const buffer = Buffer.from(await f.arrayBuffer());
    const mime = f.type || 'application/octet-stream';
    const fileName = f.name || 'upload.bin';

    let itemType: 'image' | 'video' | 'document' = 'document';
    if (mime.startsWith('image/')) {
      itemType = 'image';
    } else if (mime.startsWith('video/')) {
      itemType = 'video';
    }

    const itemId = crypto.randomUUID();
    const now = Date.now();
    const itemTitle = title?.trim() || fileName;

    // For plain text / markdown files, extract text for search
    let contentText = '';
    if (mime.includes('text') || fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      contentText = buffer.toString('utf-8');
    }

    await db.insert(items).values({
      id: itemId,
      type: itemType,
      title: itemTitle,
      description: description.trim(),
      sourceUrl: null,
      canonicalUrl: null,
      sourceDomain: null,
      contentText,
      organizationStatus: 'inbox',
      processingStatus: 'ready',
      favorite: false,
      capturedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Save Asset
    await saveAssetFile({
      itemId,
      kind: 'original',
      mimeType: mime,
      fileName,
      data: buffer,
    });

    // Link topics
    for (const tId of topicIds as string[]) {
      if (typeof tId === 'string' && tId) {
        try {
          await db.insert(itemTopics).values({ itemId, topicId: tId, createdAt: now });
        } catch (_) {}
      }
    }

    // Link tags
    for (const tgId of tagIds as string[]) {
      if (typeof tgId === 'string' && tgId) {
        try {
          await db.insert(itemTags).values({ itemId, tagId: tgId, createdAt: now });
        } catch (_) {}
      }
    }

    const full = await getFullItem(itemId);
    createdItems.push(full);
  }

  return c.json({ items: createdItems }, 201);
});
