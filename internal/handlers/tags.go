package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"materialvault/internal/db"
	"materialvault/internal/utils"
)

type CreateTagRequest struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

type UpdateTagRequest struct {
	Name  *string `json:"name"`
	Color *string `json:"color"`
}

func HandleListTags(w http.ResponseWriter, r *http.Request) {
	query := `
		SELECT 
			tg.id,
			tg.name,
			tg.color,
			tg.created_at,
			COUNT(itg.item_id) as item_count
		FROM tags tg
		LEFT JOIN item_tags itg ON itg.tag_id = tg.id
		GROUP BY tg.id
		ORDER BY item_count DESC, tg.name ASC
	`

	rows, err := db.DB.Query(query)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "获取标签失败: "+err.Error())
		return
	}
	defer rows.Close()

	var tags []db.Tag
	for rows.Next() {
		var tg db.Tag
		if err := rows.Scan(&tg.ID, &tg.Name, &tg.Color, &tg.CreatedAt, &tg.ItemCount); err == nil {
			tags = append(tags, tg)
		}
	}

	if tags == nil {
		tags = []db.Tag{}
	}

	utils.JSON(w, http.StatusOK, map[string]any{"tags": tags})
}

func HandleCreateTag(w http.ResponseWriter, r *http.Request) {
	req, err := utils.ParseJSON[CreateTagRequest](r)
	if err != nil || strings.TrimSpace(req.Name) == "" {
		utils.JSONError(w, http.StatusBadRequest, "标签名称不能为空")
		return
	}

	name := strings.TrimPrefix(strings.TrimSpace(req.Name), "#")
	color := strings.TrimSpace(req.Color)
	if color == "" {
		color = "stone"
	}

	var existing db.Tag
	err = db.DB.QueryRow("SELECT id, name, color, created_at FROM tags WHERE name = ?", name).Scan(
		&existing.ID, &existing.Name, &existing.Color, &existing.CreatedAt,
	)
	if err == nil {
		utils.JSON(w, http.StatusOK, map[string]any{"tag": existing})
		return
	}

	newTag := db.Tag{
		ID:        uuid.New().String(),
		Name:      name,
		Color:     color,
		CreatedAt: time.Now().UnixMilli(),
	}

	_, err = db.DB.Exec("INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)",
		newTag.ID, newTag.Name, newTag.Color, newTag.CreatedAt)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "创建标签失败: "+err.Error())
		return
	}

	utils.JSON(w, http.StatusCreated, map[string]any{"tag": newTag})
}

func HandleUpdateTag(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	req, err := utils.ParseJSON[UpdateTagRequest](r)
	if err != nil {
		utils.JSONError(w, http.StatusBadRequest, "无效更新参数")
		return
	}

	var setClauses []string
	var args []any

	if req.Name != nil {
		cleaned := strings.TrimPrefix(strings.TrimSpace(*req.Name), "#")
		setClauses = append(setClauses, "name = ?")
		args = append(args, cleaned)
	}
	if req.Color != nil {
		setClauses = append(setClauses, "color = ?")
		args = append(args, *req.Color)
	}

	if len(setClauses) > 0 {
		args = append(args, id)
		query := "UPDATE tags SET " + strings.Join(setClauses, ", ") + " WHERE id = ?"
		_, err := db.DB.Exec(query, args...)
		if err != nil {
			utils.JSONError(w, http.StatusInternalServerError, "更新标签失败: "+err.Error())
			return
		}
	}

	var updated db.Tag
	err = db.DB.QueryRow("SELECT id, name, color, created_at FROM tags WHERE id = ?", id).Scan(
		&updated.ID, &updated.Name, &updated.Color, &updated.CreatedAt,
	)
	if err != nil {
		utils.JSONError(w, http.StatusNotFound, "标签不存在")
		return
	}

	utils.JSON(w, http.StatusOK, map[string]any{"tag": updated})
}

func HandleDeleteTag(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	_, err := db.DB.Exec("DELETE FROM tags WHERE id = ?", id)
	if err != nil {
		utils.JSONError(w, http.StatusInternalServerError, "删除标签失败: "+err.Error())
		return
	}
	utils.JSON(w, http.StatusOK, map[string]any{"success": true, "id": id})
}
