import { db } from '../db';
import { json, error, extractHashtags } from '../utils';
import { saveAssetFile } from '../services/storage';
import { getFullItem } from './items';

export async function handleUploads(req: Request): Promise<Response> {
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return error('请求格式必须为 multipart/form-data');
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) return error('解析上传数据失败');

  const files = formData.getAll('file') as File[];
  if (files.length === 0) return error('没有上传任何文件');

  let title = String(formData.get('title') || '').trim();
  let description = String(formData.get('description') || '').trim();
  const tagIds = formData.getAll('tagIds').map(String);

  // If title is empty but description is provided, extract first line as title
  if (!title && description) {
    const lines = description.split('\n');
    const firstLine = lines.find((l) => l.trim().length > 0);
    if (firstLine) {
      const idx = lines.indexOf(firstLine);
      title = firstLine.trim();
      description = lines.slice(idx + 1).join('\n').trim();
    }
  }

  const createdItems: any[] = [];
  const now = Date.now();

  for (const f of files) {
    if (!(f instanceof File) || f.size === 0) continue;

    const fileName = f.name || 'upload.bin';
    const mime = f.type || 'application/octet-stream';
    const buf = await f.arrayBuffer();
    const data = new Uint8Array(buf);

    let itemType = 'document';
    if (mime.startsWith('image/')) itemType = 'image';
    else if (mime.startsWith('video/')) itemType = 'video';

    const itemTitle = title || fileName;
    const itemId = crypto.randomUUID();

    let contentText = '';
    if (mime.includes('text') || fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      try {
        contentText = new TextDecoder().decode(data);
      } catch (_) {}
    }

    db.prepare(`
      INSERT INTO items (
        id, type, title, description, content_text, organization_status, processing_status,
        favorite, captured_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'inbox', 'ready', 0, ?, ?, ?)
    `).run(itemId, itemType, itemTitle, description, contentText, now, now, now);

    // Save Physical Asset with SHA-256 deduplication
    await saveAssetFile({
      itemId,
      kind: 'original',
      mimeType: mime,
      fileName,
      data,
    });

    // Link Tags
    for (const tagId of tagIds) {
      try {
        db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id, created_at) VALUES (?, ?, ?)').run(itemId, tagId, now);
      } catch (_) {}
    }

    // Auto-extract tags from text
    const hashtags = extractHashtags(`${itemTitle} ${description} ${contentText}`);
    for (const name of hashtags) {
      let tag: any = db.prepare('SELECT id FROM tags WHERE name = ?').get(name);
      if (!tag) {
        const tagId = crypto.randomUUID();
        db.prepare(`INSERT INTO tags (id, name, color, created_at, updated_at) VALUES (?, ?, 'rose', ?, ?)`).run(tagId, name, now, now);
        tag = { id: tagId };
      }
      try {
        db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id, created_at) VALUES (?, ?, ?)').run(itemId, tag.id, now);
      } catch (_) {}
    }

    const full = getFullItem(itemId);
    if (full) createdItems.push(full);
  }

  return json({ items: createdItems }, 201);
}
