package community

import (
	"encoding/json"
	"log"
	"math"
	"net/http"
	"net/netip"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/Versifine/Cumt-cumpus-hub/server/auth"
	"github.com/Versifine/Cumt-cumpus-hub/server/internal/ratelimit"
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

const (
	postSortLatest = "latest"
	postSortHot    = "hot"
)

func normalizePostSort(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == postSortHot {
		return postSortHot
	}
	return postSortLatest
}

func hotScore(score int, commentCount int, createdAt string) float64 {
	createdTime, err := time.Parse(time.RFC3339, createdAt)
	if err != nil {
		return float64(score + commentCount*2)
	}
	ageHours := time.Since(createdTime).Hours()
	if ageHours < 0 {
		ageHours = 0
	}
	weighted := float64(score + commentCount*2)
	return weighted / math.Pow(ageHours+2, 1.5)
}

// GetBoards handles GET /api/v1/boards.
func (h *Handler) GetBoards(c *gin.Context) {
	c.JSON(http.StatusOK, h.Store.Boards())
}

// ListPosts handles GET /api/v1/posts.
func (h *Handler) ListPosts(c *gin.Context) {
	boardID := c.Query("board_id")
	authorID := c.Query("author_id")
	sortBy := normalizePostSort(c.Query("sort"))
	page := parsePositiveInt(c.Query("page"), 1)
	pageSize := parsePositiveInt(c.Query("page_size"), 20)

	viewerID := h.viewerID(c)
	posts := h.Store.Posts(boardID)
	if authorID != "" {
		filtered := make([]store.Post, 0, len(posts))
		for _, post := range posts {
			if post.AuthorID == authorID {
				filtered = append(filtered, post)
			}
		}
		posts = filtered
	}

	postMeta := make(map[string]struct {
		score        int
		commentCount int
		hotScore     float64
	}, len(posts))
	for _, post := range posts {
		score := h.Store.PostScore(post.ID)
		commentCount := h.Store.CommentCount(post.ID)
		postMeta[post.ID] = struct {
			score        int
			commentCount int
			hotScore     float64
		}{
			score:        score,
			commentCount: commentCount,
			hotScore:     hotScore(score, commentCount, post.CreatedAt),
		}
	}

	sort.SliceStable(posts, func(i, j int) bool {
		if sortBy == postSortHot {
			left := postMeta[posts[i].ID].hotScore
			right := postMeta[posts[j].ID].hotScore
			if left == right {
				return posts[i].CreatedAt > posts[j].CreatedAt
			}
			return left > right
		}
		return posts[i].CreatedAt > posts[j].CreatedAt
	})
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
		board, _ := h.Store.GetBoard(post.BoardID)
		var boardInfo *boardSummary
		if strings.TrimSpace(board.ID) != "" {
			boardInfo = &boardSummary{
				ID:   board.ID,
				Name: board.Name,
			}
		}
		meta := postMeta[post.ID]
		score := meta.score
		myVote := 0
		if viewerID != "" {
			myVote = h.Store.PostVote(post.ID, viewerID)
		}
		commentCount := meta.commentCount

		items = append(items, postItem{
			ID:           post.ID,
			Title:        post.Title,
			Content:      post.Content,
			ContentJSON:  safeJSON(post.ContentJSON),
			Tags:         post.Tags,
			Attachments:  h.attachmentsFromIDs(post.Attachments),
			Score:        score,
			CommentCount: commentCount,
			MyVote:       myVote,
			Author:       userSummaryFromUser(author),
			Board:        boardInfo,
			CreatedAt:    post.CreatedAt,
		})
	}

	resp := struct {
		Items []postItem `json:"items"`
		Total int        `json:"total"`
	}{
		Items: items,
		Total: total,
	}

	c.JSON(http.StatusOK, resp)
}

