package community

import (
	"net/http"
	"net/netip"
	"strconv"
	"strings"
	"time"

	"github.com/Versifine/Cumt-cumpus-hub/server/auth"
	"github.com/Versifine/Cumt-cumpus-hub/server/internal/ratelimit"
	"github.com/Versifine/Cumt-cumpus-hub/server/internal/transport"
	"github.com/Versifine/Cumt-cumpus-hub/server/store"
)

type Handler struct {
	Store store.API
	Auth  *auth.Service
}

var (
	postLimiter    = ratelimit.NewFixedWindow(30*time.Second, 5)
	commentLimiter = ratelimit.NewFixedWindow(30*time.Second, 10)
)

// Boards handles GET /api/v1/boards.
func (h *Handler) Boards(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		transport.WriteError(w, http.StatusMethodNotAllowed, 2001, "method not allowed")
		return
	}

	transport.WriteJSON(w, http.StatusOK, h.Store.Boards())
}

// Posts handles GET /api/v1/posts and POST /api/v1/posts.
func (h *Handler) Posts(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.listPosts(w, r)
	case http.MethodPost:
		h.createPost(w, r)
	default:
		transport.WriteError(w, http.StatusMethodNotAllowed, 2001, "method not allowed")
	}
}

// Comments returns a handler for GET/POST /api/v1/posts/{post_id}/comments.
func (h *Handler) Comments(postID string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			h.listComments(w, r, postID)
		case http.MethodPost:
			h.createComment(w, r, postID)
		default:
			transport.WriteError(w, http.StatusMethodNotAllowed, 2001, "method not allowed")
		}
	}
}

// Post handles GET /api/v1/posts/{post_id} and DELETE /api/v1/posts/{post_id}.
func (h *Handler) Post(postID string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			h.getPost(w, r, postID)
		case http.MethodDelete:
			h.deletePost(w, r, postID)
		default:
			transport.WriteError(w, http.StatusMethodNotAllowed, 2001, "method not allowed")
		}
	}
}

// Comment handles DELETE /api/v1/posts/{post_id}/comments/{comment_id}.
func (h *Handler) Comment(postID, commentID string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			transport.WriteError(w, http.StatusMethodNotAllowed, 2001, "method not allowed")
			return
		}
		h.deleteComment(w, r, postID, commentID)
	}
}

func (h *Handler) listPosts(w http.ResponseWriter, r *http.Request) {
	boardID := r.URL.Query().Get("board_id")
	page := parsePositiveInt(r.URL.Query().Get("page"), 1)
	pageSize := parsePositiveInt(r.URL.Query().Get("page_size"), 20)

	posts := h.Store.Posts(boardID)
	total := len(posts)

	start := (page - 1) * pageSize
	if start > total {
		start = total
	}
	end := start + pageSize
	if end > total {
		end = total
	}

	items := make([]postItem, 0, end-start)
	for _, post := range posts[start:end] {
		author, _ := h.Store.GetUser(post.AuthorID)
		items = append(items, postItem{
			ID:    post.ID,
			Title: post.Title,
			Author: userSummary{
				ID:       author.ID,
				Nickname: author.Nickname,
			},
			CreatedAt: post.CreatedAt,
		})
	}

	resp := struct {
		Items []postItem `json:"items"`
		Total int        `json:"total"`
	}{
		Items: items,
		Total: total,
	}

	transport.WriteJSON(w, http.StatusOK, resp)
}

func (h *Handler) createPost(w http.ResponseWriter, r *http.Request) {
	user, ok := h.Auth.RequireUser(w, r)
	if !ok {
		return
	}
	if !h.allowWrite(postLimiter, r, user.ID) {
		transport.WriteError(w, http.StatusTooManyRequests, 1005, "rate limited")
		return
	}

	var req struct {
		BoardID string `json:"board_id"`
		Title   string `json:"title"`
		Content string `json:"content"`
	}
	if err := transport.ReadJSON(r, &req); err != nil {
		transport.WriteError(w, http.StatusBadRequest, 2001, "invalid json")
		return
	}
	if req.BoardID == "" || req.Title == "" {
		transport.WriteError(w, http.StatusBadRequest, 2001, "missing fields")
		return
	}
	if _, ok := h.Store.GetBoard(req.BoardID); !ok {
		transport.WriteError(w, http.StatusBadRequest, 2001, "invalid board_id")
		return
	}

	post := h.Store.CreatePost(req.BoardID, user.ID, req.Title, req.Content)
	resp := struct {
		ID        string `json:"id"`
		BoardID   string `json:"board_id"`
		AuthorID  string `json:"author_id"`
		Title     string `json:"title"`
		Content   string `json:"content"`
		CreatedAt string `json:"created_at"`
	}{
		ID:        post.ID,
		BoardID:   post.BoardID,
		AuthorID:  post.AuthorID,
		Title:     post.Title,
		Content:   post.Content,
		CreatedAt: post.CreatedAt,
	}

	transport.WriteJSON(w, http.StatusOK, resp)
}

func (h *Handler) listComments(w http.ResponseWriter, _ *http.Request, postID string) {
	if _, ok := h.Store.GetPost(postID); !ok {
		transport.WriteError(w, http.StatusNotFound, 2001, "not found")
		return
	}

	comments := h.Store.Comments(postID)
	items := make([]commentItem, 0, len(comments))
	for _, comment := range comments {
		author, _ := h.Store.GetUser(comment.AuthorID)
		items = append(items, commentItem{
			ID: comment.ID,
			Author: userSummary{
				ID:       author.ID,
				Nickname: author.Nickname,
			},
			Content:   comment.Content,
			CreatedAt: comment.CreatedAt,
		})
	}

	transport.WriteJSON(w, http.StatusOK, items)
}

