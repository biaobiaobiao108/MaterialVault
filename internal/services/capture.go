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

type ExtractedMeta struct {
	Title string
	Desc  string
	Image string
}

func extractMetaTags(htmlStr string) ExtractedMeta {
	var meta ExtractedMeta
	doc, err := html.Parse(strings.NewReader(htmlStr))
	if err != nil {
		return meta
	}

	var f func(*html.Node)
	f = func(n *html.Node) {
		if n.Type == html.ElementNode {
			if n.Data == "title" && meta.Title == "" && n.FirstChild != nil {
				meta.Title = strings.TrimSpace(n.FirstChild.Data)
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
					meta.Title = content
				}
				if (prop == "og:description" || name == "description" || name == "twitter:description") && meta.Desc == "" && content != "" {
					meta.Desc = content
				}
				if (prop == "og:image" || name == "twitter:image" || prop == "image") && meta.Image == "" && content != "" {
					meta.Image = content
				}
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			f(c)
		}
	}
	f(doc)
	return meta
}

func ProcessURLItem(assetsDir string, itemID, targetURL string) {
	now := time.Now().UnixMilli()

	// 1. Mark processing
	_, _ = db.DB.Exec(`UPDATE items SET processing_status = 'processing', updated_at = ? WHERE id = ?`, now, itemID)

	handleError := func(err error) {
		log.Printf("[Capture Error] item %s: %v", itemID, err)
		LogStep(itemID, "capture_error", "failed", err.Error())
		_, _ = db.DB.Exec(`UPDATE items SET processing_status = 'failed', updated_at = ? WHERE id = ?`, time.Now().UnixMilli(), itemID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	// 2. Specialized Video Platform Processing (Bilibili / YouTube)
	if videoInfo := DetectVideoInfo(targetURL); videoInfo != nil {
		LogStep(itemID, "fetch_video_meta", "pending", fmt.Sprintf("检测到 %s 视频，正在提取元数据与高清封面", videoInfo.Platform))
		videoRes, vErr := FetchVideoMetaAndCover(ctx, videoInfo)
		if vErr == nil && videoRes != nil {
			// Save Thumbnail Asset if downloaded
			if len(videoRes.CoverData) > 0 {
				_, saveErr := SaveAssetFile(assetsDir, SaveAssetParams{
					ItemID:   itemID,
					Kind:     "thumbnail",
					MimeType: videoRes.CoverMime,
					FileName: videoRes.CoverFileName,
					Data:     videoRes.CoverData,
				})
				if saveErr == nil {
					sizeKB := float64(len(videoRes.CoverData)) / 1024.0
					LogStep(itemID, "save_thumbnail", "success", fmt.Sprintf("视频封面归档成功 (%.1f KB)", sizeKB))
				} else {
					LogStep(itemID, "save_thumbnail", "failed", "封面资产保存失败: "+saveErr.Error())
				}
			}

			// Generate video content text
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("# %s\n\n", videoRes.Title))
			sb.WriteString(fmt.Sprintf("- **平台**：%s\n", videoRes.Platform))
			if videoRes.Author != "" {
				sb.WriteString(fmt.Sprintf("- **作者 / UP主**：%s\n", videoRes.Author))
			}
			if videoRes.Duration > 0 {
				mins := videoRes.Duration / 60
				secs := videoRes.Duration % 60
				sb.WriteString(fmt.Sprintf("- **时长**：%02d:%02d\n", mins, secs))
			}
			sb.WriteString(fmt.Sprintf("- **源链接**：%s\n\n", targetURL))
			if videoRes.Description != "" {
				sb.WriteString("## 视频简介\n\n")
				sb.WriteString(videoRes.Description)
				sb.WriteString("\n")
			}

			videoContent := sb.String()

			// Save Markdown Asset
			_, _ = SaveAssetFile(assetsDir, SaveAssetParams{
				ItemID:   itemID,
				Kind:     "markdown",
				MimeType: "text/markdown",
				FileName: "video.md",
				Data:     []byte(videoContent),
			})

			// Read existing custom user input
			var existingTitle, existingDesc sqlNullString
			_ = db.DB.QueryRow(`SELECT title, description FROM items WHERE id = ?`, itemID).Scan(&existingTitle.String, &existingDesc.String)

			finalTitle := existingTitle.String
			if finalTitle == "" || finalTitle == targetURL {
				finalTitle = videoRes.Title
			}

			finalDesc := existingDesc.String
			if finalDesc == "" {
				finalDesc = videoRes.Description
			}

			finalNow := time.Now().UnixMilli()
			_, err := db.DB.Exec(`
				UPDATE items 
				SET type = 'video', title = ?, description = ?, content_text = ?, processing_status = 'ready', updated_at = ?
				WHERE id = ?
			`, strings.TrimSpace(finalTitle), strings.TrimSpace(finalDesc), videoContent, finalNow, itemID)

			if err != nil {
				handleError(fmt.Errorf("更新数据库记录失败: %w", err))
				return
			}

			LogStep(itemID, "archive_complete", "success", "视频素材与封面归档建立成功")
			return
		} else if vErr != nil {
			LogStep(itemID, "video_meta_warn", "failed", fmt.Sprintf("专用视频解析失败，将降级尝试通用网页抓取: %v", vErr))
		}
	}

	// 3. General Webpage Fetch HTML with timeout and Chrome-like User-Agent
	LogStep(itemID, "fetch_html", "pending", fmt.Sprintf("Starting fetch for %s", targetURL))

	parsedURL, err := url.Parse(targetURL)
	if err != nil {
		handleError(fmt.Errorf("无效的 URL 格式: %w", err))
		return
	}

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

	// 4. Extract metadata and article using readability
	LogStep(itemID, "parse_content", "pending", "正在解析网页内容与正文")
	meta := extractMetaTags(htmlStr)

	// Try downloading og:image as thumbnail if available
	if meta.Image != "" {
		imgURL := meta.Image
		if strings.HasPrefix(imgURL, "//") {
			imgURL = "https:" + imgURL
		} else if strings.HasPrefix(imgURL, "/") {
			imgURL = parsedURL.Scheme + "://" + parsedURL.Host + imgURL
		}
		imgData, imgMime, imgErr := downloadImage(ctx, imgURL, targetURL)
		if imgErr == nil && len(imgData) > 0 {
			_, _ = SaveAssetFile(assetsDir, SaveAssetParams{
				ItemID:   itemID,
				Kind:     "thumbnail",
				MimeType: imgMime,
				FileName: "thumbnail.jpg",
				Data:     imgData,
			})
			LogStep(itemID, "save_thumbnail", "success", "提取到网页缩略图并归档")
		}
	}

	readerTitle := meta.Title
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

	// 5. Save Markdown Asset
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

	// 6. Update Item details
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
		if meta.Desc != "" {
			finalDesc = meta.Desc
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
