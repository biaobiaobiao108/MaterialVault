package handlers

import (
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"materialvault/internal/db"
	"materialvault/internal/services"
	"materialvault/internal/utils"
)

func HandleUploads(assetsDir string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// 100 MB max memory limit
		if err := r.ParseMultipartForm(100 << 20); err != nil {
			utils.JSONError(w, http.StatusBadRequest, "解析上传数据失败: "+err.Error())
			return
		}

		form := r.MultipartForm
		files := form.File["file"]
		if len(files) == 0 {
			utils.JSONError(w, http.StatusBadRequest, "没有上传任何文件")
			return
		}

		title := strings.TrimSpace(r.FormValue("title"))
		description := strings.TrimSpace(r.FormValue("description"))
		tagIDs := form.Value["tagIds"]

		var createdItems []db.Item

		for _, f := range files {
			file, err := f.Open()
			if err != nil {
				continue
			}
			data, err := io.ReadAll(file)
			file.Close()
			if err != nil {
				continue
			}

			fileName := f.Filename
			if fileName == "" {
				fileName = "upload.bin"
			}

			mime := f.Header.Get("Content-Type")
			if mime == "" {
				mime = http.DetectContentType(data)
			}

			itemType := "document"
			if strings.HasPrefix(mime, "image/") {
				itemType = "image"
			} else if strings.HasPrefix(mime, "video/") {
				itemType = "video"
			}

			itemID := uuid.New().String()
			now := time.Now().UnixMilli()
			itemTitle := title
			if itemTitle == "" {
				itemTitle = fileName
			}

			contentText := ""
			if strings.Contains(mime, "text") || strings.HasSuffix(fileName, ".txt") || strings.HasSuffix(fileName, ".md") {
				contentText = string(data)
			}

			_, err = db.DB.Exec(`
				INSERT INTO items (id, type, title, description, source_url, canonical_url, source_domain, content_text, organization_status, processing_status, favorite, captured_at, created_at, updated_at)
				VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, 'inbox', 'ready', 0, ?, ?, ?)
			`, itemID, itemType, itemTitle, description, contentText, now, now, now)

			if err != nil {
				continue
			}

			// Save Asset
			_, _ = services.SaveAssetFile(assetsDir, services.SaveAssetParams{
				ItemID:   itemID,
				Kind:     "original",
				MimeType: mime,
				FileName: fileName,
				Data:     data,
			})

			// Link & extract tags
			SyncItemTags(itemID, tagIDs, itemTitle+" "+description+" "+contentText)

			full, err := GetFullItem(itemID)
			if err == nil && full != nil {
				createdItems = append(createdItems, *full)
			}
		}

		if len(createdItems) == 0 {
			utils.JSONError(w, http.StatusBadRequest, "未能成功保存上传的文件")
			return
		}

		utils.JSON(w, http.StatusCreated, map[string]any{"items": createdItems})
	}
}