func (h *Handler) createComment(w http.ResponseWriter, r *http.Request, postID string) {
	user, ok := h.Auth.RequireUser(w, r)
	if !ok {
		return
	}
	if !h.allowWrite(commentLimiter, r, user.ID) {
		transport.WriteError(w, http.StatusTooManyRequests, 1005, "rate limited")
		return
	}
	if _, ok := h.Store.GetPost(postID); !ok {
		transport.WriteError(w, http.StatusNotFound, 2001, "not found")
		return
	}

	var req struct {
		Content string `json:"content"`
	}
	if err := transport.ReadJSON(r, &req); err != nil {
		transport.WriteError(w, http.StatusBadRequest, 2001, "invalid json")
		return
	}
	if req.Content == "" {
		transport.WriteError(w, http.StatusBadRequest, 2001, "missing content")
		return
	}

	comment := h.Store.CreateComment(postID, user.ID, req.Content)
	resp := struct {
		ID        string `json:"id"`
		PostID    string `json:"post_id"`
		AuthorID  string `json:"author_id"`
		Content   string `json:"content"`
		CreatedAt string `json:"created_at"`
	}{
		ID:        comment.ID,
		PostID:    comment.PostID,
		AuthorID:  comment.AuthorID,
		Content:   comment.Content,
		CreatedAt: comment.CreatedAt,
	}

	transport.WriteJSON(w, http.StatusOK, resp)
}

func (h *Handler) getPost(w http.ResponseWriter, _ *http.Request, postID string) {
	postID = strings.TrimSpace(postID)
	if postID == "" {
		transport.WriteError(w, http.StatusNotFound, 2001, "not found")
		return
	}

	post, ok := h.Store.GetPost(postID)
	if !ok {
		transport.WriteError(w, http.StatusNotFound, 2001, "not found")
		return
	}

	board, _ := h.Store.GetBoard(post.BoardID)
	author, _ := h.Store.GetUser(post.AuthorID)

	var deletedAt *string
	if strings.TrimSpace(post.DeletedAt) != "" {
		value := post.DeletedAt
		deletedAt = &value
	}

	resp := struct {
		ID        string `json:"id"`
		Board     any    `json:"board"`
		Author    any    `json:"author"`
		Title     string `json:"title"`
		Content   string `json:"content"`
		CreatedAt string `json:"created_at"`
		DeletedAt any    `json:"deleted_at"`
	}{
		ID: post.ID,
		Board: map[string]any{
			"id":   board.ID,
			"name": board.Name,
		},
		Author: map[string]any{
			"id":       author.ID,
			"nickname": author.Nickname,
		},
		Title:     post.Title,
		Content:   post.Content,
		CreatedAt: post.CreatedAt,
		DeletedAt: deletedAt,
	}

	transport.WriteJSON(w, http.StatusOK, resp)
}

func (h *Handler) deletePost(w http.ResponseWriter, r *http.Request, postID string) {
	user, ok := h.Auth.RequireUser(w, r)
	if !ok {
		return
	}

	if err := h.Store.SoftDeletePost(postID, user.ID); err != nil {
		switch err {
		case store.ErrNotFound:
			transport.WriteError(w, http.StatusNotFound, 2001, "not found")
		case store.ErrForbidden:
			transport.WriteError(w, http.StatusForbidden, 1002, "forbidden")
		default:
			transport.WriteError(w, http.StatusInternalServerError, 5000, "server error")
		}
		return
	}

	transport.WriteJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *Handler) deleteComment(w http.ResponseWriter, r *http.Request, postID, commentID string) {
	user, ok := h.Auth.RequireUser(w, r)
	if !ok {
		return
	}

	if err := h.Store.SoftDeleteComment(postID, commentID, user.ID); err != nil {
		switch err {
		case store.ErrNotFound:
			transport.WriteError(w, http.StatusNotFound, 2001, "not found")
		case store.ErrForbidden:
			transport.WriteError(w, http.StatusForbidden, 1002, "forbidden")
		default:
			transport.WriteError(w, http.StatusInternalServerError, 5000, "server error")
		}
		return
	}

	transport.WriteJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *Handler) allowWrite(limiter *ratelimit.FixedWindow, r *http.Request, userID string) bool {
	ip := clientIP(r)
	if ip != "" && !limiter.Allow("ip:"+ip) {
		return false
	}
	if userID != "" && !limiter.Allow("user:"+userID) {
		return false
	}
	return true
}

func clientIP(r *http.Request) string {
	forwarded := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
	if forwarded != "" {
		first := strings.TrimSpace(strings.Split(forwarded, ",")[0])
		if addr, err := netip.ParseAddr(first); err == nil {
			return addr.String()
		}
	}

	hostport := strings.TrimSpace(r.RemoteAddr)
	if hostport == "" {
		return ""
	}
	if addrPort, err := netip.ParseAddrPort(hostport); err == nil {
		return addrPort.Addr().String()
	}
	if addr, err := netip.ParseAddr(hostport); err == nil {
		return addr.String()
	}
	return ""
}

type postItem struct {
	ID        string      `json:"id"`
	Title     string      `json:"title"`
	Author    userSummary `json:"author"`
	CreatedAt string      `json:"created_at"`
}

type commentItem struct {
	ID        string      `json:"id"`
	Author    userSummary `json:"author"`
	Content   string      `json:"content"`
	CreatedAt string      `json:"created_at"`
}

type userSummary struct {
	ID       string `json:"id"`
	Nickname string `json:"nickname"`
}

// parsePositiveInt parses a positive int and falls back when the input is empty or invalid.
func parsePositiveInt(value string, fallback int) int {
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}
