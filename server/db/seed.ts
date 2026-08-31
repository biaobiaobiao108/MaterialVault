import { db, initDatabase, sqlite } from './db';
import { items, topics, tags, itemTopics, itemTags } from './schema';
import { saveAssetFile } from '../services/storage';
import crypto from 'crypto';

export async function seed() {
  initDatabase();

  const count = (sqlite.prepare('SELECT COUNT(*) as c FROM items').get() as any).c;
  if (count > 0) {
    console.log('[Seed] Database already has data, skipping seed.');
    return;
  }

  console.log('[Seed] Seeding sample topics, tags, items, and assets...');

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  // Topics
  const topic1 = {
    id: 'topic-liangzi',
    title: '大胃袋良子：峨眉山事件',
    description: '追踪峨眉山爬山直播争议事件，包含华哥训练基地前史与网友评论证据链。',
    status: 'active' as const,
    externalTopicId: 'KANBAN-104',
    createdAt: now - 5 * day,
    updatedAt: now - 1 * day,
  };

  const topic2 = {
    id: 'topic-ai-workflow',
    title: '自媒体 AI 创作工作流搭建',
    description: '整理从选题库、素材证据归档到白板脚本推演的全套工具链与实战方法。',
    status: 'active' as const,
    externalTopicId: 'KANBAN-208',
    createdAt: now - 3 * day,
    updatedAt: now,
  };

  await db.insert(topics).values([topic1, topic2]);

  // Tags
  const tagList = [
    { id: 'tag-liangzi', name: '良子', color: 'rose', createdAt: now },
    { id: 'tag-huage', name: '华哥', color: 'amber', createdAt: now },
    { id: 'tag-evidence', name: '核心证据', color: 'emerald', createdAt: now },
    { id: 'tag-history', name: '前史背景', color: 'indigo', createdAt: now },
    { id: 'tag-ai', name: 'AI工具', color: 'sky', createdAt: now },
  ];

  await db.insert(tags).values(tagList);

  // Items
  // 1. URL item (ready)
  const item1Id = 'item-bilibili-liangzi';
  await db.insert(items).values({
    id: item1Id,
    type: 'url',
    title: '良子峨眉山事件现场录屏与回放记录',
    description: '直播切片：下午 16:20 两人在金顶发生争执，华哥提到之前在训练基地的承诺。',
    sourceUrl: 'https://www.bilibili.com/video/BV1xx411c7mD',
    canonicalUrl: 'https://www.bilibili.com/video/BV1xx411c7mD',
    sourceDomain: 'bilibili.com',
    contentText: '良子与华哥在峨眉山景区的现场对话记录：良子表示体能不支想乘缆车下山，华哥认为必须徒步完成。双方发生口角，引出半年前在华哥健身基地的旧事。',
    organizationStatus: 'inbox',
    processingStatus: 'ready',
    favorite: true,
    capturedAt: now - 2 * day,
    createdAt: now - 2 * day,
    updatedAt: now - 2 * day,
  });

  await saveAssetFile({
    itemId: item1Id,
    kind: 'markdown',
    mimeType: 'text/markdown',
    fileName: 'article.md',
    data: `# 良子峨眉山事件现场录屏与回放记录\n\n- 时间：2026年7月28日\n- 地点：峨眉山金顶\n- 关键争议点：体能与承诺分歧\n\n> 华哥：“当时在基地的时候你不是说能吃苦吗？”\n> 良子：“那能一样吗，现在天都要黑了！”`,
  });

  await saveAssetFile({
    itemId: item1Id,
    kind: 'html',
    mimeType: 'text/html',
    fileName: 'page.html',
    data: `<html><body><h1>良子峨眉山事件现场录屏与回放记录</h1><p>证据网页原始归档。</p></body></html>`,
  });

  // 2. Note item
  const item2Id = 'item-note-huage-base';
  await db.insert(items).values({
    id: item2Id,
    type: 'note',
    title: '良子以前去过华哥训练基地，几天就跑路了',
    description: '峨眉山事件可以用这个做前后呼应。视频脚本第 2 幕切入点：不要一上来就讲吵架，先讲两人之前在基地的渊源。',
    sourceUrl: null,
    canonicalUrl: null,
    sourceDomain: null,
    contentText: '良子以前去过华哥训练基地，结果几天就跑路了。\n峨眉山事件可以用这个做前后呼应。视频脚本第 2 幕切入点：不要一上来就讲吵架，先讲两人之前在基地的渊源。',
    organizationStatus: 'inbox',
    processingStatus: 'ready',
    favorite: true,
    capturedAt: now - 1 * day,
    createdAt: now - 1 * day,
    updatedAt: now - 1 * day,
  });

  // 3. Image mock item
  const item3Id = 'item-image-weibo-post';
  await db.insert(items).values({
    id: item3Id,
    type: 'image',
    title: '微博动态长截图：粉丝站发出的时间线整理',
    description: '微博网友整理的 7 月 27 日至 29 日全网讨论热度走势与关键博文截图备份。',
    sourceUrl: null,
    canonicalUrl: null,
    sourceDomain: 'weibo.com',
    contentText: '微博动态时间线：7月27日 两人出发；7月28日 金顶争执；7月29日 双方分别发短视频回应。',
    organizationStatus: 'organized',
    processingStatus: 'ready',
    favorite: false,
    capturedAt: now - 3 * day,
    createdAt: now - 3 * day,
    updatedAt: now - 2 * day,
  });

  // Create a clean SVG screenshot mock
  const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
    <rect width="800" height="450" fill="#1c1917"/>
    <text x="50" y="80" fill="#e11d48" font-family="sans-serif" font-size="28" font-weight="bold">Material Vault · 证据快照</text>
    <text x="50" y="140" fill="#f5f5f4" font-family="sans-serif" font-size="20">微博动态：峨眉山事件时间线整理</text>
    <rect x="50" y="180" width="700" height="2" fill="#292524"/>
    <text x="50" y="230" fill="#a8a29e" font-family="sans-serif" font-size="16">2026-07-28 17:31 · 来自 微博网页版</text>
    <text x="50" y="280" fill="#e7e5e4" font-family="sans-serif" font-size="18">“良子与华哥联合直播回放核心节点梳理，见长图...”</text>
  </svg>`;

  await saveAssetFile({
    itemId: item3Id,
    kind: 'original',
    mimeType: 'image/svg+xml',
    fileName: 'weibo_timeline.svg',
    data: sampleSvg,
  });

  // 4. URL item (AI workflow)
  const item4Id = 'item-url-readability';
  await db.insert(items).values({
    id: item4Id,
    type: 'url',
    title: 'Building Frictionless Web Capture with Readability and SQLite FTS5',
    description: '关于如何设计低摩擦素材收集流与无头网页归档架构的技术深度分享。',
    sourceUrl: 'https://developer.mozilla.org/en-US/docs/Mozilla/Projects/Readability',
    canonicalUrl: 'https://developer.mozilla.org/en-US/docs/Mozilla/Projects/Readability',
    sourceDomain: 'developer.mozilla.org',
    contentText: 'Readability is a standalone version of the readability library used for Firefox Reader View. It extracts title, byline, text content and cleans HTML.',
    organizationStatus: 'organized',
    processingStatus: 'ready',
    favorite: true,
    capturedAt: now - 4 * day,
    createdAt: now - 4 * day,
    updatedAt: now - 1 * day,
  });

  // 5. URL item (failed capture state for testing resilience)
  const item5Id = 'item-url-failed-sample';
  await db.insert(items).values({
    id: item5Id,
    type: 'url',
    title: '某加密社交平台动态（需要客户端登录）',
    description: '遇到防爬虫与登录拦截，自动归档失败，但素材依然安全保存在 Inbox 中，支持重新抓取或手动补传。',
    sourceUrl: 'https://example.com/private/post/99981',
    canonicalUrl: 'https://example.com/private/post/99981',
    sourceDomain: 'example.com',
    contentText: '',
    organizationStatus: 'inbox',
    processingStatus: 'failed',
    favorite: false,
    capturedAt: now - 6 * 3600 * 1000,
    createdAt: now - 6 * 3600 * 1000,
    updatedAt: now - 6 * 3600 * 1000,
  });

  // Link topics and tags
  await db.insert(itemTopics).values([
    { itemId: item1Id, topicId: topic1.id, createdAt: now },
    { itemId: item2Id, topicId: topic1.id, createdAt: now },
    { itemId: item3Id, topicId: topic1.id, createdAt: now },
    { itemId: item4Id, topicId: topic2.id, createdAt: now },
  ]);

  await db.insert(itemTags).values([
    { itemId: item1Id, tagId: 'tag-liangzi', createdAt: now },
    { itemId: item1Id, tagId: 'tag-huage', createdAt: now },
    { itemId: item1Id, tagId: 'tag-evidence', createdAt: now },
    { itemId: item2Id, tagId: 'tag-liangzi', createdAt: now },
    { itemId: item2Id, tagId: 'tag-history', createdAt: now },
    { itemId: item3Id, tagId: 'tag-evidence', createdAt: now },
    { itemId: item4Id, tagId: 'tag-ai', createdAt: now },
  ]);

  console.log('[Seed] Seeding completed successfully!');
}

if (import.meta.main) {
  seed().then(() => process.exit(0)).catch((err) => {
    console.error('[Seed Error]', err);
    process.exit(1);
  });
}
