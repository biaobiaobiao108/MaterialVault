import { db } from '../db';
import { saveAssetFile } from './storage';
import { detectVideoInfo, fetchVideoMetadata } from './video';
import { extractDomain, extractHashtags } from '../utils';

export async function startCapturePipeline(itemId: string, targetUrl: string) {
  const now = Date.now();

  // 1. Mark as processing
  db.prepare(`
    UPDATE items SET processing_status = 'processing', updated_at = ? WHERE id = ?
  `).run(now, itemId);

  db.prepare(`
    INSERT INTO processing_logs (id, item_id, status, message, created_at)
    VALUES (?, ?, 'processing', '开始抓取网页证据与媒体资源...', ?)
  `).run(crypto.randomUUID(), itemId, now);

  try {
    const videoInfo = await detectVideoInfo(targetUrl);

    if (videoInfo) {
      // -------------------------------------------------------------
      // Pipeline A: Bilibili / YouTube Video Capture
      // -------------------------------------------------------------
      const meta = await fetchVideoMetadata(videoInfo);

      // Save Cover Thumbnail Asset if downloaded
      if (meta.coverData && meta.coverData.byteLength > 0) {
        await saveAssetFile({
          itemId,
          kind: 'thumbnail',
          mimeType: meta.coverMime || 'image/jpeg',
          fileName: meta.coverFileName || 'cover.jpg',
          data: meta.coverData,
        });
      }

      const durStr = meta.duration > 0
        ? `${Math.floor(meta.duration / 60).toString().padStart(2, '0')}:${(meta.duration % 60).toString().padStart(2, '0')}`
        : '未知';

      const markdownContent = `# ${meta.title}

- **平台**: ${videoInfo.platform}
- **作者 / UP主**: ${meta.author || '未知'}
- **时长**: ${durStr}
- **源链接**: [${targetUrl}](${targetUrl})

---

### 视频简介 / 摘要
${meta.description || '暂无视频简介'}
`;

      // Save Markdown Asset
      const mdBuffer = new TextEncoder().encode(markdownContent);
      await saveAssetFile({
        itemId,
        kind: 'markdown',
        mimeType: 'text/markdown',
        fileName: `${videoInfo.platform}_${videoInfo.videoId}.md`,
        data: mdBuffer,
      });

      // Update Item
      const updateNow = Date.now();
      db.prepare(`
        UPDATE items
        SET title = ?, description = ?, content_text = ?, processing_status = 'ready', updated_at = ?
        WHERE id = ?
      `).run(meta.title, meta.description.slice(0, 500), markdownContent, updateNow, itemId);

      // Sync auto-extracted tags from title & description
      syncItemTagsFromText(itemId, `${meta.title} ${meta.description}`);

      db.prepare(`
        INSERT INTO processing_logs (id, item_id, status, message, created_at)
        VALUES (?, ?, 'ready', '视频原生封面与元数据解析完成', ?)
      `).run(crypto.randomUUID(), itemId, updateNow);

      return;
    }

    // -------------------------------------------------------------
    // Pipeline B: Generic Web Page Extraction
    // -------------------------------------------------------------
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const html = await res.text();
    const { title, description, ogImage, cleanMarkdown } = parseHtmlToMarkdown(html, targetUrl);

    // Save OG Image thumbnail if found
    if (ogImage) {
      try {
        const imgRes = await fetch(ogImage, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        if (imgRes.ok) {
          const buf = await imgRes.arrayBuffer();
          if (buf.byteLength > 1000) {
            await saveAssetFile({
              itemId,
              kind: 'thumbnail',
              mimeType: imgRes.headers.get('content-type') || 'image/jpeg',
              fileName: 'og_image.jpg',
              data: new Uint8Array(buf),
            });
          }
        }
      } catch (_) {}
    }

    // Save Clean Markdown Asset
    const mdBuffer = new TextEncoder().encode(cleanMarkdown);
    await saveAssetFile({
      itemId,
      kind: 'markdown',
      mimeType: 'text/markdown',
      fileName: 'article.md',
      data: mdBuffer,
    });

    const updateNow = Date.now();
    db.prepare(`
      UPDATE items
      SET title = coalesce(nullif(?, ''), title),
          description = coalesce(nullif(?, ''), description),
          content_text = ?,
          processing_status = 'ready',
          updated_at = ?
      WHERE id = ?
    `).run(title, description, cleanMarkdown, updateNow, itemId);

    syncItemTagsFromText(itemId, `${title} ${description} ${cleanMarkdown}`);

    db.prepare(`
      INSERT INTO processing_logs (id, item_id, status, message, created_at)
      VALUES (?, ?, 'ready', '网页正文提取与 Markdown 证据归档成功', ?)
    `).run(crypto.randomUUID(), itemId, updateNow);

  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    const failNow = Date.now();

    db.prepare(`
      UPDATE items SET processing_status = 'failed', updated_at = ? WHERE id = ?
    `).run(failNow, itemId);

    db.prepare(`
      INSERT INTO processing_logs (id, item_id, status, message, error_detail, created_at)
      VALUES (?, ?, 'failed', '抓取归档失败', ?, ?)
    `).run(crypto.randomUUID(), itemId, errorMsg, failNow);

    console.warn(`[Capture] Failed to process ${targetUrl}: ${errorMsg}`);
  }
}

function syncItemTagsFromText(itemId: string, text: string) {
  const hashtags = extractHashtags(text);
  if (hashtags.length === 0) return;

  const now = Date.now();
  for (const name of hashtags) {
    let tag: any = db.prepare('SELECT id FROM tags WHERE name = ?').get(name);
    if (!tag) {
      const tagId = crypto.randomUUID();
      db.prepare(`INSERT INTO tags (id, name, color, created_at, updated_at) VALUES (?, ?, 'rose', ?, ?)`).run(tagId, name, now, now);
      tag = { id: tagId };
    }

    try {
      db.prepare(`INSERT OR IGNORE INTO item_tags (item_id, tag_id, created_at) VALUES (?, ?, ?)`).run(itemId, tag.id, now);
    } catch (_) {}
  }
}

function parseHtmlToMarkdown(html: string, pageUrl: string) {
  let title = '';
  let description = '';
  let ogImage = '';

  // Extract <title>
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) title = titleMatch[1].trim();

  // Extract meta og:title / twitter:title
  const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
  if (ogTitleMatch && !title) title = ogTitleMatch[1].trim();

  // Extract meta description / og:description
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
    html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
  if (descMatch) description = descMatch[1].trim();

  // Extract meta og:image
  const imgMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  if (imgMatch) ogImage = imgMatch[1].trim();

  // Clean HTML to Markdown
  let clean = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '');

  // Convert headings
  clean = clean.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
  clean = clean.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  clean = clean.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
  clean = clean.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n');
  clean = clean.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1');
  clean = clean.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n> $1\n');
  clean = clean.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n');
  clean = clean.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  clean = clean.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  clean = clean.replace(/<br\s*\/?>/gi, '\n');
  clean = clean.replace(/<hr\s*\/?>/gi, '\n---\n');

  // Strip remaining HTML tags
  clean = clean.replace(/<[^>]+>/g, '');

  // Unescape HTML entities
  clean = clean
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Format whitespace
  const lines = clean.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const bodyText = lines.slice(0, 300).join('\n\n');

  const cleanMarkdown = `# ${title || extractDomain(pageUrl)}

- **来源**: [${pageUrl}](${pageUrl})
- **域名**: ${extractDomain(pageUrl)}
${description ? `- **简介**: ${description}\n` : ''}
---

${bodyText || '未能提取到正文'}
`;

  return {
    title: title || extractDomain(pageUrl),
    description,
    ogImage,
    cleanMarkdown,
  };
}