// CreatePost handles POST /api/v1/posts.
func (h *Handler) CreatePost(c *gin.Context) {
	user, ok := h.Auth.RequireUser(c)
	if !ok {
		return
	}
	if !h.allowWrite(postLimiter, c, user.ID) {
		writeError(c, http.StatusTooManyRequests, 1005, "rate limited")
		return
	}

	var req struct {
		BoardID     string          `json:"board_id"`
		Title       string          `json:"title"`
		Content     string          `json:"content"`
		ContentJSON json.RawMessage `json:"content_json"`
		Tags        []string        `json:"tags"`
		Attachments []string        `json:"attachments"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, 2001, "invalid json")
		return
	}
	if req.BoardID == "" || req.Title == "" {
		writeError(c, http.StatusBadRequest, 2001, "missing fields")
		return
	}
	if _, ok := h.Store.GetBoard(req.BoardID); !ok {
		writeError(c, http.StatusBadRequest, 2001, "invalid board_id")
		return
	}

	contentJSON := strings.TrimSpace(string(req.ContentJSON))
	attachments := normalizeAttachmentIDs(req.Attachments)
	if len(attachments) > maxPostAttachments {
		writeError(c, http.StatusBadRequest, 2001, "too many attachments")
		return
	}
	for _, fileID := range attachments {
		if _, ok := h.Store.GetFile(fileID); !ok {
			writeError(c, http.StatusBadRequest, 2001, "invalid attachment_id")
			return
		}
	}

	if strings.TrimSpace(req.Content) == "" && contentJSON == "" && len(attachments) == 0 {
		writeError(c, http.StatusBadRequest, 2001, "missing content")
		return
	}
	tags := normalizeTags(req.Tags, maxPostTags)
	post := h.Store.CreatePost(req.BoardID, user.ID, req.Title, req.Content, contentJSON, tags, attachments)
	if err := h.Store.AddUserExp(user.ID, 10); err != nil {
		log.Printf("failed to add post exp for user %s: %v", user.ID, err)
	}
	resp := struct {
		ID          string           `json:"id"`
		BoardID     string           `json:"board_id"`
		AuthorID    string           `json:"author_id"`
		Title       string           `json:"title"`
		Content     string           `json:"content"`
		ContentJSON json.RawMessage  `json:"content_json,omitempty"`
		Tags        []string         `json:"tags"`
		Attachments []attachmentItem `json:"attachments"`
		CreatedAt   string           `json:"created_at"`
	}{
		ID:          post.ID,
		BoardID:     post.BoardID,
		AuthorID:    post.AuthorID,
		Title:       post.Title,
		Content:     post.Content,
		ContentJSON: safeJSON(post.ContentJSON),
		Tags:        post.Tags,
		Attachments: h.attachmentsFromIDs(post.Attachments),
		CreatedAt:   post.CreatedAt,
	}

	c.JSON(http.StatusOK, resp)
}

// ListComments handles GET /api/v1/posts/{post_id}/comments.
func (h *Handler) ListComments(c *gin.Context) {
	postID := strings.TrimSpace(c.Param("id"))
	if postID == "" {
		writeError(c, http.StatusNotFound, 2001, "not found")
		return
	}
	if _, ok := h.Store.GetPost(postID); !ok {
		writeError(c, http.StatusNotFound, 2001, "not found")
		return
	}

	viewerID := h.viewerID(c)
	comments := h.Store.Comments(postID)
	items := make([]commentItem, 0, len(comments))
	for _, comment := range comments {
		author, _ := h.Store.GetUser(comment.AuthorID)
		var parentID *string
		if strings.TrimSpace(comment.ParentID) != "" {
			value := comment.ParentID
			parentID = &value
		}
		score := h.Store.CommentScore(postID, comment.ID)
		myVote := 0
		if viewerID != "" {
			myVote = h.Store.CommentVote(postID, comment.ID, viewerID)
		}
		items = append(items, commentItem{
			ID:          comment.ID,
			ParentID:    parentID,
			Author:      userSummaryFromUser(author),
			Floor:       comment.Floor,
			Content:     comment.Content,
			ContentJSON: safeJSON(comment.ContentJSON),
			Tags:        comment.Tags,
			Attachments: h.attachmentsFromIDs(comment.Attachments),
			CreatedAt:   comment.CreatedAt,
			Score:       score,
			MyVote:      myVote,
		})
	}

	c.JSON(http.StatusOK, items)
}

// CreateComment handles POST /api/v1/posts/{post_id}/comments.
func (h *Handler) CreateComment(c *gin.Context) {
	postID := strings.TrimSpace(c.Param("id"))
	if postID == "" {
		writeError(c, http.StatusNotFound, 2001, "not found")
		return
	}

	user, ok := h.Auth.RequireUser(c)
	if !ok {
		return
	}
	if !h.allowWrite(commentLimiter, c, user.ID) {
		writeError(c, http.StatusTooManyRequests, 1005, "rate limited")
		return
	}
	if _, ok := h.Store.GetPost(postID); !ok {
		writeError(c, http.StatusNotFound, 2001, "not found")
		return
	}

	var req struct {
		Content     string          `json:"content"`
		ContentJSON json.RawMessage `json:"content_json"`
		ParentID    string          `json:"parent_id"`
		Tags        []string        `json:"tags"`
		Attachments []string        `json:"attachments"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, 2001, "invalid json")
		return
	}
	parentIDValue := strings.TrimSpace(req.ParentID)
	if parentIDValue != "" {
		if _, ok := h.Store.GetComment(postID, parentIDValue); !ok {
			writeError(c, http.StatusBadRequest, 2001, "invalid parent_id")
			return
		}
	}

	contentJSON := strings.TrimSpace(string(req.ContentJSON))
	attachments := normalizeAttachmentIDs(req.Attachments)
	if len(attachments) > maxCommentAttachments {
		writeError(c, http.StatusBadRequest, 2001, "too many attachments")
		return
	}
	for _, fileID := range attachments {
		if _, ok := h.Store.GetFile(fileID); !ok {
			writeError(c, http.StatusBadRequest, 2001, "invalid attachment_id")
			return
		}
	}
	if strings.TrimSpace(req.Content) == "" && contentJSON == "" && len(attachments) == 0 {
		writeError(c, http.StatusBadRequest, 2001, "missing content")
		return
	}

	tags := normalizeTags(req.Tags, maxCommentTags)
	comment := h.Store.CreateComment(postID, user.ID, req.Content, contentJSON, parentIDValue, tags, attachments)
	if err := h.Store.AddUserExp(user.ID, 2); err != nil {
		log.Printf("failed to add comment exp for user %s: %v", user.ID, err)
	}

	// Trigger notifications
	h.triggerCommentNotifications(postID, comment, user.ID, parentIDValue)

	var parentID *string
	if strings.TrimSpace(comment.ParentID) != "" {
		value := comment.ParentID
		parentID = &value
	}
	resp := struct {
		ID          string           `json:"id"`
		PostID      string           `json:"post_id"`
		ParentID    *string          `json:"parent_id"`
		AuthorID    string           `json:"author_id"`
		Floor       int              `json:"floor"`
		Content     string           `json:"content"`
		ContentJSON json.RawMessage  `json:"content_json,omitempty"`
		Tags        []string         `json:"tags"`
		Attachments []attachmentItem `json:"attachments"`
		CreatedAt   string           `json:"created_at"`
		Score       int              `json:"score"`
		MyVote      int              `json:"my_vote"`
	}{
		ID:          comment.ID,
		PostID:      comment.PostID,
		ParentID:    parentID,
		AuthorID:    comment.AuthorID,
		Floor:       comment.Floor,
		Content:     comment.Content,
		ContentJSON: safeJSON(comment.ContentJSON),
		Tags:        comment.Tags,
		Attachments: h.attachmentsFromIDs(comment.Attachments),
		CreatedAt:   comment.CreatedAt,
		Score:       0,
		MyVote:      0,
	}

	c.JSON(http.StatusOK, resp)
}

