package notification

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/Versifine/Cumt-cumpus-hub/server/auth"
	"github.com/Versifine/Cumt-cumpus-hub/server/store"
)

// Handler provides notification API endpoints.
type Handler struct {
	Store store.API
	Auth  *auth.Service
}

// NotificationResponse is a single notification in API responses.
type NotificationResponse struct {
	ID          string `json:"id"`
	ActorID     string `json:"actor_id"`
	ActorName   string `json:"actor_name"`
	ActorAvatar string `json:"actor_avatar"`
	Type        string `json:"type"`
	TargetType  string `json:"target_type,omitempty"`
	TargetID    string `json:"target_id,omitempty"`
	Read        bool   `json:"read"`
	CreatedAt   string `json:"created_at"`
}

// ListResponse is the response for listing notifications.
type ListResponse struct {
	Data     []NotificationResponse `json:"data"`
	Total    int                    `json:"total"`
	Page     int                    `json:"page"`
	PageSize int                    `json:"page_size"`
}

// List handles GET /api/v1/notifications
func (h *Handler) List(c *gin.Context) {
	user, ok := h.Auth.RequireUser(c)
	if !ok {
		return
	}

	page := 1
	if p, err := strconv.Atoi(c.Query("page")); err == nil && p > 0 {
		page = p
	}
	pageSize := 20
	if ps, err := strconv.Atoi(c.Query("page_size")); err == nil && ps > 0 && ps <= 100 {
		pageSize = ps
	}

	offset := (page - 1) * pageSize
	notifications, total := h.Store.Notifications(user.ID, offset, pageSize)

	results := make([]NotificationResponse, 0, len(notifications))
	for _, n := range notifications {
		actorName := ""
		actorAvatar := ""
		if actor, ok := h.Store.GetUser(n.ActorID); ok {
			actorName = actor.Nickname
			actorAvatar = actor.Avatar
		}

		results = append(results, NotificationResponse{
			ID:          n.ID,
			ActorID:     n.ActorID,
			ActorName:   actorName,
			ActorAvatar: actorAvatar,
			Type:        n.Type,
			TargetType:  n.TargetType,
			TargetID:    n.TargetID,
			Read:        strings.TrimSpace(n.ReadAt) != "",
			CreatedAt:   n.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, ListResponse{
		Data:     results,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

// UnreadCount handles GET /api/v1/notifications/unread-count
func (h *Handler) UnreadCount(c *gin.Context) {
	user, ok := h.Auth.RequireUser(c)
	if !ok {
		return
	}

	count := h.Store.UnreadNotificationCount(user.ID)
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// MarkRead handles PATCH /api/v1/notifications/:id
func (h *Handler) MarkRead(c *gin.Context) {
	user, ok := h.Auth.RequireUser(c)
	if !ok {
		return
	}

	notificationID := c.Param("id")
	if err := h.Store.MarkNotificationRead(notificationID, user.ID); err != nil {
		if err == store.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "notification not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to mark as read"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// MarkAllRead handles POST /api/v1/notifications/read-all
func (h *Handler) MarkAllRead(c *gin.Context) {
	user, ok := h.Auth.RequireUser(c)
	if !ok {
		return
	}

	if err := h.Store.MarkAllNotificationsRead(user.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to mark all as read"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}
