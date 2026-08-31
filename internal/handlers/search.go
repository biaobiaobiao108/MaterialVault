package handlers

import (
	"net/http"
	"strconv"

	"materialvault/internal/db"
	"materialvault/internal/services"
	"materialvault/internal/utils"
)

func HandleSearch(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	queryString := q.Get("q")
	itemType := q.Get("type")
	status := q.Get("status")
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

	var startDate, endDate *int64
	if s, err := strconv.ParseInt(q.Get("startDate"), 10, 64); err == nil {
		startDate = &s
	}
	if e, err := strconv.ParseInt(q.Get("endDate"), 10, 64); err == nil {
		endDate = &e
	}

	limit := 50
	if l, err := strconv.Atoi(q.Get("limit")); err == nil && l > 0 {
		limit = l
	}

	offset := 0
	if o, err := strconv.Atoi(q.Get("offset")); err == nil && o >= 0 {
		offset = o
	}

	results, err := services.SearchItems(services.SearchFilters{
		Q:                  queryString,
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
		utils.JSONError(w, http.StatusInternalServerError, "检索失败: "+err.Error())
		return
	}

	if results == nil {
		results = []db.Item{}
	}

	utils.JSON(w, http.StatusOK, map[string]any{
		"items": results,
		"count": len(results),
	})
}