// GetPost handles GET /api/v1/posts/{post_id}.
func (h *Handler) GetPost(c *gin.Context) {
	postID := strings.TrimSpace(c.Param("id"))
	if postID == "" {
		writeError(c, http.StatusNotFound, 2001, "not found")
		return
	}

	post, ok := h.Store.GetPost(postID)
	if !ok {
		writeError(c, http.StatusNotFound, 2001, "not found")
		return
	}

	board, _ := h.Store.GetBoard(post.BoardID)
	author, _ := h.Store.GetUser(post.AuthorID)
	authorLevel := store.LevelForExp(author.Exp)
	score := h.Store.PostScore(post.ID)
	commentCount := h.Store.CommentCount(post.ID)
	myVote := 0
	if viewerID := h.viewerID(c); viewerID != "" {
		myVote = h.Store.PostVote(post.ID, viewerID)
	}
	go func(postID string) {
		_ = h.Store.IncrementPostViewCount(postID)
	}(post.ID)

	var deletedAt *string
	if strings.TrimSpace(post.DeletedAt) != "" {
		value := post.DeletedAt
		deletedAt = &value
	}

	resp := struct {
		ID           string           `json:"id"`
		Board        any              `json:"board"`
		Author       any              `json:"author"`
		Title        string           `json:"title"`
		Content      string           `json:"content"`
		ContentJSON  json.RawMessage  `json:"content_json,omitempty"`
		Tags         []string         `json:"tags"`
		Attachments  []attachmentItem `json:"attachments"`
		Score        int              `json:"score"`
		MyVote       int              `json:"my_vote"`
		CommentCount int              `json:"comment_count"`
		ViewCount    int              `json:"view_count"`
		CreatedAt    string           `json:"created_at"`
		DeletedAt    any              `json:"deleted_at"`
	}{
		ID: post.ID,
		Board: map[string]any{
			"id":   board.ID,
			"name": board.Name,
		},
		Author: map[string]any{
			"id":          author.ID,
			"nickname":    author.Nickname,
			"avatar":      author.Avatar,
			"level":       authorLevel.Level,
			"level_title": authorLevel.Title,
		},
		Title:        post.Title,
		Content:      post.Content,
		ContentJSON:  safeJSON(post.ContentJSON),
		Tags:         post.Tags,
		Attachments:  h.attachmentsFromIDs(post.Attachments),
		Score:        score,
		MyVote:       myVote,
		CommentCount: commentCount,
		ViewCount:    post.ViewCount,
		CreatedAt:    post.CreatedAt,
		DeletedAt:    deletedAt,
	}

	c.JSON(http.StatusOK, resp)
}

