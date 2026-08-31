package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"net/url"
	"os"

	"materialvault/internal/db"
	"materialvault/internal/services"
	"materialvault/internal/utils"
)

func HandleGetAsset(assetsDir string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if id == "" {
			utils.JSONError(w, http.StatusBadRequest, "缺少 asset id")
			return
		}

		var a db.Asset
		err := db.DB.QueryRow(`
			SELECT id, item_id, kind, mime_type, file_name, file_size, storage_path, sha256, created_at
			FROM assets
			WHERE id = ?
		`, id).Scan(
			&a.ID, &a.ItemID, &a.Kind, &a.MimeType, &a.FileName, &a.FileSize, &a.StoragePath, &a.SHA256, &a.CreatedAt,
		)
		if err == sql.ErrNoRows {
			utils.JSONError(w, http.StatusNotFound, "资源不存在")
			return
		} else if err != nil {
			utils.JSONError(w, http.StatusInternalServerError, "查询资源失败: "+err.Error())
			return
		}

		filePath := services.GetAssetFilePath(assetsDir, a.StoragePath)
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			utils.JSONError(w, http.StatusNotFound, "文件未在磁盘中找到")
			return
		}

		mimeType := a.MimeType
		if mimeType == "" {
			mimeType = "application/octet-stream"
		}

		w.Header().Set("Content-Type", mimeType)
		w.Header().Set("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, url.QueryEscape(a.FileName)))
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		http.ServeFile(w, r, filePath)
	}
}
