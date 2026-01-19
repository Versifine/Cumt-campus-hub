package auth

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/Versifine/Cumt-cumpus-hub/server/internal/transport"
	"github.com/Versifine/Cumt-cumpus-hub/server/store"
)

type Service struct {
	Store store.API
}

type loginRequest struct {
	Account  string `json:"account"`
	Password string `json:"password"`
}

type loginResponse struct {
	Token string       `json:"token"`
	User  userResponse `json:"user"`
}

type userResponse struct {
	ID       string `json:"id"`
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar"`
}

type userStatsStore interface {
	UserStats(userID string) (int, int, error)
}

// RegisterHandler handles POST /api/v1/auth/register.
func (s *Service) RegisterHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		transport.WriteError(w, http.StatusMethodNotAllowed, 2001, "method not allowed")
		return
	}

	var req loginRequest
	if err := transport.ReadJSON(r, &req); err != nil {
		transport.WriteError(w, http.StatusBadRequest, 2001, "invalid json")
		return
	}

	token, user, err := s.Store.Register(req.Account, req.Password)
	if err != nil {
		switch err {
		case store.ErrInvalidInput:
			transport.WriteError(w, http.StatusBadRequest, 2001, "missing fields")
		case store.ErrAccountExists:
			transport.WriteError(w, http.StatusConflict, 1004, "account already exists")
		default:
			transport.WriteError(w, http.StatusInternalServerError, 5000, "server error")
		}
		return
	}

	resp := loginResponse{
		Token: token,
		User: userResponse{
			ID:       user.ID,
			Nickname: user.Nickname,
			Avatar:   user.Avatar,
		},
	}

	transport.WriteJSON(w, http.StatusOK, resp)
}

// LoginHandler handles POST /api/v1/auth/login.
func (s *Service) LoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		transport.WriteError(w, http.StatusMethodNotAllowed, 2001, "method not allowed")
		return
	}

	var req loginRequest
	if err := transport.ReadJSON(r, &req); err != nil {
		transport.WriteError(w, http.StatusBadRequest, 2001, "invalid json")
		return
	}

	token, user, err := s.Store.Login(req.Account, req.Password)
	if err != nil {
		switch err {
		case store.ErrInvalidInput:
			transport.WriteError(w, http.StatusBadRequest, 2001, "missing fields")
		case store.ErrInvalidCredentials:
			transport.WriteError(w, http.StatusUnauthorized, 1003, "invalid credentials")
		default:
			transport.WriteError(w, http.StatusInternalServerError, 5000, "server error")
		}
		return
	}
	resp := loginResponse{
		Token: token,
		User: userResponse{
			ID:       user.ID,
			Nickname: user.Nickname,
			Avatar:   user.Avatar,
		},
	}

	transport.WriteJSON(w, http.StatusOK, resp)
}

// MeHandler handles GET /api/v1/users/me.
func (s *Service) MeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		transport.WriteError(w, http.StatusMethodNotAllowed, 2001, "method not allowed")
		return
	}

	user, ok := s.RequireUser(w, r)
	if !ok {
		return
	}

	postsCount, commentsCount, _ := s.userStats(user.ID)
	followers, following := s.Store.GetFollowCounts(user.ID)

	resp := struct {
		ID             string `json:"id"`
		Nickname       string `json:"nickname"`
		Avatar         string `json:"avatar"`
		Bio            string `json:"bio"`
		Cover          string `json:"cover"`
		CreatedAt      string `json:"created_at"`
		PostsCount     int    `json:"posts_count"`
		CommentsCount  int    `json:"comments_count"`
		FollowersCount int    `json:"followers_count"`
		FollowingCount int    `json:"following_count"`
	}{
		ID:             user.ID,
		Nickname:       user.Nickname,
		Avatar:         user.Avatar,
		Bio:            user.Bio,
		Cover:          user.Cover,
		CreatedAt:      user.CreatedAt,
		PostsCount:     postsCount,
		CommentsCount:  commentsCount,
		FollowersCount: followers,
		FollowingCount: following,
	}

	transport.WriteJSON(w, http.StatusOK, resp)
}

