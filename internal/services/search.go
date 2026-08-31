package services

import (
	"database/sql"
	"fmt"
	"strings"

	"materialvault/internal/db"
)

type SearchFilters struct {
	Q                  string
	Type               string
	OrganizationStatus string
	TagID              string
	Domain             string
	Favorite           *bool
	StartDate          *int64
	EndDate            *int64
	Limit              int
	Offset             int
}

func SearchItems(filters SearchFilters) ([]db.Item, error) {
	if filters.Limit <= 0 {
		filters.Limit = 50
	}

	var whereClauses []string
	var args []any
	var joins []string

	// FTS5 Subquery + LIKE fallback
	if trimmedQ := strings.TrimSpace(filters.Q); trimmedQ != "" {
		rawTerms := strings.Fields(trimmedQ)
		var cleanedTerms []string
		for _, t := range rawTerms {
			cleaned := strings.ReplaceAll(t, `"`, "")
			cleaned = strings.ReplaceAll(cleaned, "*", "")
			if len(cleaned) > 0 {
				cleanedTerms = append(cleanedTerms, cleaned)
			}
		}

		if len(cleanedTerms) > 0 {
			var ftsTokens []string
			for _, t := range cleanedTerms {
				ftsTokens = append(ftsTokens, fmt.Sprintf(`"%s"*`, t))
			}
			ftsQuery := strings.Join(ftsTokens, " AND ")

			whereClauses = append(whereClauses,
				`(i.id IN (SELECT id FROM items_fts WHERE items_fts MATCH ?) OR i.title LIKE ? OR i.content_text LIKE ? OR i.description LIKE ?)`,
			)
			likePattern := "%" + trimmedQ + "%"
			args = append(args, ftsQuery, likePattern, likePattern, likePattern)
		}
	}

	if filters.Type != "" {
		whereClauses = append(whereClauses, "i.type = ?")
		args = append(args, filters.Type)
	}

	if filters.OrganizationStatus != "" {
		whereClauses = append(whereClauses, "i.organization_status = ?")
		args = append(args, filters.OrganizationStatus)
	}

	if filters.Domain != "" {
		whereClauses = append(whereClauses, "i.source_domain LIKE ?")
		args = append(args, "%"+filters.Domain+"%")
	}

	if filters.Favorite != nil {
		if *filters.Favorite {
			whereClauses = append(whereClauses, "i.favorite = 1")
		} else {
			whereClauses = append(whereClauses, "i.favorite = 0")
		}
	}

	if filters.StartDate != nil {
		whereClauses = append(whereClauses, "i.created_at >= ?")
		args = append(args, *filters.StartDate)
	}

	if filters.EndDate != nil {
		whereClauses = append(whereClauses, "i.created_at <= ?")
		args = append(args, *filters.EndDate)
	}

	if filters.TagID != "" {
		joins = append(joins, "JOIN item_tags itg ON itg.item_id = i.id")
		whereClauses = append(whereClauses, "itg.tag_id = ?")
		args = append(args, filters.TagID)
	}

	query := "SELECT DISTINCT i.id, i.type, i.title, i.description, i.source_url, i.canonical_url, i.source_domain, i.content_text, i.organization_status, i.processing_status, i.favorite, i.captured_at, i.created_at, i.updated_at FROM items i"
	if len(joins) > 0 {
		query += " " + strings.Join(joins, " ")
	}
	if len(whereClauses) > 0 {
		query += " WHERE " + strings.Join(whereClauses, " AND ")
	}
	query += " ORDER BY i.created_at DESC LIMIT ? OFFSET ?"
	args = append(args, filters.Limit, filters.Offset)

	rows, err := db.DB.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("search query error: %w", err)
	}
	defer rows.Close()

	var items []db.Item
	var itemIDs []string

	for rows.Next() {
		var it db.Item
		var favoriteInt int
		var sourceURL, canonicalURL, sourceDomain sql.NullString
		var capturedAt sql.NullInt64

		err := rows.Scan(
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
			return nil, fmt.Errorf("scan item error: %w", err)
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
		it.Tags = []db.Tag{}
		it.Assets = []db.Asset{}

		items = append(items, it)
		itemIDs = append(itemIDs, it.ID)
	}

	if len(itemIDs) > 0 {
		PopulateTagsAndAssets(items, itemIDs)
	}

	return items, nil
}

func PopulateTagsAndAssets(items []db.Item, itemIDs []string) {
	if len(itemIDs) == 0 {
		return
	}

	placeholders := strings.Repeat("?,", len(itemIDs))
	placeholders = placeholders[:len(placeholders)-1]

	var args []any
	for _, id := range itemIDs {
		args = append(args, id)
	}

	// 1. Tags
	tagQuery := fmt.Sprintf(`
		SELECT itg.item_id, tg.id, tg.name, tg.color, tg.created_at
		FROM tags tg
		JOIN item_tags itg ON itg.tag_id = tg.id
		WHERE itg.item_id IN (%s)
	`, placeholders)

	tagRows, err := db.DB.Query(tagQuery, args...)
	if err == nil {
		defer tagRows.Close()
		tagsByItem := make(map[string][]db.Tag)
		for tagRows.Next() {
			var itemID string
			var tg db.Tag
			if err := tagRows.Scan(&itemID, &tg.ID, &tg.Name, &tg.Color, &tg.CreatedAt); err == nil {
				tagsByItem[itemID] = append(tagsByItem[itemID], tg)
			}
		}
		for i := range items {
			if tgList, ok := tagsByItem[items[i].ID]; ok {
				items[i].Tags = tgList
			}
		}
	}

	// 2. Assets
	assetQuery := fmt.Sprintf(`
		SELECT id, item_id, kind, mime_type, file_name, file_size, storage_path, sha256, created_at
		FROM assets
		WHERE item_id IN (%s)
		ORDER BY created_at DESC
	`, placeholders)

	assetRows, err := db.DB.Query(assetQuery, args...)
	if err == nil {
		defer assetRows.Close()
		assetsByItem := make(map[string][]db.Asset)
		for assetRows.Next() {
			var a db.Asset
			if err := assetRows.Scan(&a.ID, &a.ItemID, &a.Kind, &a.MimeType, &a.FileName, &a.FileSize, &a.StoragePath, &a.SHA256, &a.CreatedAt); err == nil {
				assetsByItem[a.ItemID] = append(assetsByItem[a.ItemID], a)
			}
		}
		for i := range items {
			if aList, ok := assetsByItem[items[i].ID]; ok {
				items[i].Assets = aList
			}
		}
	}
}
