package auth

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/Versifine/Cumt-cumpus-hub/server/store"
)

type Service struct {
	Store  store.API
	Mailer EmailSender
}

type loginRequest struct {
	Account  string `json:"account"`
	Password string `json:"password"`
}

type registerRequest struct {
	Account         string `json:"account"`
	Password        string `json:"password"`
	ConfirmPassword string `json:"confirm_password"`
	Nickname        string `json:"nickname"`
}

type resendVerificationRequest struct {
	Account string `json:"account"`
}

type loginResponse struct {
	Token string       `json:"token"`
	User  userResponse `json:"user"`
}

type registerResponse struct {
	Message string `json:"message"`
}

type userResponse struct {
	ID         string `json:"id"`
	Nickname   string `json:"nickname"`
	Avatar     string `json:"avatar"`
	Level      int    `json:"level"`
	LevelTitle string `json:"level_title"`
}

type userStatsStore interface {
	UserStats(userID string) (int, int, error)
}

// RegisterHandler handles POST /api/v1/auth/register.
func (s *Service) RegisterHandler(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, 2001, "invalid json")
		return
	}
	if IsNilEmailSender(s.Mailer) {
		writeError(c, http.StatusInternalServerError, 5000, "email service unavailable")
		return
	}
	if strings.TrimSpace(req.Password) != strings.TrimSpace(req.ConfirmPassword) {
		writeError(c, http.StatusBadRequest, 1011, "passwords do not match")
		return
	}

	result, err := s.Store.Register(req.Account, req.Password, req.Nickname)
	if err != nil {
		switch err {
		case store.ErrInvalidInput:
			writeError(c, http.StatusBadRequest, 2001, "missing fields")
		case store.ErrInvalidEmail:
			writeError(c, http.StatusBadRequest, 1006, "invalid email")
		case store.ErrInvalidNickname:
			writeError(c, http.StatusBadRequest, 1012, "invalid nickname")
		case store.ErrWeakPassword:
			writeError(c, http.StatusBadRequest, 1007, "weak password")
		case store.ErrAccountExists:
			writeError(c, http.StatusConflict, 1004, "account already exists")
		default:
			writeError(c, http.StatusInternalServerError, 5000, "server error")
		}
		return
	}
	if err := s.Mailer.SendVerificationEmail(strings.TrimSpace(req.Account), result.VerificationToken); err != nil {
		log.Printf("failed to send verification email: %v", err)
		writeError(c, http.StatusInternalServerError, 5000, "failed to send verification email")
		return
	}

	resp := registerResponse{Message: "verification email sent"}
	c.JSON(http.StatusAccepted, resp)
}

// LoginHandler handles POST /api/v1/auth/login.
func (s *Service) LoginHandler(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, 2001, "invalid json")
		return
	}

	token, user, err := s.Store.Login(req.Account, req.Password)
	if err != nil {
		switch err {
		case store.ErrInvalidInput:
			writeError(c, http.StatusBadRequest, 2001, "missing fields")
		case store.ErrInvalidCredentials:
			writeError(c, http.StatusUnauthorized, 1003, "invalid credentials")
		case store.ErrAccountUnverified:
			writeError(c, http.StatusForbidden, 1008, "account not verified")
		default:
			writeError(c, http.StatusInternalServerError, 5000, "server error")
		}
		return
	}
	level := store.LevelForExp(user.Exp)
	resp := loginResponse{
		Token: token,
		User: userResponse{
			ID:         user.ID,
			Nickname:   user.Nickname,
			Avatar:     user.Avatar,
			Level:      level.Level,
			LevelTitle: level.Title,
		},
	}

	c.JSON(http.StatusOK, resp)
}

