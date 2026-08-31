package services

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	converter "github.com/JohannesKaufmann/html-to-markdown/v2"
	"github.com/go-shiori/go-readability"
	"github.com/google/uuid"
	"golang.org/x/net/html"
	"materialvault/internal/db"
)

func LogStep(itemID, step, status, message string) {
	logID := uuid.New().String()
	now := time.Now().UnixMilli()
	query := `INSERT INTO ingestion_logs (id, item_id, step, status, message, created_at) VALUES (?, ?, ?, ?, ?, ?)`
	_, err := db.DB.Exec(query, logID, itemID, step, status, message, now)
	if err != nil {
		log.Printf("[LogStep Error] item %s: %v", itemID, err)
	}
}

func extractMetaTags(htmlStr string) (title string, desc string) {
	doc, err := html.Parse(strings.NewReader(htmlStr))
	if err != nil {
		return "", ""
	}

	var f func(*html.Node)
	f = func(n *html.Node) {
		if n.Type == html.ElementNode {
			if n.Data == "title" && title == "" && n.FirstChild != nil {
				title = strings.TrimSpace(n.FirstChild.Data)
			}
			if n.Data == "meta" {
				var prop, name, content string
				for _, attr := range n.Attr {
					if attr.Key == "property" {
						prop = strings.ToLower(attr.Val)
					}
					if attr.Key == "name" {
						name = strings.ToLower(attr.Val)
					}
					if attr.Key == "content" {
						content = strings.TrimSpace(attr.Val)
					}
				}
				if (prop == "og:title" || name == "twitter:title") && content != "" {
					title = content
				}
				if (prop == "og:description" || name == "description") && desc == "" && content != "" {
					desc = content
				}
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			f(c)
		}
	}
	f(doc)
	return title, desc
}

func ProcessURLItem(assetsDir string, itemID, targetURL string) {
	now := time.Now().UnixMilli()

	// 1. Mark processing
	_, _ = db.DB.Exec(`UPDATE items SET processing_status = 'processing', updated_at = ? WHERE id = ?`, now, itemID)
	LogStep(itemID, "fetch_html", "pending", fmt.Sprintf("Starting fetch for %s", targetURL))

	handleError := func(err error) {
		log.Printf("[Capture Error] item %s: %v", itemID, err)
		LogStep(itemID, "capture_error", "failed", err.Error())
		_, _ = db.DB.Exec(`UPDATE items SET processing_status = 'failed', updated_at = ? WHERE id = ?`, time.Now().UnixMilli(), itemID)
	}

	// 2. Fetch HTML with timeout and Chrome-like User-Agent
	parsedURL, err := url.Parse(targetURL)
	if err != nil {
		handleError(fmt.Errorf("无效的 URL 格式: %w", err))
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", targetURL, nil)
	if err != nil {
		handleError(fmt.Errorf("创建网络请求失败: %w", err))
		return
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 MaterialVault/1.0")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")

	client := &http.Client{
		Timeout: 15 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		handleError(fmt.Errorf("网络请求失败: %w", err))
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		handleError(fmt.Errorf("HTTP 状态码异常: %d %s", resp.StatusCode, resp.Status))
		return
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		handleError(fmt.Errorf("读取网页内容失败: %w", err))
		return
	}

	htmlStr := string(bodyBytes)
	sizeKB := float64(len(bodyBytes)) / 1024.0
	LogStep(itemID, "fetch_html", "success", fmt.Sprintf("HTML 获取成功 (%.1f KB)", sizeKB))

	// 3. Extract metadata and article using readability
	LogStep(itemID, "parse_content", "pending", "正在解析网页内容与正文")
	metaTitle, metaDesc := extractMetaTags(htmlStr)

	readerTitle := metaTitle
	readerContent := ""
	readerMarkdown := ""

	article, rErr := readability.FromReader(strings.NewReader(htmlStr), parsedURL)
	if rErr == nil {
		if article.Title != "" {
			readerTitle = article.Title
		}
		readerContent = strings.TrimSpace(article.TextContent)
		if article.Content != "" {
			md, convErr := converter.ConvertString(article.Content)
			if convErr == nil {
				readerMarkdown = md
			}
		}
	} else {
		log.Printf("[Readability Warning] item %s: %v", itemID, rErr)
	}

	if readerContent == "" {
		// Fallback: convert entire body to markdown
		md, convErr := converter.ConvertString(htmlStr)
		if convErr == nil {
			readerMarkdown = md
			if len(readerMarkdown) > 5000 {
				readerContent = readerMarkdown[:5000]
			} else {
				readerContent = readerMarkdown
			}
		}
	}

	// 4. Save Markdown Asset
	if readerMarkdown != "" {
		_, _ = SaveAssetFile(assetsDir, SaveAssetParams{
			ItemID:   itemID,
			Kind:     "markdown",
			MimeType: "text/markdown",
			FileName: "page.md",
			Data:     []byte(readerMarkdown),
		})
	}

	LogStep(itemID, "parse_content", "success", fmt.Sprintf("正文提取完成，正文字数: %d", len(readerContent)))

	// 5. Update Item details
	var existingTitle, existingDesc sqlNullString
	_ = db.DB.QueryRow(`SELECT title, description FROM items WHERE id = ?`, itemID).Scan(&existingTitle.String, &existingDesc.String)

	finalTitle := existingTitle.String
	if finalTitle == "" || finalTitle == targetURL {
		if readerTitle != "" {
			finalTitle = readerTitle
		} else {
			finalTitle = targetURL
		}
	}

	finalDesc := existingDesc.String
	if finalDesc == "" {
		if metaDesc != "" {
			finalDesc = metaDesc
		} else if len(readerContent) > 200 {
			finalDesc = readerContent[:200]
		} else {
			finalDesc = readerContent
		}
	}

	finalNow := time.Now().UnixMilli()
	_, err = db.DB.Exec(`
		UPDATE items 
		SET title = ?, description = ?, content_text = ?, processing_status = 'ready', updated_at = ?
		WHERE id = ?
	`, strings.TrimSpace(finalTitle), strings.TrimSpace(finalDesc), readerContent, finalNow, itemID)

	if err != nil {
		handleError(fmt.Errorf("更新数据库记录失败: %w", err))
		return
	}

	LogStep(itemID, "archive_complete", "success", "素材归档与全文索引建立成功")
}

type sqlNullString struct {
	String string
	Valid  bool
}
