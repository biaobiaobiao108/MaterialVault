package db

import (
	"crypto/sha256"
	"encoding/hex"
	"log"
	"time"

	"github.com/google/uuid"
)

func Seed() error {
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM items").Scan(&count)
	if err != nil {
		return err
	}
	if count > 0 {
		log.Println("[Seed] Database already has data, skipping seed.")
		return nil
	}

	log.Println("[Seed] Seeding sample tags, items, and assets...")
	now := time.Now().UnixMilli()

	// 1. Tags
	tags := []Tag{
		{ID: "tag-bilibili", Name: "B站素材", Color: "rose", CreatedAt: now},
		{ID: "tag-boxing", Name: "格斗拳击", Color: "amber", CreatedAt: now},
		{ID: "tag-ai", Name: "AI工具", Color: "indigo", CreatedAt: now},
		{ID: "tag-workflow", Name: "效率工作流", Color: "emerald", CreatedAt: now},
	}

	for _, tg := range tags {
		_, _ = DB.Exec(`INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)`, tg.ID, tg.Name, tg.Color, tg.CreatedAt)
	}

	// 2. Items
	item1ID := uuid.New().String()
	sourceURL1 := "https://www.bilibili.com/video/BV1xx411c7mD"
	canonicalURL1 := "https://bilibili.com/video/BV1xx411c7mD"
	domain1 := "bilibili.com"
	t1 := now - 3600*1000*2
	content1 := `# 良子与华哥在训练基地的体能训练实录

## 训练记录要点
1. 华哥在第 3 回合展现了出色的防守反击步法与快速摆拳。
2. 良子的重拳压迫感极强，前手刺拳控制距离精准。
3. 关键节点：02:45 华哥闪避后的一记平勾拳击中沙袋中心，力量传感数值突破新高。

此段视频适合作为视频稿件中关于“实战对抗与体能储备”的关键论据。`

	_, _ = DB.Exec(`
		INSERT INTO items (id, type, title, description, source_url, canonical_url, source_domain, content_text, organization_status, processing_status, favorite, captured_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, item1ID, "url", "良子与华哥在训练基地的体能训练实录", "动作非常敏捷，核心力量与击打爆发力很足，适合作为第 2 幕对决的动作分析证据 #良子 #华哥 #格斗拳击", sourceURL1, canonicalURL1, domain1, content1, "inbox", "ready", 1, t1, t1, t1)

	item2ID := uuid.New().String()
	t2 := now - 3600*1000*5
	content2 := `前 3 秒钩子直接用华哥的击倒瞬间，配合低音轰鸣转场，情绪拉满。
第 15 秒进入故事背景：良子华哥相约训练基地的始末。
第 45 秒引入体能测试数据对比表格。
结尾留悬念：下一场对抗赛的时间。`

	_, _ = DB.Exec(`
		INSERT INTO items (id, type, title, description, source_url, canonical_url, source_domain, content_text, organization_status, processing_status, favorite, captured_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, ?)
	`, item2ID, "note", "关于良子最新视频节奏与分镜剪辑的思考", "前 3 秒钩子直接用华哥的击倒瞬间，配合低音轰鸣转场，情绪拉满 #剪辑技巧 #灵感备忘", content2, "inbox", "ready", 0, t2, t2, t2)

	item3ID := uuid.New().String()
	sourceURL3 := "https://github.com/mozilla/readability"
	canonicalURL3 := "https://github.com/mozilla/readability"
	domain3 := "github.com"
	t3 := now - 3600*1000*24
	content3 := `# Readability.js

A standalone version of the Readability library used for Firefox Reader View.

## Usage
To parse a document, create a new Readability object from a DOM document object, and call parse().
The resulting article object contains title, byline, content, textContent, length, and excerpt.`

	_, _ = DB.Exec(`
		INSERT INTO items (id, type, title, description, source_url, canonical_url, source_domain, content_text, organization_status, processing_status, favorite, captured_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, item3ID, "url", "Mozilla Readability: Standalone content extractor for web pages", "用于 Material Vault 抓取网页正文的核心库，提取 clean markdown 效果极佳 #开源项目 #AI工具", sourceURL3, canonicalURL3, domain3, content3, "organized", "ready", 1, t3, t3, t3)

	item4ID := uuid.New().String()
	t4 := now - 3600*1000*48
	content4 := `1. 极速捕获：复制链接直接 Ctrl+V 保存，先给创作者 202 成功反馈，抓取全部在后台跑。
2. 证据归档韧性：即使防爬导致抓取失败，素材本体和笔记绝不丢失。
3. 毫秒级 FTS5 全文索引：支持检索标题、备注、URL 以及完整正文。
4. 标签即时提取：输入 #标签名 自动归类。`

	_, _ = DB.Exec(`
		INSERT INTO items (id, type, title, description, source_url, canonical_url, source_domain, content_text, organization_status, processing_status, favorite, captured_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, ?)
	`, item4ID, "note", "视频创作者极速素材流架构设计原则", "Capture Friction 必须做到最低，两步内保存，抓取在后台进行，绝不阻塞记录思路 #系统设计 #效率工作流", content4, "organized", "ready", 1, t4, t4, t4)

	// 3. Link tags
	links := []ItemTag{
		{ItemID: item1ID, TagID: "tag-bilibili", CreatedAt: now},
		{ItemID: item1ID, TagID: "tag-boxing", CreatedAt: now},
		{ItemID: item2ID, TagID: "tag-boxing", CreatedAt: now},
		{ItemID: item3ID, TagID: "tag-ai", CreatedAt: now},
		{ItemID: item4ID, TagID: "tag-workflow", CreatedAt: now},
	}
	for _, l := range links {
		_, _ = DB.Exec(`INSERT INTO item_tags (item_id, tag_id, created_at) VALUES (?, ?, ?)`, l.ItemID, l.TagID, l.CreatedAt)
	}

	// 4. Sample Assets
	h1 := sha256.Sum256([]byte(content1))
	sha1 := hex.EncodeToString(h1[:])
	_, _ = DB.Exec(`
		INSERT INTO assets (id, item_id, kind, mime_type, file_name, file_size, sha256, storage_path, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, uuid.New().String(), item1ID, "markdown", "text/markdown", "article.md", len([]byte(content1)), sha1, "article-item1.md", now)

	h3 := sha256.Sum256([]byte(content3))
	sha3 := hex.EncodeToString(h3[:])
	_, _ = DB.Exec(`
		INSERT INTO assets (id, item_id, kind, mime_type, file_name, file_size, sha256, storage_path, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, uuid.New().String(), item3ID, "markdown", "text/markdown", "readme.md", len([]byte(content3)), sha3, "readme-item3.md", now)

	// 5. Sample Logs
	_, _ = DB.Exec(`
		INSERT INTO ingestion_logs (id, item_id, step, status, message, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, uuid.New().String(), item1ID, "html_extraction", "success", "成功抓取网页 HTML 与 Title", now-1000)

	_, _ = DB.Exec(`
		INSERT INTO ingestion_logs (id, item_id, step, status, message, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, uuid.New().String(), item1ID, "markdown_generation", "success", "提取 Clean Markdown 成功 (共 382 字符)", now)

	log.Println("[Seed] Sample data seeded successfully!")
	return nil
}
