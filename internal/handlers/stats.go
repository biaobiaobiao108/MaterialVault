package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"materialvault/internal/db"
	"materialvault/internal/utils"
)

type TypeCount struct {
	Type  string `json:"type"`
	Count int    `json:"count"`
}

type DomainCount struct {
	Domain string `json:"domain"`
	Count  int    `json:"count"`
}

func HandleStats(w http.ResponseWriter, r *http.Request) {
	var totalItems, inboxCount, organizedCount, archivedCount, favoriteCount int
	var totalTags, assetCount int
	var assetBytes int64

	_ = db.DB.QueryRow("SELECT COUNT(*) FROM items").Scan(&totalItems)
	_ = db.DB.QueryRow("SELECT COUNT(*) FROM items WHERE organization_status = 'inbox'").Scan(&inboxCount)
	_ = db.DB.QueryRow("SELECT COUNT(*) FROM items WHERE organization_status = 'organized'").Scan(&organizedCount)
	_ = db.DB.QueryRow("SELECT COUNT(*) FROM items WHERE organization_status = 'archived'").Scan(&archivedCount)
	_ = db.DB.QueryRow("SELECT COUNT(*) FROM items WHERE favorite = 1").Scan(&favoriteCount)

	_ = db.DB.QueryRow("SELECT COUNT(*) FROM tags").Scan(&totalTags)
	_ = db.DB.QueryRow("SELECT COUNT(*), COALESCE(SUM(file_size), 0) FROM assets").Scan(&assetCount, &assetBytes)

	// Type counts
	var typeCounts []TypeCount
	tRows, err := db.DB.Query("SELECT type, COUNT(*) as count FROM items GROUP BY type")
	if err == nil {
		defer tRows.Close()
		for tRows.Next() {
			var tc TypeCount
			if err := tRows.Scan(&tc.Type, &tc.Count); err == nil {
				typeCounts = append(typeCounts, tc)
			}
		}
	}
	if typeCounts == nil {
		typeCounts = []TypeCount{}
	}

	// Top Domains
	var topDomains []DomainCount
	dRows, err := db.DB.Query("SELECT source_domain, COUNT(*) as count FROM items WHERE source_domain IS NOT NULL AND source_domain != '' GROUP BY source_domain ORDER BY count DESC LIMIT 10")
	if err == nil {
		defer dRows.Close()
		for dRows.Next() {
			var dc DomainCount
			if err := dRows.Scan(&dc.Domain, &dc.Count); err == nil {
				topDomains = append(topDomains, dc)
			}
		}
	}
	if topDomains == nil {
		topDomains = []DomainCount{}
	}

	utils.JSON(w, http.StatusOK, map[string]any{
		"totalItems":     totalItems,
		"inboxCount":     inboxCount,
		"organizedCount": organizedCount,
		"archivedCount":  archivedCount,
		"favoriteCount":  favoriteCount,
		"totalTags":      totalTags,
		"assetCount":     assetCount,
		"assetBytes":     assetBytes,
		"typeCounts":     typeCounts,
		"topDomains":     topDomains,
	})
}

func HandleBackup(w http.ResponseWriter, r *http.Request) {
	// 1. Fetch all items
	itemsRows, err := db.DB.Query("SELECT id, type, title, description, source_url, canonical_url, source_domain, content_text, organization_status, processing_status, favorite, captured_at, created_at, updated_at FROM items ORDER BY created_at DESC")
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "导出备份失败: "+err.Error())
		return
	}
	defer itemsRows.Close()

	var items []map[string]any
	for itemsRows.Next() {
		var id, itemType, title, description, contentText, orgStatus, procStatus string
		var sourceURL, canonicalURL, sourceDomain sqlNullString
		var favorite int
		var capturedAt, createdAt, updatedAt int64

		_ = itemsRows.Scan(&id, &itemType, &title, &description, &sourceURL.String, &canonicalURL.String, &sourceDomain.String, &contentText, &orgStatus, &procStatus, &favorite, &capturedAt, &createdAt, &updatedAt)
		items = append(items, map[string]any{
			"id":                  id,
			"type":                itemType,
			"title":               title,
			"description":         description,
			"source_url":          sourceURL.String,
			"canonical_url":       canonicalURL.String,
			"source_domain":       sourceDomain.String,
			"content_text":        contentText,
			"organization_status": orgStatus,
			"processing_status":   procStatus,
			"favorite":            favorite,
			"captured_at":         capturedAt,
			"created_at":          createdAt,
			"updated_at":          updatedAt,
		})
	}

	// 2. Fetch all tags
	tagsRows, _ := db.DB.Query("SELECT id, name, color, created_at FROM tags ORDER BY name ASC")
	var tags []map[string]any
	if tagsRows != nil {
		defer tagsRows.Close()
		for tagsRows.Next() {
			var id, name, color string
			var createdAt int64
			_ = tagsRows.Scan(&id, &name, &color, &createdAt)
			tags = append(tags, map[string]any{
				"id":         id,
				"name":       name,
				"color":      color,
				"created_at": createdAt,
			})
		}
	}

	// 3. Fetch all item_tags
	itRows, _ := db.DB.Query("SELECT item_id, tag_id, created_at FROM item_tags")
	var itemTags []map[string]any
	if itRows != nil {
		defer itRows.Close()
		for itRows.Next() {
			var itemID, tagID string
			var createdAt int64
			_ = itRows.Scan(&itemID, &tagID, &createdAt)
			itemTags = append(itemTags, map[string]any{
				"item_id":    itemID,
				"tag_id":     tagID,
				"created_at": createdAt,
			})
		}
	}

	// 4. Fetch all assets
	aRows, _ := db.DB.Query("SELECT id, item_id, kind, mime_type, file_name, file_size, storage_path, sha256, created_at FROM assets")
	var assets []map[string]any
	if aRows != nil {
		defer aRows.Close()
		for aRows.Next() {
			var id, itemID, kind, mimeType, fileName, storagePath, sha256 string
			var fileSize, createdAt int64
			_ = aRows.Scan(&id, &itemID, &kind, &mimeType, &fileName, &fileSize, &storagePath, &sha256, &createdAt)
			assets = append(assets, map[string]any{
				"id":           id,
				"item_id":      itemID,
				"kind":         kind,
				"mime_type":    mimeType,
				"file_name":    fileName,
				"file_size":    fileSize,
				"storage_path": storagePath,
				"sha256":       sha256,
				"created_at":   createdAt,
			})
		}
	}

	nowStr := time.Now().Format("2006-01-02")
	backupData := map[string]any{
		"version":    "1.0",
		"exportedAt": time.Now().UTC().Format(time.RFC3339),
		"stats": map[string]any{
			"itemCount":  len(items),
			"tagCount":   len(tags),
			"assetCount": len(assets),
		},
		"tags":     tags,
		"items":    items,
		"itemTags": itemTags,
		"assets":   assets,
	}

	fileName := fmt.Sprintf("material-vault-backup-%s.json", nowStr)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, fileName))
	w.Header().Set("Access-Control-Allow-Origin", "*")

	_ = json.NewEncoder(w).Encode(backupData)
}

type sqlNullString struct {
	String string
	Valid  bool
}