// DeletePost handles DELETE /api/v1/posts/{post_id}.
func (h *Handler) DeletePost(c *gin.Context) {
	postID := strings.TrimSpace(c.Param("id"))
	if postID == "" {
		writeError(c, http.StatusNotFound, 2001, "not found")
		return
	}

	user, ok := h.Auth.RequireUser(c)
	if !ok {
		return
	}

	if err := h.Store.SoftDeletePost(postID, user.ID, isAdmin(user)); err != nil {
		switch err {
		case store.ErrNotFound:
			writeError(c, http.StatusNotFound, 2001, "not found")
		case store.ErrForbidden:
			writeError(c, http.StatusForbidden, 1002, "forbidden")
		default:
			writeError(c, http.StatusInternalServerError, 5000, "server error")
		}
		return
	}

	c.JSON(http.StatusOK, map[string]string{"status": "deleted"})
}

// VotePost handles POST /api/v1/posts/{post_id}/votes.
func (h *Handler) VotePost(c *gin.Context) {
	postID := strings.TrimSpace(c.Param("id"))
	if postID == "" {
		writeError(c, http.StatusNotFound, 2001, "not found")
		return
	}

	user, ok := h.Auth.RequireUser(c)
	if !ok {
		return
	}

	var req struct {
		Value int `json:"value"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, 2001, "invalid json")
		return
	}
	if req.Value != 1 && req.Value != -1 {
		writeError(c, http.StatusBadRequest, 2001, "invalid vote value")
		return
	}

	score, myVote, err := h.Store.VotePost(postID, user.ID, req.Value)
	if err != nil {
		switch err {
		case store.ErrNotFound:
			writeError(c, http.StatusNotFound, 2001, "not found")
		case store.ErrInvalidInput:
			writeError(c, http.StatusBadRequest, 2001, "invalid input")
		default:
			writeError(c, http.StatusInternalServerError, 5000, "server error")
		}
		return
	}

	// Trigger like notification only for upvotes
	if req.Value == 1 {
		if post, ok := h.Store.GetPost(postID); ok && post.AuthorID != user.ID {
			_, _ = h.Store.CreateNotification(post.AuthorID, user.ID, "like", "post", postID)
		}
	}

	resp := map[string]any{
		"post_id": postID,
		"score":   score,
		"my_vote": myVote,
	}
	c.JSON(http.StatusOK, resp)
}

// ClearPostVote handles DELETE /api/v1/posts/{post_id}/votes.
func (h *Handler) ClearPostVote(c *gin.Context) {
	postID := strings.TrimSpace(c.Param("id"))
	if postID == "" {
		writeError(c, http.StatusNotFound, 2001, "not found")
		return
	}

	user, ok := h.Auth.RequireUser(c)
	if !ok {
		return
	}

	score, myVote, err := h.Store.ClearPostVote(postID, user.ID)
	if err != nil {
		switch err {
		case store.ErrNotFound:
			writeError(c, http.StatusNotFound, 2001, "not found")
		case store.ErrInvalidInput:
			writeError(c, http.StatusBadRequest, 2001, "invalid input")
		default:
			writeError(c, http.StatusInternalServerError, 5000, "server error")
		}
		return
	}

	resp := map[string]any{
		"post_id": postID,
		"score":   score,
		"my_vote": myVote,
	}
	c.JSON(http.StatusOK, resp)
}

// DeleteComment handles DELETE /api/v1/posts/{post_id}/comments/{comment_id}.
func (h *Handler) DeleteComment(c *gin.Context) {
	postID := strings.TrimSpace(c.Param("id"))
	commentID := strings.TrimSpace(c.Param("commentId"))

	if postID == "" || commentID == "" {
		writeError(c, http.StatusNotFound, 2001, "not found")
		return
	}

	user, ok := h.Auth.RequireUser(c)
	if !ok {
		return
	}

	if err := h.Store.SoftDeleteComment(postID, commentID, user.ID, isAdmin(user)); err != nil {
		switch err {
		case store.ErrNotFound:
			writeError(c, http.StatusNotFound, 2001, "not found")
		case store.ErrForbidden:
			writeError(c, http.StatusForbidden, 1002, "forbidden")
		default:
			writeError(c, http.StatusInternalServerError, 5000, "server error")
		}
		return
	}

	c.JSON(http.StatusOK, map[string]string{"status": "deleted"})
}

// VoteComment handles POST /api/v1/posts/{post_id}/comments/{comment_id}/votes.
func (h *Handler) VoteComment(c *gin.Context) {
	postID := strings.TrimSpace(c.Param("id"))
	commentID := strings.TrimSpace(c.Param("commentId"))
	if postID == "" || commentID == "" {
		writeError(c, http.StatusNotFound, 2001, "not found")
		return
	}

	user, ok := h.Auth.RequireUser(c)
	if !ok {
		return
	}

	var req struct {
		Value int `json:"value"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, 2001, "invalid json")
		return
	}
	if req.Value != 1 && req.Value != -1 {
		writeError(c, http.StatusBadRequest, 2001, "invalid vote value")
		return
	}

	score, myVote, err := h.Store.VoteComment(postID, commentID, user.ID, req.Value)
	if err != nil {
		switch err {
		case store.ErrNotFound:
			writeError(c, http.StatusNotFound, 2001, "not found")
		case store.ErrInvalidInput:
			writeError(c, http.StatusBadRequest, 2001, "invalid input")
		default:
			writeError(c, http.StatusInternalServerError, 5000, "server error")
		}
		return
	}

	// Trigger like notification only for upvotes
	if req.Value == 1 {
		if comment, ok := h.Store.GetComment(postID, commentID); ok && comment.AuthorID != user.ID {
			_, _ = h.Store.CreateNotification(comment.AuthorID, user.ID, "like", "comment", commentID)
		}
	}

	resp := map[string]any{
		"comment_id": commentID,
		"score":      score,
		"my_vote":    myVote,
	}
	c.JSON(http.StatusOK, resp)
}

