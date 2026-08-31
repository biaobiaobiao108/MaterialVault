import crypto from 'crypto';
import { db } from '../db/db';
import { items, itemTags } from '../db/schema';
import { saveAssetFile } from '../services/storage';
import { getFullItem, syncItemTags } from './items';
import { json } from '../utils';

export async function handleUploads(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405);
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (err: any) {
    return json({ error: '解析上传数据失败: ' + err.message }, 400);
  }

  const files = formData.getAll('file') as File[];
  const title = formData.get('title') as string | null;
  const description = (formData.get('description') as string | null) || '';
  const tagIds = formData.getAll('tagIds') as string[];

  if (!files || files.length === 0 || !(files[0] instanceof File)) {
    return json({ error: '没有上传任何文件' }, 400);
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

    // Link & extract tags
    await syncItemTags(itemId, tagIds || [], `${itemTitle} ${description} ${contentText}`);

    const full = await getFullItem(itemId);
    createdItems.push(full);
  }

  return json({ items: createdItems }, 201);
}