// VerifyEmailHandler handles GET /api/v1/auth/verify-email.
func (s *Service) VerifyEmailHandler(c *gin.Context) {
	trimmedToken := strings.TrimSpace(c.Query("token"))
	if trimmedToken == "" {
		writeError(c, http.StatusBadRequest, 2001, "missing token")
		return
	}
	if err := s.Store.VerifyEmail(trimmedToken); err != nil {
		switch err {
		case store.ErrInvalidInput:
			writeError(c, http.StatusBadRequest, 2001, "missing token")
		case store.ErrVerificationTokenInvalid:
			writeError(c, http.StatusBadRequest, 1009, "invalid verification token")
		case store.ErrVerificationTokenExpired:
			writeError(c, http.StatusGone, 1010, "verification token expired")
		default:
			writeError(c, http.StatusInternalServerError, 5000, "server error")
		}
		return
	}

	c.JSON(http.StatusOK, registerResponse{Message: "email verified"})
}

// ResendVerificationHandler handles POST /api/v1/auth/resend-verification.
func (s *Service) ResendVerificationHandler(c *gin.Context) {
	var req resendVerificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, 2001, "invalid json")
		return
	}
	if IsNilEmailSender(s.Mailer) {
		writeError(c, http.StatusInternalServerError, 5000, "email service unavailable")
		return
	}

	token, err := s.Store.ResendVerification(req.Account)
	if err != nil {
		switch err {
		case store.ErrInvalidInput:
			writeError(c, http.StatusBadRequest, 2001, "missing fields")
		case store.ErrInvalidEmail:
			writeError(c, http.StatusBadRequest, 1006, "invalid email")
		case store.ErrNotFound:
			writeError(c, http.StatusNotFound, 1013, "account not found")
		case store.ErrAccountVerified:
			writeError(c, http.StatusConflict, 1014, "account already verified")
		default:
			writeError(c, http.StatusInternalServerError, 5000, "server error")
		}
		return
	}
	if err := s.Mailer.SendVerificationEmail(strings.TrimSpace(req.Account), token); err != nil {
		log.Printf("failed to send verification email: %v", err)
		writeError(c, http.StatusInternalServerError, 5000, "failed to send verification email")
		return
	}

	c.JSON(http.StatusOK, registerResponse{Message: "verification email sent"})
}

// DeactivateMe handles DELETE /api/v1/users/me.
func (s *Service) DeactivateMe(c *gin.Context) {
	user, ok := s.RequireUser(c)
	if !ok {
		return
	}
	if err := s.Store.DeactivateAccount(user.ID); err != nil {
		if err == store.ErrNotFound {
			writeError(c, http.StatusNotFound, 2001, "not found")
			return
		}
		writeError(c, http.StatusInternalServerError, 5000, "server error")
		return
	}

	c.JSON(http.StatusOK, registerResponse{Message: "account deactivated"})
}

// GetMe handles GET /api/v1/users/me.
func (s *Service) GetMe(c *gin.Context) {
	user, ok := s.RequireUser(c)
	if !ok {
		return
	}

	postsCount, commentsCount, _ := s.userStats(user.ID)
	followers, following := s.Store.GetFollowCounts(user.ID)

	level := store.LevelForExp(user.Exp)
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
		Level          int    `json:"level"`
		LevelTitle     string `json:"level_title"`
		Exp            int    `json:"exp"`
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
		Level:          level.Level,
		LevelTitle:     level.Title,
		Exp:            user.Exp,
	}

	c.JSON(http.StatusOK, resp)
}

// GetFollowers handles GET /api/v1/users/{id}/followers.
func (s *Service) GetFollowers(c *gin.Context) {
	targetID := strings.TrimSpace(c.Param("id"))
	if targetID == "" {
		writeError(c, http.StatusNotFound, 2001, "not found")
		return
	}

	page := parsePositiveInt(c.Query("page"), 1)
	pageSize := parsePositiveInt(c.Query("page_size"), 20)
	offset := (page - 1) * pageSize

	items, total := s.Store.Followers(targetID, offset, pageSize)
	respItems := make([]map[string]any, 0, len(items))
	for _, u := range items {
		level := store.LevelForExp(u.Exp)
		respItems = append(respItems, map[string]any{
			"id":          u.ID,
			"nickname":    u.Nickname,
			"avatar":      u.Avatar,
			"bio":         u.Bio,
			"created_at":  u.CreatedAt,
			"level":       level.Level,
			"level_title": level.Title,
		})
	}

	c.JSON(http.StatusOK, map[string]any{
		"items": respItems,
		"total": total,
	})
}