// ClearCommentVote handles DELETE /api/v1/posts/{post_id}/comments/{comment_id}/votes.
func (h *Handler) ClearCommentVote(c *gin.Context) {
	postID := strings.TrimSpace(c.Param("id"))
	commentID := strings.TrimSpace(c.Param("commentId"))
	if postID == "" || commentID == "" {
		writeError(c, http.StatusNotFound, 2001, "not found")
		return
	}

	user, ok := h.Auth.RequireUser(c)
	if !ok {
		return
	}

	score, myVote, err := h.Store.ClearCommentVote(postID, commentID, user.ID)
	if err != nil {
		switch err {
		case store.ErrNotFound:
			writeError(c, http.StatusNotFound, 2001, "not found")
		case store.ErrInvalidInput:
			writeError(c, http.StatusBadRequest, 2001, "invalid input")
		default:
			writeError(c, http.StatusInternalServerError, 5000, "server error")
		}
		return
	}

	resp := map[string]any{
		"comment_id": commentID,
		"score":      score,
		"my_vote":    myVote,
	}
	c.JSON(http.StatusOK, resp)
}

func (h *Handler) allowWrite(limiter *ratelimit.FixedWindow, c *gin.Context, userID string) bool {
	ip := clientIP(c.Request)
	if ip != "" && !limiter.Allow("ip:"+ip) {
		return false
	}
	if userID != "" && !limiter.Allow("user:"+userID) {
		return false
	}
	return true
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

const (
	maxPostAttachments    = 6
	maxCommentAttachments = 3
	maxPostTags           = 8
	maxCommentTags        = 6
)

type attachmentItem struct {
	ID       string `json:"id"`
	Filename string `json:"filename"`
	URL      string `json:"url"`
	Width    int    `json:"width,omitempty"`
	Height   int    `json:"height,omitempty"`
}

type postItem struct {
	ID           string           `json:"id"`
	Title        string           `json:"title"`
	Content      string           `json:"content"`
	ContentJSON  json.RawMessage  `json:"content_json,omitempty"`
	Tags         []string         `json:"tags"`
	Attachments  []attachmentItem `json:"attachments"`
	Score        int              `json:"score"`
	CommentCount int              `json:"comment_count"`
	MyVote       int              `json:"my_vote"`
	Author       userSummary      `json:"author"`
	Board        *boardSummary    `json:"board,omitempty"`
	CreatedAt    string           `json:"created_at"`
}

type boardSummary struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type commentItem struct {
	ID          string           `json:"id"`
	ParentID    *string          `json:"parent_id"`
	Author      userSummary      `json:"author"`
	Floor       int              `json:"floor"`
	Content     string           `json:"content"`
	ContentJSON json.RawMessage  `json:"content_json,omitempty"`
	Tags        []string         `json:"tags"`
	Attachments []attachmentItem `json:"attachments"`
	CreatedAt   string           `json:"created_at"`
	Score       int              `json:"score"`
	MyVote      int              `json:"my_vote"`
}

type userSummary struct {
	ID         string `json:"id"`
	Nickname   string `json:"nickname"`
	Avatar     string `json:"avatar"`
	Level      int    `json:"level"`
	LevelTitle string `json:"level_title"`
}

func userSummaryFromUser(user store.User) userSummary {
	level := store.LevelForExp(user.Exp)
	return userSummary{
		ID:         user.ID,
		Nickname:   user.Nickname,
		Avatar:     user.Avatar,
		Level:      level.Level,
		LevelTitle: level.Title,
	}
}

func normalizeAttachmentIDs(ids []string) []string {
	if len(ids) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(ids))
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		trimmed := strings.TrimSpace(id)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		out = append(out, trimmed)
	}
	return out
}

