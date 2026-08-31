import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import crypto from 'crypto';
import { db } from '../db/db';
import { items, ingestionLogs } from '../db/schema';
import { eq } from 'drizzle-orm';
import { saveAssetFile } from './storage';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  hr: '---',
});

// Remove script, style, nav, footer tags in turndown if needed
turndown.remove(['script', 'style', 'noscript', 'iframe']);

export function normalizeUrl(rawUrl: string): { url: string; domain: string } {
  let clean = rawUrl.trim();
  if (!/^https?:\/\//i.test(clean)) {
    clean = 'https://' + clean;
  }
  const parsed = new URL(clean);
  // Remove tracking query params like utm_*
  const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'spm_id_from', 'from_source'];
  trackingParams.forEach((p) => parsed.searchParams.delete(p));

  return {
    url: parsed.toString(),
    domain: parsed.hostname.replace(/^www\./, ''),
  };
}

export async function processUrlItem(itemId: string, targetUrl: string) {
  const logStep = async (step: string, status: 'pending' | 'success' | 'failed', message = '') => {
    try {
      await db.insert(ingestionLogs).values({
        id: crypto.randomUUID(),
        itemId,
        step,
        status,
        message,
        createdAt: Date.now(),
      });
    } catch (e) {
      console.error('Failed to write log', e);
    }
  };

  try {
    // 1. Mark status processing
    await db.update(items).set({ processingStatus: 'processing', updatedAt: Date.now() }).where(eq(items.id, itemId));
    await logStep('fetch_html', 'pending', `Starting fetch for ${targetUrl}`);

    // 2. Fetch HTML
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 MaterialVault/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    }).catch((err) => {
      throw new Error(`网络请求失败: ${err.message}`);
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP 状态码异常: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    await logStep('fetch_html', 'success', `HTML 获取成功 (${(html.length / 1024).toFixed(1)} KB)`);

    // 3. Save Raw HTML Asset
    await saveAssetFile({
      itemId,
      kind: 'html',
      mimeType: 'text/html',
      fileName: 'page.html',
      data: html,
    });

    // 4. Extract Article & Metadata with Readability
    await logStep('parse_content', 'pending', '正在解析网页内容与正文');
    const { document } = parseHTML(html);

    // Extract basic meta tags
    const metaTitle =
      document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
      document.querySelector('meta[name="twitter:title"]')?.getAttribute('content') ||
      document.title ||
      '';

    const metaDescription =
      document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
      document.querySelector('meta[name="description"]')?.getAttribute('content') ||
      '';

    let readerTitle = metaTitle;
    let readerContent = '';
    let readerMarkdown = '';

    try {
      // @ts-ignore
      const reader = new Readability(document);
      const article = reader.parse();
      if (article) {
        readerTitle = article.title || metaTitle;
        readerContent = article.textContent?.trim() || '';
        if (article.content) {
          readerMarkdown = turndown.turndown(article.content);
        }
      }
    } catch (e) {
      console.warn('Readability extraction failed, using fallback body text', e);
    }

    if (!readerContent) {
      readerContent = document.body?.textContent?.trim().slice(0, 5000) || '';
      readerMarkdown = turndown.turndown(document.body?.innerHTML || '');
    }

    // Save Markdown Asset
    if (readerMarkdown) {
      await saveAssetFile({
        itemId,
        kind: 'markdown',
        mimeType: 'text/markdown',
        fileName: 'page.md',
        data: readerMarkdown,
      });
    }

    await logStep('parse_content', 'success', `正文提取完成，正文字数: ${readerContent.length}`);

    // 5. Update Item details
    const existingItem = await db.query.items.findFirst({ where: eq(items.id, itemId) });
    const finalTitle = existingItem?.title && existingItem.title !== targetUrl ? existingItem.title : (readerTitle || targetUrl);
    const finalDesc = existingItem?.description || metaDescription || readerContent.slice(0, 200);

    await db
      .update(items)
      .set({
        title: finalTitle.trim(),
        description: finalDesc.trim(),
        contentText: readerContent,
        processingStatus: 'ready',
        updatedAt: Date.now(),
      })
      .where(eq(items.id, itemId));

    await logStep('archive_complete', 'success', '素材归档与全文索引建立成功');
  } catch (error: any) {
    console.error(`[Capture Error] Item ${itemId}:`, error);
    await logStep('capture_error', 'failed', error?.message || '未知抓取错误');

    // Never fail the item existence, only mark processingStatus as failed
    await db
      .update(items)
      .set({
        processingStatus: 'failed',
        updatedAt: Date.now(),
      })
      .where(eq(items.id, itemId));
  }
}
