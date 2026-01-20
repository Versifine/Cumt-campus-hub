package search

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/Versifine/Cumt-cumpus-hub/server/store"
)

// Handler provides search API endpoints.
type Handler struct {
	Store store.API
}

// SearchPostsResponse is the response for post search.
type SearchPostsResponse struct {
	Data     []PostResult `json:"data"`
	Total    int          `json:"total"`
	Page     int          `json:"page"`
	PageSize int          `json:"page_size"`
}

// PostResult is a search result item for posts.
type PostResult struct {
	ID           string   `json:"id"`
	BoardID      string   `json:"board_id"`
	AuthorID     string   `json:"author_id"`
	AuthorName   string   `json:"author_name"`
	Title        string   `json:"title"`
	Content      string   `json:"content"`
	Tags         []string `json:"tags"`
	CreatedAt    string   `json:"created_at"`
	Score        int      `json:"score"`
	CommentCount int      `json:"comment_count"`
}

// SearchUsersResponse is the response for user search.
type SearchUsersResponse struct {
	Data     []UserResult `json:"data"`
	Total    int          `json:"total"`
	Page     int          `json:"page"`
	PageSize int          `json:"page_size"`
}

// UserResult is a search result item for users.
type UserResult struct {
	ID        string `json:"id"`
	Nickname  string `json:"nickname"`
	Avatar    string `json:"avatar"`
	Bio       string `json:"bio"`
	CreatedAt string `json:"created_at"`
}

// SearchPosts handles GET /api/v1/search/posts?q=xxx&page=1&page_size=20
func (h *Handler) SearchPosts(c *gin.Context) {
	query := strings.TrimSpace(c.Query("q"))
	if query == "" {
		c.JSON(http.StatusOK, SearchPostsResponse{
			Data:     []PostResult{},
			Total:    0,
			Page:     1,
			PageSize: 20,
		})
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
	posts, total := h.Store.SearchPosts(query, offset, pageSize)

	results := make([]PostResult, 0, len(posts))
	for _, post := range posts {
		authorName := ""
		if user, ok := h.Store.GetUser(post.AuthorID); ok {
			authorName = user.Nickname
		}

		// Truncate content for search results
		content := post.Content
		if len(content) > 200 {
			content = content[:200] + "..."
		}

		results = append(results, PostResult{
			ID:           post.ID,
			BoardID:      post.BoardID,
			AuthorID:     post.AuthorID,
			AuthorName:   authorName,
			Title:        post.Title,
			Content:      content,
			Tags:         post.Tags,
			CreatedAt:    post.CreatedAt,
			Score:        h.Store.PostScore(post.ID),
			CommentCount: h.Store.CommentCount(post.ID),
		})
	}

	c.JSON(http.StatusOK, SearchPostsResponse{
		Data:     results,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

// SearchUsers handles GET /api/v1/search/users?q=xxx&page=1&page_size=20
func (h *Handler) SearchUsers(c *gin.Context) {
	query := strings.TrimSpace(c.Query("q"))
	if query == "" {
		c.JSON(http.StatusOK, SearchUsersResponse{
			Data:     []UserResult{},
			Total:    0,
			Page:     1,
			PageSize: 20,
		})
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
	users, total := h.Store.SearchUsers(query, offset, pageSize)

	results := make([]UserResult, 0, len(users))
	for _, user := range users {
		results = append(results, UserResult{
			ID:        user.ID,
			Nickname:  user.Nickname,
			Avatar:    user.Avatar,
			Bio:       user.Bio,
			CreatedAt: user.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, SearchUsersResponse{
		Data:     results,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}
