package services

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	"materialvault/internal/db"
)

func ComputeSHA256(data []byte) string {
	hasher := sha256.New()
	hasher.Write(data)
	return hex.EncodeToString(hasher.Sum(nil))
}

type SaveAssetParams struct {
	ItemID   string
	Kind     string // original, screenshot, markdown, pdf, thumbnail
	MimeType string
	FileName string
	Data     []byte
}

func SaveAssetFile(assetsDir string, params SaveAssetParams) (*db.Asset, error) {
	hash := ComputeSHA256(params.Data)
	ext := filepath.Ext(params.FileName)
	if ext == "" {
		ext = GetExtensionFromMime(params.MimeType)
	}

	safeFileName := fmt.Sprintf("%s%s", hash, ext)
	filePath := filepath.Join(assetsDir, safeFileName)

	// Save to disk if not exists
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		if err := os.WriteFile(filePath, params.Data, 0644); err != nil {
			return nil, fmt.Errorf("failed to write asset file: %w", err)
		}
	}

	assetID := uuid.New().String()
	now := time.Now().UnixMilli()

	asset := &db.Asset{
		ID:          assetID,
		ItemID:      params.ItemID,
		Kind:        params.Kind,
		MimeType:    params.MimeType,
		FileName:    params.FileName,
		FileSize:    int64(len(params.Data)),
		StoragePath: safeFileName,
		SHA256:      hash,
		CreatedAt:   now,
	}

	query := `
		INSERT INTO assets (id, item_id, kind, mime_type, file_name, file_size, sha256, storage_path, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := db.DB.Exec(query,
		asset.ID,
		asset.ItemID,
		asset.Kind,
		asset.MimeType,
		asset.FileName,
		asset.FileSize,
		asset.SHA256,
		asset.StoragePath,
		asset.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to insert asset record: %w", err)
	}

	return asset, nil
}

func GetAssetFilePath(assetsDir, storagePath string) string {
	return filepath.Join(assetsDir, storagePath)
}

func GetExtensionFromMime(mime string) string {
	switch mime {
	case "text/html":
		return ".html"
	case "text/markdown":
		return ".md"
	case "text/plain":
		return ".txt"
	case "image/png":
		return ".png"
	case "image/jpeg":
		return ".jpg"
	case "image/webp":
		return ".webp"
	case "application/pdf":
		return ".pdf"
	case "video/mp4":
		return ".mp4"
	default:
		return ""
	}
}
