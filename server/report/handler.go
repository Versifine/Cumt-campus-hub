package report

import (
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/Versifine/Cumt-cumpus-hub/server/auth"
	"github.com/Versifine/Cumt-cumpus-hub/server/store"
)

type Handler struct {
	Store store.API
	Auth  *auth.Service
}

func (h *Handler) Create(c *gin.Context) {
	user, ok := h.Auth.RequireUser(c)
	if !ok {
		return
	}

	var req struct {
		TargetType string `json:"target_type"`
		TargetID   string `json:"target_id"`
		Reason     string `json:"reason"`
		Detail     string `json:"detail"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, 2001, "invalid json")
		return
	}

	report, err := h.Store.CreateReport(user.ID, req.TargetType, req.TargetID, req.Reason, req.Detail)
	if err != nil {
		switch err {
		case store.ErrInvalidInput:
			writeError(c, http.StatusBadRequest, 2001, "missing fields")
		default:
			writeError(c, http.StatusInternalServerError, 5000, "server error")
		}
		return
	}

	resp := map[string]any{
		"id":         report.ID,
		"status":     report.Status,
		"created_at": report.CreatedAt,
	}
	c.JSON(http.StatusOK, resp)
}

func (h *Handler) AdminList(c *gin.Context) {
	user, ok := h.Auth.RequireUser(c)
	if !ok {
		return
	}
	if !isAdmin(user) {
		writeError(c, http.StatusForbidden, 1002, "forbidden")
		return
	}

	status := strings.TrimSpace(c.Query("status"))
	page := parsePositiveInt(c.Query("page"), 1)
	pageSize := parsePositiveInt(c.Query("page_size"), 20)

	items, total, err := h.Store.Reports(status, page, pageSize)
	if err != nil {
		writeError(c, http.StatusInternalServerError, 5000, "server error")
		return
	}

	resp := map[string]any{
		"items": items,
		"total": total,
	}
	c.JSON(http.StatusOK, resp)
}

func (h *Handler) AdminUpdate(c *gin.Context) {
	reportID := strings.TrimSpace(c.Param("id"))
	if reportID == "" {
		writeError(c, http.StatusNotFound, 2001, "not found")
		return
	}

	user, ok := h.Auth.RequireUser(c)
	if !ok {
		return
	}
	if !isAdmin(user) {
		writeError(c, http.StatusForbidden, 1002, "forbidden")
		return
	}

	var req struct {
		Status string `json:"status"`
		Action string `json:"action"`
		Note   string `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, 2001, "invalid json")
		return
	}

	updated, err := h.Store.UpdateReport(reportID, req.Status, req.Action, req.Note, user.ID)
	if err != nil {
		switch err {
		case store.ErrInvalidInput:
			writeError(c, http.StatusBadRequest, 2001, "missing fields")
		case store.ErrNotFound:
			writeError(c, http.StatusNotFound, 2001, "not found")
		default:
			writeError(c, http.StatusInternalServerError, 5000, "server error")
		}
		return
	}
	c.JSON(http.StatusOK, updated)
}

func isAdmin(user store.User) bool {
	raw := strings.TrimSpace(os.Getenv("ADMIN_ACCOUNTS"))
	if raw == "" {
		return false
	}
	parts := strings.FieldsFunc(raw, func(r rune) bool { return r == ',' || r == ';' || r == ' ' || r == '\t' || r == '\n' })
	for _, part := range parts {
		if strings.TrimSpace(part) == "" {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(part), user.Nickname) {
			return true
		}
	}
	return false
}

func parsePositiveInt(value string, fallback int) int {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func writeError(c *gin.Context, status int, code int, message string) {
	c.JSON(status, gin.H{"code": code, "message": message})
}