// GetFollowing handles GET /api/v1/users/{id}/following.
func (s *Service) GetFollowing(c *gin.Context) {
	targetID := strings.TrimSpace(c.Param("id"))
	if targetID == "" {
		writeError(c, http.StatusNotFound, 2001, "not found")
		return
	}

	page := parsePositiveInt(c.Query("page"), 1)
	pageSize := parsePositiveInt(c.Query("page_size"), 20)
	offset := (page - 1) * pageSize

	items, total := s.Store.Following(targetID, offset, pageSize)
	respItems := make([]map[string]any, 0, len(items))
	for _, u := range items {
		level := store.LevelForExp(u.Exp)
		respItems = append(respItems, map[string]any{
			"id":          u.ID,
			"nickname":    u.Nickname,
			"avatar":      u.Avatar,
			"bio":         u.Bio,
			"created_at":  u.CreatedAt,
			"level":       level.Level,
			"level_title": level.Title,
		})
	}

	c.JSON(http.StatusOK, map[string]any{
		"items": respItems,
		"total": total,
	})
}

// GetUserComments handles GET /api/v1/users/{id}/comments.
func (s *Service) GetUserComments(c *gin.Context) {
	targetID := strings.TrimSpace(c.Param("id"))
	if targetID == "" {
		writeError(c, http.StatusNotFound, 2001, "not found")
		return
	}

	page := parsePositiveInt(c.Query("page"), 1)
	pageSize := parsePositiveInt(c.Query("page_size"), 20)
	offset := (page - 1) * pageSize

	items, total := s.Store.UserComments(targetID, offset, pageSize)
	respItems := make([]map[string]any, 0, len(items))
	for _, cmt := range items {
		postTitle := ""
		boardID := ""
		boardName := ""
		if post, ok := s.Store.GetPost(cmt.PostID); ok {
			postTitle = post.Title
			boardID = post.BoardID
			if board, ok := s.Store.GetBoard(post.BoardID); ok {
				boardName = board.Name
			}
		}
		isReply := strings.TrimSpace(cmt.ParentID) != ""
		respItems = append(respItems, map[string]any{
			"id":           cmt.ID,
			"post_id":      cmt.PostID,
			"parent_id":    cmt.ParentID,
			"author_id":    cmt.AuthorID,
			"content":      cmt.Content,
			"content_json": json.RawMessage(cmt.ContentJSON),
			"created_at":   cmt.CreatedAt,
			"floor":        cmt.Floor,
			"post_title":   postTitle,
			"board_id":     boardID,
			"board_name":   boardName,
			"is_reply":     isReply,
		})
	}

	c.JSON(http.StatusOK, map[string]any{
		"items": respItems,
		"total": total,
	})
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

// UpdateMe handles PATCH /api/v1/users/me.
func (s *Service) UpdateMe(c *gin.Context) {
	user, ok := s.RequireUser(c)
	if !ok {
		return
	}

	var req struct {
		Nickname *string `json:"nickname"`
		Bio      *string `json:"bio"`
		Avatar   *string `json:"avatar"`
		Cover    *string `json:"cover"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, 2001, "invalid json")
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
		writeError(c, http.StatusInternalServerError, 5000, "server error")
		return
	}

	level := store.LevelForExp(updated.Exp)
	resp := struct {
		ID         string `json:"id"`
		Nickname   string `json:"nickname"`
		Avatar     string `json:"avatar"`
		Bio        string `json:"bio"`
		Cover      string `json:"cover"`
		CreatedAt  string `json:"created_at"`
		Level      int    `json:"level"`
		LevelTitle string `json:"level_title"`
		Exp        int    `json:"exp"`
	}{
		ID:         updated.ID,
		Nickname:   updated.Nickname,
		Avatar:     updated.Avatar,
		Bio:        updated.Bio,
		Cover:      updated.Cover,
		CreatedAt:  updated.CreatedAt,
		Level:      level.Level,
		LevelTitle: level.Title,
		Exp:        updated.Exp,
	}
	c.JSON(http.StatusOK, resp)
}

// GetUser handles GET /api/v1/users/{id}.
func (s *Service) GetUser(c *gin.Context) {
	trimmedID := strings.TrimSpace(c.Param("id"))
	if trimmedID == "" {
		writeError(c, http.StatusNotFound, 2001, "not found")
		return
	}

	user, ok := s.Store.GetUser(trimmedID)
	if !ok {
		writeError(c, http.StatusNotFound, 2001, "not found")
		return
	}

	postsCount, commentsCount, err := s.userStats(trimmedID)
	if err != nil {
		writeError(c, http.StatusInternalServerError, 5000, "server error")
		return
	}

	followers, following := s.Store.GetFollowCounts(trimmedID)
	isFollowing := false
	if token := bearerToken(c); token != "" {
		if me, ok := s.Store.UserByToken(token); ok {
			isFollowing = s.Store.IsFollowing(me.ID, trimmedID)
		}
	}

	level := store.LevelForExp(user.Exp)
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
		Level          int    `json:"level"`
		LevelTitle     string `json:"level_title"`
		Exp            int    `json:"exp"`
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
		Level:          level.Level,
		LevelTitle:     level.Title,
		Exp:            user.Exp,
	}

	c.JSON(http.StatusOK, resp)
}

// FollowUser handles POST /api/v1/users/{id}/follow.
func (s *Service) FollowUser(c *gin.Context) {
	targetID := strings.TrimSpace(c.Param("id"))
	if targetID == "" {
		writeError(c, http.StatusNotFound, 2001, "not found")
		return
	}

	me, ok := s.RequireUser(c)
	if !ok {
		return
	}

	if err := s.Store.FollowUser(me.ID, targetID); err != nil {
		if err == store.ErrNotFound {
			writeError(c, http.StatusNotFound, 2001, "user not found")
		} else if err == store.ErrInvalidInput {
			writeError(c, http.StatusBadRequest, 2001, "cannot follow yourself")
		} else {
			writeError(c, http.StatusInternalServerError, 5000, "server error")
		}
		return
	}

	// Trigger follow notification
	_, _ = s.Store.CreateNotification(targetID, me.ID, "follow", "", "")

	c.JSON(http.StatusOK, map[string]bool{"success": true})
}

// UnfollowUser handles DELETE /api/v1/users/{id}/follow.
func (s *Service) UnfollowUser(c *gin.Context) {
	targetID := strings.TrimSpace(c.Param("id"))
	if targetID == "" {
		writeError(c, http.StatusNotFound, 2001, "not found")
		return
	}

	me, ok := s.RequireUser(c)
	if !ok {
		return
	}

	if err := s.Store.UnfollowUser(me.ID, targetID); err != nil {
		writeError(c, http.StatusInternalServerError, 5000, "server error")
		return
	}

	c.JSON(http.StatusOK, map[string]bool{"success": true})
}

// RequireUser extracts the Bearer token, loads the user, and writes a 401 error on failure.
func (s *Service) RequireUser(c *gin.Context) (store.User, bool) {
	token := bearerToken(c)
	if token == "" {
		writeError(c, http.StatusUnauthorized, 1001, "missing token")
		return store.User{}, false
	}

	user, ok := s.Store.UserByToken(token)
	if !ok {
		writeError(c, http.StatusUnauthorized, 1001, "invalid token")
		return store.User{}, false
	}
	return user, true
}

// bearerToken parses Authorization: Bearer <token>.
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

func writeError(c *gin.Context, status int, code int, message string) {
	c.JSON(status, gin.H{"code": code, "message": message})
}