// FollowersHandler handles GET /api/v1/users/{id}/followers.
func (s *Service) FollowersHandler(targetID string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			transport.WriteError(w, http.StatusMethodNotAllowed, 2001, "method not allowed")
			return
		}

		page := parsePositiveInt(r.URL.Query().Get("page"), 1)
		pageSize := parsePositiveInt(r.URL.Query().Get("page_size"), 20)
		offset := (page - 1) * pageSize

		items, total := s.Store.Followers(targetID, offset, pageSize)
		respItems := make([]map[string]any, 0, len(items))
		for _, u := range items {
			respItems = append(respItems, map[string]any{
				"id":         u.ID,
				"nickname":   u.Nickname,
				"avatar":     u.Avatar,
				"bio":        u.Bio,
				"created_at": u.CreatedAt,
			})
		}

		transport.WriteJSON(w, http.StatusOK, map[string]any{
			"items": respItems,
			"total": total,
		})
	}
}

// FollowingHandler handles GET /api/v1/users/{id}/following.
func (s *Service) FollowingHandler(targetID string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			transport.WriteError(w, http.StatusMethodNotAllowed, 2001, "method not allowed")
			return
		}

		page := parsePositiveInt(r.URL.Query().Get("page"), 1)
		pageSize := parsePositiveInt(r.URL.Query().Get("page_size"), 20)
		offset := (page - 1) * pageSize

		items, total := s.Store.Following(targetID, offset, pageSize)
		respItems := make([]map[string]any, 0, len(items))
		for _, u := range items {
			respItems = append(respItems, map[string]any{
				"id":         u.ID,
				"nickname":   u.Nickname,
				"avatar":     u.Avatar,
				"bio":        u.Bio,
				"created_at": u.CreatedAt,
			})
		}

		transport.WriteJSON(w, http.StatusOK, map[string]any{
			"items": respItems,
			"total": total,
		})
	}
}

// UserCommentsHandler handles GET /api/v1/users/{id}/comments.
func (s *Service) UserCommentsHandler(targetID string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			transport.WriteError(w, http.StatusMethodNotAllowed, 2001, "method not allowed")
			return
		}

		page := parsePositiveInt(r.URL.Query().Get("page"), 1)
		pageSize := parsePositiveInt(r.URL.Query().Get("page_size"), 20)
		offset := (page - 1) * pageSize

		items, total := s.Store.UserComments(targetID, offset, pageSize)
		respItems := make([]map[string]any, 0, len(items))
		for _, c := range items {
			respItems = append(respItems, map[string]any{
				"id":           c.ID,
				"post_id":      c.PostID,
				"parent_id":    c.ParentID,
				"author_id":    c.AuthorID,
				"content":      c.Content,
				"content_json": json.RawMessage(c.ContentJSON),
				"created_at":   c.CreatedAt,
			})
		}

		transport.WriteJSON(w, http.StatusOK, map[string]any{
			"items": respItems,
			"total": total,
		})
	}
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