func normalizeTags(tags []string, limit int) []string {
	if len(tags) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(tags))
	out := make([]string, 0, len(tags))
	for _, tag := range tags {
		trimmed := strings.TrimSpace(tag)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		out = append(out, trimmed)
		if limit > 0 && len(out) >= limit {
			break
		}
	}
	return out
}

func safeJSON(raw string) json.RawMessage {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}
	if !json.Valid([]byte(trimmed)) {
		return nil
	}
	return json.RawMessage(trimmed)
}

func (h *Handler) attachmentsFromIDs(ids []string) []attachmentItem {
	if len(ids) == 0 {
		return []attachmentItem{}
	}
	out := make([]attachmentItem, 0, len(ids))
	for _, id := range ids {
		meta, ok := h.Store.GetFile(id)
		if !ok {
			continue
		}
		out = append(out, attachmentItem{
			ID:       meta.ID,
			Filename: meta.Filename,
			URL:      "/files/" + meta.ID,
			Width:    meta.Width,
			Height:   meta.Height,
		})
	}
	return out
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

func (h *Handler) viewerID(c *gin.Context) string {
	token := bearerToken(c)
	if token == "" {
		return ""
	}
	user, ok := h.Store.UserByToken(token)
	if !ok {
		return ""
	}
	return user.ID
}

func bearerToken(c *gin.Context) string {
	authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
	if authHeader == "" {
		return ""
	}
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		return strings.TrimSpace(authHeader[7:])
	}
	return ""
}

func writeError(c *gin.Context, status int, code int, message string) {
	c.JSON(status, gin.H{"code": code, "message": message})
}

// triggerCommentNotifications sends notifications when a comment is created.
func (h *Handler) triggerCommentNotifications(postID string, comment store.Comment, actorID, parentID string) {
	// If this is a reply to another comment, notify the parent comment author
	if parentID != "" {
		if parentComment, ok := h.Store.GetComment(postID, parentID); ok {
			if parentComment.AuthorID != actorID {
				_, _ = h.Store.CreateNotification(
					parentComment.AuthorID,
					actorID,
					"reply",
					"comment",
					comment.ID,
				)
			}
		}
	}

	// Notify the post author about the new comment (unless they're replying to themselves)
	if post, ok := h.Store.GetPost(postID); ok {
		if post.AuthorID != actorID {
			_, _ = h.Store.CreateNotification(
				post.AuthorID,
				actorID,
				"comment",
				"post",
				postID,
			)
		}
	}
}
