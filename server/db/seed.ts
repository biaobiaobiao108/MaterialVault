import { db, initDatabase, sqlite } from './db';
import { items, tags, itemTags, assets, ingestionLogs } from './schema';
import crypto from 'crypto';

export async function seed() {
  initDatabase();

  const countRow = sqlite.prepare('SELECT COUNT(*) as count FROM items').get() as { count: number };
  if (countRow.count > 0) {
    console.log('[Seed] Database already has data, skipping seed.');
    return;
  }

  console.log('[Seed] Seeding sample tags, items, and assets...');

  const now = Date.now();

  // Tags
  const tagBilibili = { id: 'tag-bilibili', name: 'B站素材', color: 'rose', createdAt: now };
  const tagBoxing = { id: 'tag-boxing', name: '格斗拳击', color: 'amber', createdAt: now };
  const tagAI = { id: 'tag-ai', name: 'AI工具', color: 'indigo', createdAt: now };
  const tagWorkflow = { id: 'tag-workflow', name: '效率工作流', color: 'emerald', createdAt: now };

  await db.insert(tags).values([tagBilibili, tagBoxing, tagAI, tagWorkflow]);

  // Items
  const item1Id = crypto.randomUUID();
  const item1 = {
    id: item1Id,
    type: 'url' as const,
    title: '良子与华哥在训练基地的体能训练实录',
    description: '动作非常敏捷，核心力量与击打爆发力很足，适合作为第 2 幕对决的动作分析证据 #良子 #华哥 #格斗拳击',
    sourceUrl: 'https://www.bilibili.com/video/BV1xx411c7mD',
    canonicalUrl: 'https://bilibili.com/video/BV1xx411c7mD',
    sourceDomain: 'bilibili.com',
    contentText: `# 良子与华哥在训练基地的体能训练实录

## 训练记录要点
1. 华哥在第 3 回合展现了出色的防守反击步法与快速摆拳。
2. 良子的重拳压迫感极强，前手刺拳控制距离精准。
3. 关键节点：02:45 华哥闪避后的一记平勾拳击中沙袋中心，力量传感数值突破新高。

此段视频适合作为视频稿件中关于“实战对抗与体能储备”的关键论据。`,
    organizationStatus: 'inbox' as const,
    processingStatus: 'ready' as const,
    favorite: true,
    capturedAt: now - 3600 * 1000 * 2,
    createdAt: now - 3600 * 1000 * 2,
    updatedAt: now - 3600 * 1000 * 2,
  };

  const item2Id = crypto.randomUUID();
  const item2 = {
    id: item2Id,
    type: 'note' as const,
    title: '关于良子最新视频节奏与分镜剪辑的思考',
    description: '前 3 秒钩子直接用华哥的击倒瞬间，配合低音轰鸣转场，情绪拉满 #剪辑技巧 #灵感备忘',
    sourceUrl: null,
    canonicalUrl: null,
    sourceDomain: null,
    contentText: `前 3 秒钩子直接用华哥的击倒瞬间，配合低音轰鸣转场，情绪拉满。
第 15 秒进入故事背景：良子华哥相约训练基地的始末。
第 45 秒引入体能测试数据对比表格。
结尾留悬念：下一场对抗赛的时间。`,
    organizationStatus: 'inbox' as const,
    processingStatus: 'ready' as const,
    favorite: false,
    capturedAt: now - 3600 * 1000 * 5,
    createdAt: now - 3600 * 1000 * 5,
    updatedAt: now - 3600 * 1000 * 5,
  };

  const item3Id = crypto.randomUUID();
  const item3 = {
    id: item3Id,
    type: 'url' as const,
    title: 'Mozilla Readability: Standalone content extractor for web pages',
    description: '用于 Material Vault 抓取网页正文的核心库，提取 clean markdown 效果极佳 #开源项目 #AI工具',
    sourceUrl: 'https://github.com/mozilla/readability',
    canonicalUrl: 'https://github.com/mozilla/readability',
    sourceDomain: 'github.com',
    contentText: `# Readability.js

A standalone version of the Readability library used for Firefox Reader View.

## Usage
To parse a document, create a new Readability object from a DOM document object, and call parse().
The resulting article object contains title, byline, content, textContent, length, and excerpt.`,
    organizationStatus: 'organized' as const,
    processingStatus: 'ready' as const,
    favorite: true,
    capturedAt: now - 3600 * 1000 * 24,
    createdAt: now - 3600 * 1000 * 24,
    updatedAt: now - 3600 * 1000 * 24,
  };

  const item4Id = crypto.randomUUID();
  const item4 = {
    id: item4Id,
    type: 'note' as const,
    title: '视频创作者极速素材流架构设计原则',
    description: 'Capture Friction 必须做到最低，两步内保存，抓取在后台进行，绝不阻塞记录思路 #系统设计 #效率工作流',
    sourceUrl: null,
    canonicalUrl: null,
    sourceDomain: null,
    contentText: `1. 极速捕获：复制链接直接 Ctrl+V 保存，先给创作者 202 成功反馈，抓取全部在后台跑。
2. 证据归档韧性：即使防爬导致抓取失败，素材本体和笔记绝不丢失。
3. 毫秒级 FTS5 全文索引：支持检索标题、备注、URL 以及完整正文。
4. 标签即时提取：输入 #标签名 自动归类。`,
    organizationStatus: 'organized' as const,
    processingStatus: 'ready' as const,
    favorite: true,
    capturedAt: now - 3600 * 1000 * 48,
    createdAt: now - 3600 * 1000 * 48,
    updatedAt: now - 3600 * 1000 * 48,
  };

  await db.insert(items).values([item1, item2, item3, item4]);

  // Link tags
  await db.insert(itemTags).values([
    { itemId: item1Id, tagId: tagBilibili.id, createdAt: now },
    { itemId: item1Id, tagId: tagBoxing.id, createdAt: now },
    { itemId: item2Id, tagId: tagBoxing.id, createdAt: now },
    { itemId: item3Id, tagId: tagAI.id, createdAt: now },
    { itemId: item4Id, tagId: tagWorkflow.id, createdAt: now },
  ]);

  // Sample Assets
  const asset1 = {
    id: crypto.randomUUID(),
    itemId: item1Id,
    kind: 'markdown' as const,
    mimeType: 'text/markdown',
    fileName: 'article.md',
    fileSize: Buffer.byteLength(item1.contentText),
    storagePath: 'article-item1.md',
    sha256: crypto.createHash('sha256').update(item1.contentText).digest('hex'),
    createdAt: now,
  };

  const asset3 = {
    id: crypto.randomUUID(),
    itemId: item3Id,
    kind: 'markdown' as const,
    mimeType: 'text/markdown',
    fileName: 'readme.md',
    fileSize: Buffer.byteLength(item3.contentText),
    storagePath: 'readme-item3.md',
    sha256: crypto.createHash('sha256').update(item3.contentText).digest('hex'),
    createdAt: now,
  };

  await db.insert(assets).values([asset1, asset3]);

  // Sample Logs
  await db.insert(ingestionLogs).values([
    {
      id: crypto.randomUUID(),
      itemId: item1Id,
      step: 'html_extraction',
      status: 'success',
      message: '成功抓取网页 HTML 与 Title',
      createdAt: now - 1000,
    },
    {
      id: crypto.randomUUID(),
      itemId: item1Id,
      step: 'markdown_generation',
      status: 'success',
      message: '提取 Clean Markdown 成功 (共 382 字符)',
      createdAt: now,
    },
  ]);

  console.log('[Seed] Sample data seeded successfully!');
}

if (import.meta.main) {
  seed().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
