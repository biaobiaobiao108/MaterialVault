package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"materialvault/internal/db"
	"materialvault/internal/services"
	"materialvault/internal/utils"
)

// SyncItemTags ensures extracted tags exist and links them to item
func SyncItemTags(itemID string, explicitTagIDs []string, textToScan string) {
	extractedNames := utils.ExtractHashtags(textToScan)
	now := time.Now().UnixMilli()

	finalTagIDs := make(map[string]bool)
	for _, id := range explicitTagIDs {
		if strings.TrimSpace(id) != "" {
			finalTagIDs[id] = true
		}
	}

	for _, name := range extractedNames {
		var existingID string
		err := db.DB.QueryRow("SELECT id FROM tags WHERE name = ?", name).Scan(&existingID)
		if err == sql.ErrNoRows {
			newID := uuid.New().String()
			_, _ = db.DB.Exec("INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, 'stone', ?)", newID, name, now)
			finalTagIDs[newID] = true
		} else if err == nil {
			finalTagIDs[existingID] = true
		}
	}

	for tagID := range finalTagIDs {
		_, _ = db.DB.Exec("INSERT OR IGNORE INTO item_tags (item_id, tag_id, created_at) VALUES (?, ?, ?)", itemID, tagID, now)
	}
}

// GetFullItem retrieves item with tags, assets, and logs
func GetFullItem(id string) (*db.Item, error) {
	var it db.Item
	var favoriteInt int
	var sourceURL, canonicalURL, sourceDomain sql.NullString
	var capturedAt sql.NullInt64

	row := db.DB.QueryRow(`
		SELECT id, type, title, description, source_url, canonical_url, source_domain, content_text, organization_status, processing_status, favorite, captured_at, created_at, updated_at
		FROM items
		WHERE id = ?
	`, id)

	err := row.Scan(
		&it.ID,
		&it.Type,
		&it.Title,
		&it.Description,
		&sourceURL,
		&canonicalURL,
		&sourceDomain,
		&it.ContentText,
		&it.OrganizationStatus,
		&it.ProcessingStatus,
		&favoriteInt,
		&capturedAt,
		&it.CreatedAt,
		&it.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if sourceURL.Valid {
		it.SourceURL = &sourceURL.String
	}
	if canonicalURL.Valid {
		it.CanonicalURL = &canonicalURL.String
	}
	if sourceDomain.Valid {
		it.SourceDomain = &sourceDomain.String
	}
	if capturedAt.Valid {
		it.CapturedAt = &capturedAt.Int64
	}
	it.Favorite = favoriteInt == 1

	// Fetch Tags
	tagRows, err := db.DB.Query(`
		SELECT tg.id, tg.name, tg.color, tg.created_at
		FROM tags tg
		JOIN item_tags itg ON itg.tag_id = tg.id
		WHERE itg.item_id = ?
	`, id)
	it.Tags = []db.Tag{}
	if err == nil {
		defer tagRows.Close()
		for tagRows.Next() {
			var tg db.Tag
			if err := tagRows.Scan(&tg.ID, &tg.Name, &tg.Color, &tg.CreatedAt); err == nil {
				it.Tags = append(it.Tags, tg)
			}
		}
	}

	// Fetch Assets
	assetRows, err := db.DB.Query(`
		SELECT id, item_id, kind, mime_type, file_name, file_size, storage_path, sha256, created_at
		FROM assets
		WHERE item_id = ?
		ORDER BY created_at DESC
	`, id)
	it.Assets = []db.Asset{}
	if err == nil {
		defer assetRows.Close()
		for assetRows.Next() {
			var a db.Asset
			if err := assetRows.Scan(&a.ID, &a.ItemID, &a.Kind, &a.MimeType, &a.FileName, &a.FileSize, &a.StoragePath, &a.SHA256, &a.CreatedAt); err == nil {
				it.Assets = append(it.Assets, a)
			}
		}
	}

	// Fetch Logs
	logRows, err := db.DB.Query(`
		SELECT id, item_id, step, status, message, created_at
		FROM ingestion_logs
		WHERE item_id = ?
		ORDER BY created_at DESC
	`, id)
	it.Logs = []db.IngestionLog{}
	if err == nil {
		defer logRows.Close()
		for logRows.Next() {
			var l db.IngestionLog
			if err := logRows.Scan(&l.ID, &l.ItemID, &l.Step, &l.Status, &l.Message, &l.CreatedAt); err == nil {
				it.Logs = append(it.Logs, l)
			}
		}
	}

	return &it, nil
}

type CaptureURLRequest struct {
	URL         string   `json:"url"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	TagIDs      []string `json:"tagIds"`
}

type CreateNoteRequest struct {
	Title   string   `json:"title"`
	Content string   `json:"content"`
	TagIDs  []string `json:"tagIds"`
}

type BatchRequest struct {
	ItemIDs []string `json:"itemIds"`
	Action  string   `json:"action"` // set_status, favorite, unfavorite, delete, add_tag, remove_tag
	Status  string   `json:"status"`
	TagID   string   `json:"tagId"`
}

func HandleCaptureURL(assetsDir string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		req, err := utils.ParseJSON[CaptureURLRequest](r)
		if err != nil || strings.TrimSpace(req.URL) == "" {
			utils.JSONError(w, http.StatusBadRequest, "无效请求参数")
			return
		}

		normalized, domain, err := utils.NormalizeURL(req.URL)
		if err != nil {
			utils.JSONError(w, http.StatusBadRequest, "URL 格式解析错误")
			return
		}

		// Check duplicate
		var existingID string
		err = db.DB.QueryRow("SELECT id FROM items WHERE canonical_url = ?", normalized).Scan(&existingID)
		if err == nil {
			SyncItemTags(existingID, req.TagIDs, req.Title+" "+req.Description)
			full, _ := GetFullItem(existingID)
			utils.JSON(w, http.StatusOK, map[string]any{"item": full, "isDuplicate": true})
			return
		}

		id := uuid.New().String()
		now := time.Now().UnixMilli()
		title := strings.TrimSpace(req.Title)
		if title == "" {
			title = normalized
		}
		description := strings.TrimSpace(req.Description)

		_, err = db.DB.Exec(`
			INSERT INTO items (id, type, title, description, source_url, canonical_url, source_domain, content_text, organization_status, processing_status, favorite, captured_at, created_at, updated_at)
			VALUES (?, 'url', ?, ?, ?, ?, ?, '', 'inbox', 'pending', 0, ?, ?, ?)
		`, id, title, description, req.URL, normalized, domain, now, now, now)

		if err != nil {
			utils.JSONError(w, http.StatusInternalServerError, "保存素材记录失败: "+err.Error())
			return
		}

		SyncItemTags(id, req.TagIDs, title+" "+description)

		// Async capture in background goroutine
		go func() {
			services.ProcessURLItem(assetsDir, id, normalized)
		}()

		full, _ := GetFullItem(id)
		utils.JSON(w, http.StatusAccepted, map[string]any{"item": full, "isDuplicate": false})
	}
}

func HandleCreateNote(w http.ResponseWriter, r *http.Request) {
	req, err := utils.ParseJSON[CreateNoteRequest](r)
	if err != nil || strings.TrimSpace(req.Content) == "" {
		utils.JSONError(w, http.StatusBadRequest, "请填写备忘内容")
		return
	}

	content := strings.TrimSpace(req.Content)
	lines := strings.Split(content, "\n")
	derivedTitle := strings.TrimSpace(req.Title)
	if derivedTitle == "" && len(lines) > 0 {
		if len(lines[0]) > 60 {
			derivedTitle = lines[0][:60]
		} else {
			derivedTitle = lines[0]
		}
	}
	if derivedTitle == "" {
		derivedTitle = "未命名备忘"
	}

	derivedDesc := ""
	if len(lines) > 1 {
		derivedDesc = strings.TrimSpace(strings.Join(lines[1:], "\n"))
	}

	id := uuid.New().String()
	now := time.Now().UnixMilli()

	_, err = db.DB.Exec(`
		INSERT INTO items (id, type, title, description, source_url, canonical_url, source_domain, content_text, organization_status, processing_status, favorite, captured_at, created_at, updated_at)
		VALUES (?, 'note', ?, ?, NULL, NULL, NULL, ?, 'inbox', 'ready', 0, ?, ?, ?)
	`, id, derivedTitle, derivedDesc, content, now, now, now)

	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "保存备忘失败: "+err.Error())
		return
	}

	SyncItemTags(id, req.TagIDs, derivedTitle+" "+content)

	full, _ := GetFullItem(id)
	utils.JSON(w, http.StatusCreated, map[string]any{"item": full})
}

func HandleBatchItems(w http.ResponseWriter, r *http.Request) {
	req, err := utils.ParseJSON[BatchRequest](r)
	if err != nil || len(req.ItemIDs) == 0 {
		utils.JSONError(w, http.StatusBadRequest, "无效批量请求参数")
		return
	}

	placeholders := strings.Repeat("?,", len(req.ItemIDs))
	placeholders = placeholders[:len(placeholders)-1]
	now := time.Now().UnixMilli()

	var args []any
	for _, id := range req.ItemIDs {
		args = append(args, id)
	}

	switch req.Action {
	case "set_status":
		if req.Status != "" {
			updateArgs := append([]any{req.Status, now}, args...)
			_, _ = db.DB.Exec(fmt.Sprintf("UPDATE items SET organization_status = ?, updated_at = ? WHERE id IN (%s)", placeholders), updateArgs...)
		}
	case "favorite":
		updateArgs := append([]any{now}, args...)
		_, _ = db.DB.Exec(fmt.Sprintf("UPDATE items SET favorite = 1, updated_at = ? WHERE id IN (%s)", placeholders), updateArgs...)
	case "unfavorite":
		updateArgs := append([]any{now}, args...)
		_, _ = db.DB.Exec(fmt.Sprintf("UPDATE items SET favorite = 0, updated_at = ? WHERE id IN (%s)", placeholders), updateArgs...)
	case "delete":
		_, _ = db.DB.Exec(fmt.Sprintf("DELETE FROM items WHERE id IN (%s)", placeholders), args...)
	case "add_tag":
		if req.TagID != "" {
			for _, itemID := range req.ItemIDs {
				_, _ = db.DB.Exec("INSERT OR IGNORE INTO item_tags (item_id, tag_id, created_at) VALUES (?, ?, ?)", itemID, req.TagID, now)
			}
		}
	case "remove_tag":
		if req.TagID != "" {
			delArgs := append(args, req.TagID)
			_, _ = db.DB.Exec(fmt.Sprintf("DELETE FROM item_tags WHERE item_id IN (%s) AND tag_id = ?", placeholders), delArgs...)
		}
	}

	utils.JSON(w, http.StatusOK, map[string]any{"success": true, "count": len(req.ItemIDs)})
}

func HandleRetryItem(assetsDir string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if id == "" {
			utils.JSONError(w, http.StatusBadRequest, "缺少 item id")
			return
		}

		var itType, sourceURL, canonicalURL sql.NullString
		err := db.DB.QueryRow("SELECT type, source_url, canonical_url FROM items WHERE id = ?", id).Scan(&itType, &sourceURL, &canonicalURL)
		if err != nil {
			utils.JSONError(w, http.StatusNotFound, "素材不存在")
			return
		}
		if itType.String != "url" || (!sourceURL.Valid && !canonicalURL.Valid) {
			utils.JSONError(w, http.StatusBadRequest, "仅支持 URL 类型的素材重新抓取")
			return
		}

		targetURL := canonicalURL.String
		if targetURL == "" {
			targetURL = sourceURL.String
		}

		go func() {
			services.ProcessURLItem(assetsDir, id, targetURL)
		}()

		utils.JSON(w, http.StatusOK, map[string]string{"message": "重新归档任务已提交"})
	}
}

func HandleListItems(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	status := q.Get("status")
	itemType := q.Get("type")
	tagID := q.Get("tagId")
	domain := q.Get("domain")
	favStr := q.Get("favorite")

	var favorite *bool
	if favStr == "true" || favStr == "1" {
		b := true
		favorite = &b
	} else if favStr == "false" || favStr == "0" {
		b := false
		favorite = &b
	}

	limit := 50
	if l, err := strconv.Atoi(q.Get("limit")); err == nil && l > 0 {
		limit = l
	}

	offset := 0
	if o, err := strconv.Atoi(q.Get("offset")); err == nil && o >= 0 {
		offset = o
	}

	var startDate, endDate *int64
	if s, err := strconv.ParseInt(q.Get("startDate"), 10, 64); err == nil {
		startDate = &s
	}
	if e, err := strconv.ParseInt(q.Get("endDate"), 10, 64); err == nil {
		endDate = &e
	}

	items, err := services.SearchItems(services.SearchFilters{
		Q:                  q.Get("q"),
		Type:               itemType,
		OrganizationStatus: status,
		TagID:              tagID,
		Domain:             domain,
		Favorite:           favorite,
		StartDate:          startDate,
		EndDate:            endDate,
		Limit:              limit,
		Offset:             offset,
	})

	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "获取素材列表失败: "+err.Error())
		return
	}

	if items == nil {
		items = []db.Item{}
	}

	utils.JSON(w, http.StatusOK, map[string]any{"items": items})
}

func HandleGetItem(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	item, err := GetFullItem(id)
	if err != nil {
		utils.JSONError(w, http.StatusNotFound, "素材不存在")
		return
	}
	utils.JSON(w, http.StatusOK, map[string]any{"item": item})
}

type UpdateItemRequest struct {
	Title              *string `json:"title"`
	Description        *string `json:"description"`
	ContentText        *string `json:"contentText"`
	OrganizationStatus *string `json:"organizationStatus"`
	Favorite           *bool   `json:"favorite"`
}

func HandleUpdateItem(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	req, err := utils.ParseJSON[UpdateItemRequest](r)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, "无效更新参数")
		return
	}

	var setClauses []string
	var args []any
	now := time.Now().UnixMilli()

	if req.Title != nil {
		setClauses = append(setClauses, "title = ?")
		args = append(args, *req.Title)
	}
	if req.Description != nil {
		setClauses = append(setClauses, "description = ?")
		args = append(args, *req.Description)
	}
	if req.ContentText != nil {
		setClauses = append(setClauses, "content_text = ?")
		args = append(args, *req.ContentText)
	}
	if req.OrganizationStatus != nil {
		setClauses = append(setClauses, "organization_status = ?")
		args = append(args, *req.OrganizationStatus)
	}
	if req.Favorite != nil {
		setClauses = append(setClauses, "favorite = ?")
		if *req.Favorite {
			args = append(args, 1)
		} else {
			args = append(args, 0)
		}
	}

	if len(setClauses) > 0 {
		setClauses = append(setClauses, "updated_at = ?")
		args = append(args, now)
		args = append(args, id)

		query := fmt.Sprintf("UPDATE items SET %s WHERE id = ?", strings.Join(setClauses, ", "))
		_, err = db.DB.Exec(query, args...)
		if err != nil {
			utils.JSONError(w, http.StatusInternalServerError, "更新素材失败: "+err.Error())
			return
		}
	}

	// Auto extract hashtags from updated content
	var fullText string
	if req.Title != nil {
		fullText += *req.Title + " "
	}
	if req.Description != nil {
		fullText += *req.Description + " "
	}
	if req.ContentText != nil {
		fullText += *req.ContentText
	}
	if strings.Contains(fullText, "#") {
		SyncItemTags(id, nil, fullText)
	}

	full, _ := GetFullItem(id)
	utils.JSON(w, http.StatusOK, map[string]any{"item": full})
}

func HandleDeleteItem(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	_, err := db.DB.Exec("DELETE FROM items WHERE id = ?", id)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "删除失败: "+err.Error())
		return
	}
	utils.JSON(w, http.StatusOK, map[string]any{"success": true, "id": id})
}

type LinkTagRequest struct {
	TagID   string `json:"tagId"`
	TagName string `json:"tagName"`
}

func HandleLinkItemTag(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	req, err := utils.ParseJSON[LinkTagRequest](r)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, "无效参数")
		return
	}

	targetTagID := req.TagID
	now := time.Now().UnixMilli()

	if targetTagID == "" && req.TagName != "" {
		cleaned := strings.TrimPrefix(strings.TrimSpace(req.TagName), "#")
		var existingID string
		err := db.DB.QueryRow("SELECT id FROM tags WHERE name = ?", cleaned).Scan(&existingID)
		if err == sql.ErrNoRows {
			newID := uuid.New().String()
			_, _ = db.DB.Exec("INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, 'stone', ?)", newID, cleaned, now)
			targetTagID = newID
		} else if err == nil {
			targetTagID = existingID
		}
	}

	if targetTagID == "" {
		utils.JSONError(w, http.StatusBadRequest, "缺少 tagId 或 tagName")
		return
	}

	_, _ = db.DB.Exec("INSERT OR IGNORE INTO item_tags (item_id, tag_id, created_at) VALUES (?, ?, ?)", id, targetTagID, now)

	full, _ := GetFullItem(id)
	utils.JSON(w, http.StatusOK, map[string]any{"item": full})
}

func HandleUnlinkItemTag(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	tagID := r.PathValue("tagId")

	_, _ = db.DB.Exec("DELETE FROM item_tags WHERE item_id = ? AND tag_id = ?", id, tagID)

	full, _ := GetFullItem(id)
	utils.JSON(w, http.StatusOK, map[string]any{"item": full})
}