// UpdateMeHandler handles PATCH /api/v1/users/me.
func (s *Service) UpdateMeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		transport.WriteError(w, http.StatusMethodNotAllowed, 2001, "method not allowed")
		return
	}

	user, ok := s.RequireUser(w, r)
	if !ok {
		return
	}

	var req struct {
		Nickname string `json:"nickname"`
		Bio      string `json:"bio"`
		Avatar   string `json:"avatar"`
		Cover    string `json:"cover"`
	}
	if err := transport.ReadJSON(r, &req); err != nil {
		transport.WriteError(w, http.StatusBadRequest, 2001, "invalid json")
		return
	}

	// If fields are empty in JSON, they come as empty strings.
	// Our store implementation currently treats empty strings as "update to empty" (except nickname).
	// To support partial updates properly (only update what's sent), we'd need pointers in struct or map[string]any.
	// For this MVP, let's keep it simple: Frontend MUST send current values for fields it doesn't want to change,
	// OR we handle logic here.
	// Let's refine the Store logic to be safer: only update if value is distinct?
	// Actually, let's handle "fallback to existing" here in the handler for better control.

	newNickname := req.Nickname
	if strings.TrimSpace(newNickname) == "" {
		newNickname = user.Nickname
	}
	// For Bio/Avatar/Cover, we trust the input. If frontend sends "", it means clear it?
	// Or does it mean "ignore"? PATCH usually means partial update.
	// Let's assume if it's empty, we keep original.
	// This prevents clearing. If we want to clear, frontend might need to send a specific flag or we need a better DTO.
	// Let's try: if field is missing in JSON -> ignore. But Go zero value is "".
	// We can't distinguish missing vs empty string without pointers.
	// LET'S CHANGE DTO TO POINTERS.

	// Re-reading with pointers to support partial updates
}

// UpdateMeHandlerV2 with pointers for partial updates
func (s *Service) UpdateMeHandlerV2(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		transport.WriteError(w, http.StatusMethodNotAllowed, 2001, "method not allowed")
		return
	}

	user, ok := s.RequireUser(w, r)
	if !ok {
		return
	}

	var req struct {
		Nickname *string `json:"nickname"`
		Bio      *string `json:"bio"`
		Avatar   *string `json:"avatar"`
		Cover    *string `json:"cover"`
	}
	if err := transport.ReadJSON(r, &req); err != nil {
		transport.WriteError(w, http.StatusBadRequest, 2001, "invalid json")
		return
	}

	nickname := user.Nickname
	if req.Nickname != nil {
		if strings.TrimSpace(*req.Nickname) != "" {
			nickname = *req.Nickname
		}
	}
	bio := user.Bio
	if req.Bio != nil {
		bio = *req.Bio
	}
	avatar := user.Avatar
	if req.Avatar != nil {
		avatar = *req.Avatar
	}
	cover := user.Cover
	if req.Cover != nil {
		cover = *req.Cover
	}

	updated, err := s.Store.UpdateUser(user.ID, nickname, bio, avatar, cover)
	if err != nil {
		transport.WriteError(w, http.StatusInternalServerError, 5000, "server error")
		return
	}

	resp := struct {
		ID        string `json:"id"`
		Nickname  string `json:"nickname"`
		Avatar    string `json:"avatar"`
		Bio       string `json:"bio"`
		Cover     string `json:"cover"`
		CreatedAt string `json:"created_at"`
	}{
		ID:        updated.ID,
		Nickname:  updated.Nickname,
		Avatar:    updated.Avatar,
		Bio:       updated.Bio,
		Cover:     updated.Cover,
		CreatedAt: updated.CreatedAt,
	}
	transport.WriteJSON(w, http.StatusOK, resp)
}

