package community

import (
	"net/http"
	"strconv"

	"github.com/Versifine/Cumt-cumpus-hub/server/auth"
	"github.com/Versifine/Cumt-cumpus-hub/server/internal/transport"
	"github.com/Versifine/Cumt-cumpus-hub/server/store"
)

type Handler struct {
	Store *store.Store
	Auth  *auth.Service
}

func (h *Handler) Boards(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		transport.WriteError(w, http.StatusMethodNotAllowed, 2001, "method not allowed")
		return
	}

	transport.WriteJSON(w, http.StatusOK, h.Store.Boards())
}

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