// PublicUserHandler handles GET /api/v1/users/{id}.
func (s *Service) PublicUserHandler(userID string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			transport.WriteError(w, http.StatusMethodNotAllowed, 2001, "method not allowed")
			return
		}

		trimmedID := strings.TrimSpace(userID)
		if trimmedID == "" {
			transport.WriteError(w, http.StatusNotFound, 2001, "not found")
			return
		}

		user, ok := s.Store.GetUser(trimmedID)
		if !ok {
			transport.WriteError(w, http.StatusNotFound, 2001, "not found")
			return
		}

		postsCount, commentsCount, err := s.userStats(trimmedID)
		if err != nil {
			transport.WriteError(w, http.StatusInternalServerError, 5000, "server error")
			return
		}

		followers, following := s.Store.GetFollowCounts(trimmedID)
		isFollowing := false
		if token := bearerToken(r); token != "" {
			if me, ok := s.Store.UserByToken(token); ok {
				isFollowing = s.Store.IsFollowing(me.ID, trimmedID)
			}
		}

		resp := struct {
			ID             string `json:"id"`
			Nickname       string `json:"nickname"`
			Avatar         string `json:"avatar"`
			Cover          string `json:"cover"`
			Bio            string `json:"bio"`
			CreatedAt      string `json:"created_at"`
			PostsCount     int    `json:"posts_count"`
			CommentsCount  int    `json:"comments_count"`
			FollowersCount int    `json:"followers_count"`
			FollowingCount int    `json:"following_count"`
			IsFollowing    bool   `json:"is_following"`
		}{
			ID:             user.ID,
			Nickname:       user.Nickname,
			Avatar:         user.Avatar,
			Cover:          user.Cover,
			Bio:            user.Bio,
			CreatedAt:      user.CreatedAt,
			PostsCount:     postsCount,
			CommentsCount:  commentsCount,
			FollowersCount: followers,
			FollowingCount: following,
			IsFollowing:    isFollowing,
		}

		transport.WriteJSON(w, http.StatusOK, resp)
	}
}

// FollowHandler handles POST /api/v1/users/{id}/follow.
func (s *Service) FollowHandler(targetID string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			transport.WriteError(w, http.StatusMethodNotAllowed, 2001, "method not allowed")
			return
		}

		me, ok := s.RequireUser(w, r)
		if !ok {
			return
		}

		if err := s.Store.FollowUser(me.ID, targetID); err != nil {
			if err == store.ErrNotFound {
				transport.WriteError(w, http.StatusNotFound, 2001, "user not found")
			} else if err == store.ErrInvalidInput {
				transport.WriteError(w, http.StatusBadRequest, 2001, "cannot follow yourself")
			} else {
				transport.WriteError(w, http.StatusInternalServerError, 5000, "server error")
			}
			return
		}

		transport.WriteJSON(w, http.StatusOK, map[string]bool{"success": true})
	}
}

// UnfollowHandler handles DELETE /api/v1/users/{id}/follow.
func (s *Service) UnfollowHandler(targetID string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			transport.WriteError(w, http.StatusMethodNotAllowed, 2001, "method not allowed")
			return
		}

		me, ok := s.RequireUser(w, r)
		if !ok {
			return
		}

		if err := s.Store.UnfollowUser(me.ID, targetID); err != nil {
			transport.WriteError(w, http.StatusInternalServerError, 5000, "server error")
			return
		}

		transport.WriteJSON(w, http.StatusOK, map[string]bool{"success": true})
	}
}

// RequireUser extracts the Bearer token, loads the user, and writes a 401 error on failure.
func (s *Service) RequireUser(w http.ResponseWriter, r *http.Request) (store.User, bool) {
	token := bearerToken(r)
	if token == "" {
		transport.WriteError(w, http.StatusUnauthorized, 1001, "missing token")
		return store.User{}, false
	}

	user, ok := s.Store.UserByToken(token)
	if !ok {
		transport.WriteError(w, http.StatusUnauthorized, 1001, "invalid token")
		return store.User{}, false
	}
	return user, true
}

// bearerToken parses Authorization: Bearer <token>.
func bearerToken(r *http.Request) string {
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	if authHeader == "" {
		return ""
	}
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		return strings.TrimSpace(authHeader[7:])
	}
	return ""
}

func (s *Service) userStats(userID string) (int, int, error) {
	if statsStore, ok := s.Store.(userStatsStore); ok {
		return statsStore.UserStats(userID)
	}

	posts := s.Store.Posts("")
	postsCount := 0
	commentsCount := 0
	for _, post := range posts {
		if post.AuthorID == userID {
			postsCount++
		}
		comments := s.Store.Comments(post.ID)
		for _, comment := range comments {
			if comment.AuthorID == userID {
				commentsCount++
			}
		}
	}
	return postsCount, commentsCount, nil
}
