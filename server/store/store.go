package store

import (
	"fmt"
	"strings"
	"sync"
	"time"
)

type User struct {
	ID        string
	Nickname  string
	Avatar    string
	Cover     string
	Bio       string
	CreatedAt string
}

// API defines the data operations the handlers need.
//
// The default implementation in this repo is an in-memory store (*Store).
// Database-backed implementations can satisfy this interface to swap storage
// without changing handler logic.
type API interface {
	Register(account, password string) (string, User, error)
	Login(account, password string) (string, User, error)
	UserByToken(token string) (User, bool)
	GetUser(userID string) (User, bool)
	UpdateUser(userID, nickname, bio, avatar, cover string) (User, error)

	FollowUser(followerID, followeeID string) error
	UnfollowUser(followerID, followeeID string) error
	IsFollowing(followerID, followeeID string) bool
	GetFollowCounts(userID string) (followers int, following int)
	Followers(userID string, offset, limit int) ([]User, int)
	Following(userID string, offset, limit int) ([]User, int)
	UserComments(userID string, offset, limit int) ([]Comment, int)

	Boards() []Board
	GetBoard(boardID string) (Board, bool)

	Posts(boardID string) []Post
	GetPost(postID string) (Post, bool)
	CreatePost(boardID, authorID, title, content, contentJSON string, tags, attachments []string) Post
	SoftDeletePost(postID, actorUserID string, isAdmin bool) error

	Comments(postID string) []Comment
	GetComment(postID, commentID string) (Comment, bool)
	CreateComment(postID, authorID, content, contentJSON, parentID string, tags, attachments []string) Comment
	SoftDeleteComment(postID, commentID, actorUserID string, isAdmin bool) error
	CommentCount(postID string) int

	PostScore(postID string) int
	PostVote(postID, userID string) int
	VotePost(postID, userID string, value int) (int, int, error)
	ClearPostVote(postID, userID string) (int, int, error)
	CommentScore(postID, commentID string) int
	CommentVote(postID, commentID, userID string) int
	VoteComment(postID, commentID, userID string, value int) (int, int, error)
	ClearCommentVote(postID, commentID, userID string) (int, int, error)

	SaveFile(uploaderID, filename, storageKey, storagePath string, width, height int) FileMeta
	GetFile(fileID string) (FileMeta, bool)

	AddMessage(roomID, senderID, content string) ChatMessage
	Messages(roomID string, limit int) []ChatMessage

	CreateReport(reporterID, targetType, targetID, reason, detail string) (Report, error)
	Reports(status string, page, pageSize int) ([]Report, int, error)
	UpdateReport(reportID, status, action, note, handledBy string) (Report, error)
}

// Board is a simple forum category in the demo community module.
type Board struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

// Post is a forum post stored in memory for the demo.
type Post struct {
	ID          string
	BoardID     string
	AuthorID    string
	Title       string
	Content     string
	ContentJSON string
	Tags        []string
	Attachments []string
	CreatedAt   string
	DeletedAt   string
}

// Comment is a reply under a post.
type Comment struct {
	ID          string
	PostID      string
	ParentID    string
	AuthorID    string
	Content     string
	ContentJSON string
	Tags        []string
	Attachments []string
	CreatedAt   string
	DeletedAt   string
}

// ChatMessage is a message stored per room for history queries.
type ChatMessage struct {
	ID        string
	RoomID    string
	SenderID  string
	Content   string
	CreatedAt string
}

// FileMeta tracks uploaded files and where they are stored on disk.
type FileMeta struct {
	ID          string
	UploaderID  string
	Filename    string
	StorageKey  string
	StoragePath string
	Width       int
	Height      int
	CreatedAt   string
}

type Report struct {
	ID         string
	TargetType string
	TargetID   string
	ReporterID string
	Reason     string
	Detail     string
	Status     string
	Action     string
	Note       string
	HandledBy  string
	CreatedAt  string
	UpdatedAt  string
}

// Store is an in-memory, mutex-protected demo data store.
type Store struct {
	mu           sync.Mutex
	users        map[string]User
	accounts     map[string]string
	passwords    map[string]string
	tokens       map[string]string
	userTokens   map[string]string
	boards       []Board
	posts        []Post
	comments     []Comment
	postVotes    map[string]map[string]int
	commentVotes map[string]map[string]int
	files        map[string]FileMeta
	messages     map[string][]ChatMessage
	reports      []Report
	follows      map[string]map[string]bool // map[followerID]map[followeeID]bool
	nextUserID   int
	nextPostID   int
	nextComment  int
	nextFileID   int
	nextMsgID    int
	nextReport   int
}

// NewStore creates a demo store with a few built-in boards.
func NewStore() *Store {
	return &Store{
		users:        map[string]User{},
		accounts:     map[string]string{},
		passwords:    map[string]string{},
		tokens:       map[string]string{},
		userTokens:   map[string]string{},
		boards:       defaultBoards(),
		posts:        []Post{},
		comments:     []Comment{},
		postVotes:    map[string]map[string]int{},
		commentVotes: map[string]map[string]int{},
		files:        map[string]FileMeta{},
		messages:     map[string][]ChatMessage{},
		follows:      map[string]map[string]bool{},
	}
}

func defaultBoards() []Board {
	return []Board{
		{ID: "b_1", Name: "综合", Description: "综合讨论"},
		{ID: "b_2", Name: "二手", Description: "二手交易"},
		{ID: "b_3", Name: "吐槽", Description: "吐槽集中营"},
	}
}

// UserByToken resolves a demo token to a user.
func (s *Store) UserByToken(token string) (User, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	userID, ok := s.tokens[token]
	if !ok {
		return User{}, false
	}
	user, ok := s.users[userID]
	if !ok {
		return User{}, false
	}
	return user, true
}

// GetUser returns a user by ID.
func (s *Store) GetUser(userID string) (User, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	user, ok := s.users[userID]
	return user, ok
}

// UpdateUser updates user profile fields.
func (s *Store) UpdateUser(userID, nickname, bio, avatar, cover string) (User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	user, ok := s.users[userID]
	if !ok {
		return User{}, ErrNotFound
	}

	if strings.TrimSpace(nickname) != "" {
		user.Nickname = nickname
	}
	user.Bio = bio
	user.Avatar = avatar
	user.Cover = cover

	s.users[userID] = user
	return user, nil
}

func (s *Store) FollowUser(followerID, followeeID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if followerID == followeeID {
		return ErrInvalidInput
	}
	if _, ok := s.users[followerID]; !ok {
		return ErrNotFound
	}
	if _, ok := s.users[followeeID]; !ok {
		return ErrNotFound
	}

	if s.follows[followerID] == nil {
		s.follows[followerID] = make(map[string]bool)
	}
	s.follows[followerID][followeeID] = true
	return nil
}

func (s *Store) UnfollowUser(followerID, followeeID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.follows[followerID] != nil {
		delete(s.follows[followerID], followeeID)
	}
	return nil
}

func (s *Store) IsFollowing(followerID, followeeID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.follows[followerID] == nil {
		return false
	}
	return s.follows[followerID][followeeID]
}

func (s *Store) GetFollowCounts(userID string) (int, int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	following := 0
	if f, ok := s.follows[userID]; ok {
		following = len(f)
	}

	followers := 0
	for _, f := range s.follows {
		if f[userID] {
			followers++
		}
	}
	return followers, following
}

func (s *Store) Followers(userID string, offset, limit int) ([]User, int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	followers := make([]User, 0)
	for followerID, followees := range s.follows {
		if followees[userID] {
			if user, ok := s.users[followerID]; ok {
				followers = append(followers, user)
			}
		}
	}

	total := len(followers)
	if offset < 0 {
		offset = 0
	}
	if limit <= 0 {
		limit = total
	}
	end := offset + limit
	if end > total {
		end = total
	}
	if offset > end {
		offset = end
	}
	return followers[offset:end], total
}

func (s *Store) Following(userID string, offset, limit int) ([]User, int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	following := make([]User, 0)
	if followees, ok := s.follows[userID]; ok {
		for followeeID := range followees {
			if user, ok := s.users[followeeID]; ok {
				following = append(following, user)
			}
		}
	}

	total := len(following)
	if offset < 0 {
		offset = 0
	}
	if limit <= 0 {
		limit = total
	}
	end := offset + limit
	if end > total {
		end = total
	}
	if offset > end {
		offset = end
	}
	return following[offset:end], total
}

func (s *Store) UserComments(userID string, offset, limit int) ([]Comment, int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	comments := make([]Comment, 0)
	for _, comment := range s.comments {
		if comment.AuthorID == userID && comment.DeletedAt == "" {
			comments = append(comments, comment)
		}
	}

	total := len(comments)
	if offset < 0 {
		offset = 0
	}
	if limit <= 0 {
		limit = total
	}
	end := offset + limit
	if end > total {
		end = total
	}
	if offset > end {
		offset = end
	}
	return comments[offset:end], total
}

// Boards returns the list of boards.
func (s *Store) Boards() []Board {
	s.mu.Lock()
	defer s.mu.Unlock()

	boards := make([]Board, len(s.boards))
	copy(boards, s.boards)
	return boards
}

// GetBoard returns a board by ID.
func (s *Store) GetBoard(boardID string) (Board, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, board := range s.boards {
		if board.ID == boardID {
			return board, true
		}
	}
	return Board{}, false
}

// Posts returns posts for a board. If boardID is empty, it returns all posts.
func (s *Store) Posts(boardID string) []Post {
	s.mu.Lock()
	defer s.mu.Unlock()

	if boardID == "" {
		out := make([]Post, 0, len(s.posts))
		for _, post := range s.posts {
			if post.DeletedAt == "" {
				out = append(out, post)
			}
		}
		return out
	}

	filtered := make([]Post, 0, len(s.posts))
	for _, post := range s.posts {
		if post.BoardID == boardID && post.DeletedAt == "" {
			filtered = append(filtered, post)
		}
	}
	return filtered
}

// GetPost returns a post by ID.
func (s *Store) GetPost(postID string) (Post, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, post := range s.posts {
		if post.ID == postID && post.DeletedAt == "" {
			return post, true
		}
	}
	return Post{}, false
}

// CreatePost appends a post to the store and returns it.
func (s *Store) CreatePost(boardID, authorID, title, content, contentJSON string, tags, attachments []string) Post {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.nextPostID++
	storedAttachments := make([]string, len(attachments))
	copy(storedAttachments, attachments)
	storedTags := make([]string, len(tags))
	copy(storedTags, tags)
	post := Post{
		ID:          fmt.Sprintf("p_%d", s.nextPostID),
		BoardID:     boardID,
		AuthorID:    authorID,
		Title:       title,
		Content:     content,
		ContentJSON: contentJSON,
		Tags:        storedTags,
		Attachments: storedAttachments,
		CreatedAt:   now(),
	}
	s.posts = append(s.posts, post)
	return post
}

// SoftDeletePost marks a post as deleted. Only the post author can delete it in the demo.
func (s *Store) SoftDeletePost(postID, actorUserID string, isAdmin bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for idx, post := range s.posts {
		if post.ID != postID {
			continue
		}
		if post.DeletedAt != "" {
			return ErrNotFound
		}
		if !isAdmin && post.AuthorID != actorUserID {
			return ErrForbidden
		}
		post.DeletedAt = now()
		s.posts[idx] = post
		return nil
	}
	return ErrNotFound
}

// Comments returns all comments under the given post.
func (s *Store) Comments(postID string) []Comment {
	s.mu.Lock()
	defer s.mu.Unlock()

	filtered := make([]Comment, 0, len(s.comments))
	for _, comment := range s.comments {
		if comment.PostID == postID && comment.DeletedAt == "" {
			filtered = append(filtered, comment)
		}
	}
	return filtered
}

// GetComment returns a comment by ID under the given post.
func (s *Store) GetComment(postID, commentID string) (Comment, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, comment := range s.comments {
		if comment.PostID == postID && comment.ID == commentID && comment.DeletedAt == "" {
			return comment, true
		}
	}
	return Comment{}, false
}

// CreateComment appends a comment to the store and returns it.
func (s *Store) CreateComment(postID, authorID, content, contentJSON, parentID string, tags, attachments []string) Comment {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.nextComment++
	storedAttachments := make([]string, len(attachments))
	copy(storedAttachments, attachments)
	storedTags := make([]string, len(tags))
	copy(storedTags, tags)
	comment := Comment{
		ID:          fmt.Sprintf("c_%d", s.nextComment),
		PostID:      postID,
		ParentID:    parentID,
		AuthorID:    authorID,
		Content:     content,
		ContentJSON: contentJSON,
		Tags:        storedTags,
		Attachments: storedAttachments,
		CreatedAt:   now(),
	}
	s.comments = append(s.comments, comment)
	return comment
}

// SoftDeleteComment marks a comment as deleted. Only the comment author can delete it in the demo.
func (s *Store) SoftDeleteComment(postID, commentID, actorUserID string, isAdmin bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for idx, comment := range s.comments {
		if comment.PostID != postID || comment.ID != commentID {
			continue
		}
		if comment.DeletedAt != "" {
			return ErrNotFound
		}
		if !isAdmin && comment.AuthorID != actorUserID {
			return ErrForbidden
		}
		comment.DeletedAt = now()
		s.comments[idx] = comment
		return nil
	}
	return ErrNotFound
}

// CommentCount returns the number of non-deleted comments for a post.
func (s *Store) CommentCount(postID string) int {
	s.mu.Lock()
	defer s.mu.Unlock()

	count := 0
	for _, comment := range s.comments {
		if comment.PostID == postID && comment.DeletedAt == "" {
			count++
		}
	}
	return count
}

func (s *Store) UserStats(userID string) (int, int, error) {
	trimmed := strings.TrimSpace(userID)
	if trimmed == "" {
		return 0, 0, ErrInvalidInput
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	activePosts := make(map[string]struct{}, len(s.posts))
	postsCount := 0
	for _, post := range s.posts {
		if post.DeletedAt != "" {
			continue
		}
		activePosts[post.ID] = struct{}{}
		if post.AuthorID == trimmed {
			postsCount++
		}
	}

	commentsCount := 0
	for _, comment := range s.comments {
		if comment.DeletedAt != "" || comment.AuthorID != trimmed {
			continue
		}
		if _, ok := activePosts[comment.PostID]; ok {
			commentsCount++
		}
	}
	return postsCount, commentsCount, nil
}

// PostScore returns the aggregated vote score for a post.
func (s *Store) PostScore(postID string) int {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.postExists(postID) {
		return 0
	}
	return sumVotes(s.postVotes[postID])
}

// PostVote returns the current user's vote value (-1/0/1) on a post.
func (s *Store) PostVote(postID, userID string) int {
	s.mu.Lock()
	defer s.mu.Unlock()

	if userID == "" {
		return 0
	}
	votes := s.postVotes[postID]
	if votes == nil {
		return 0
	}
	return votes[userID]
}

// VotePost upserts a user's vote on a post and returns the new score and my_vote.
func (s *Store) VotePost(postID, userID string, value int) (int, int, error) {
	if value != 1 && value != -1 {
		return 0, 0, ErrInvalidInput
	}
	if strings.TrimSpace(userID) == "" {
		return 0, 0, ErrInvalidInput
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.postExists(postID) {
		return 0, 0, ErrNotFound
	}

	if s.postVotes[postID] == nil {
		s.postVotes[postID] = map[string]int{}
	}
	s.postVotes[postID][userID] = value
	score := sumVotes(s.postVotes[postID])
	return score, value, nil
}

// ClearPostVote removes a user's vote and returns the new score and my_vote.
func (s *Store) ClearPostVote(postID, userID string) (int, int, error) {
	if strings.TrimSpace(userID) == "" {
		return 0, 0, ErrInvalidInput
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.postExists(postID) {
		return 0, 0, ErrNotFound
	}

	if votes := s.postVotes[postID]; votes != nil {
		delete(votes, userID)
	}
	score := sumVotes(s.postVotes[postID])
	return score, 0, nil
}

// CommentScore returns the aggregated vote score for a comment.
func (s *Store) CommentScore(postID, commentID string) int {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.commentExists(postID, commentID) {
		return 0
	}
	return sumVotes(s.commentVotes[commentID])
}

// CommentVote returns the current user's vote value (-1/0/1) on a comment.
func (s *Store) CommentVote(postID, commentID, userID string) int {
	s.mu.Lock()
	defer s.mu.Unlock()

	if strings.TrimSpace(userID) == "" || !s.commentExists(postID, commentID) {
		return 0
	}
	votes := s.commentVotes[commentID]
	if votes == nil {
		return 0
	}
	return votes[userID]
}

// VoteComment upserts a user's vote on a comment and returns the new score and my_vote.
func (s *Store) VoteComment(postID, commentID, userID string, value int) (int, int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if value != 1 && value != -1 {
		return 0, 0, ErrInvalidInput
	}
	if strings.TrimSpace(userID) == "" {
		return 0, 0, ErrInvalidInput
	}
	if !s.commentExists(postID, commentID) {
		return 0, 0, ErrNotFound
	}

	if s.commentVotes[commentID] == nil {
		s.commentVotes[commentID] = map[string]int{}
	}
	s.commentVotes[commentID][userID] = value
	score := sumVotes(s.commentVotes[commentID])
	return score, value, nil
}

// ClearCommentVote removes a user's vote and returns the new score and my_vote.
func (s *Store) ClearCommentVote(postID, commentID, userID string) (int, int, error) {
	if strings.TrimSpace(userID) == "" {
		return 0, 0, ErrInvalidInput
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.commentExists(postID, commentID) {
		return 0, 0, ErrNotFound
	}

	if votes := s.commentVotes[commentID]; votes != nil {
		delete(votes, userID)
	}
	score := sumVotes(s.commentVotes[commentID])
	return score, 0, nil
}

// SaveFile stores file metadata and returns it.
func (s *Store) SaveFile(uploaderID, filename, storageKey, storagePath string, width, height int) FileMeta {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.nextFileID++
	file := FileMeta{
		ID:          fmt.Sprintf("f_%d", s.nextFileID),
		UploaderID:  uploaderID,
		Filename:    filename,
		StorageKey:  storageKey,
		StoragePath: storagePath,
		Width:       width,
		Height:      height,
		CreatedAt:   now(),
	}
	s.files[file.ID] = file
	return file
}

// GetFile looks up file metadata by ID.
func (s *Store) GetFile(fileID string) (FileMeta, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	file, ok := s.files[fileID]
	return file, ok
}

// AddMessage appends a message to a room history and returns it.
func (s *Store) AddMessage(roomID, senderID, content string) ChatMessage {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.nextMsgID++
	message := ChatMessage{
		ID:        fmt.Sprintf("m_%d", s.nextMsgID),
		RoomID:    roomID,
		SenderID:  senderID,
		Content:   content,
		CreatedAt: now(),
	}
	s.messages[roomID] = append(s.messages[roomID], message)
	return message
}

// Messages returns the last N messages for the room (or all if limit <= 0).
func (s *Store) Messages(roomID string, limit int) []ChatMessage {
	s.mu.Lock()
	defer s.mu.Unlock()

	messages := s.messages[roomID]
	if len(messages) == 0 {
		return nil
	}
	if limit <= 0 || limit >= len(messages) {
		out := make([]ChatMessage, len(messages))
		copy(out, messages)
		return out
	}
	out := make([]ChatMessage, limit)
	copy(out, messages[len(messages)-limit:])
	return out
}

func (s *Store) CreateReport(reporterID, targetType, targetID, reason, detail string) (Report, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.nextReport++
	report := Report{
		ID:         fmt.Sprintf("r_%d", s.nextReport),
		TargetType: strings.TrimSpace(targetType),
		TargetID:   strings.TrimSpace(targetID),
		ReporterID: reporterID,
		Reason:     strings.TrimSpace(reason),
		Detail:     strings.TrimSpace(detail),
		Status:     "open",
		CreatedAt:  now(),
		UpdatedAt:  now(),
	}
	if report.TargetType == "" || report.TargetID == "" || report.Reason == "" {
		return Report{}, ErrInvalidInput
	}
	s.reports = append(s.reports, report)
	return report, nil
}

func (s *Store) Reports(status string, page, pageSize int) ([]Report, int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	trimmed := strings.TrimSpace(status)
	filtered := make([]Report, 0, len(s.reports))
	for _, r := range s.reports {
		if trimmed == "" || r.Status == trimmed {
			filtered = append(filtered, r)
		}
	}
	total := len(filtered)
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	start := (page - 1) * pageSize
	if start > total {
		start = total
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	out := make([]Report, end-start)
	copy(out, filtered[start:end])
	return out, total, nil
}

func (s *Store) UpdateReport(reportID, status, action, note, handledBy string) (Report, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	trimmedID := strings.TrimSpace(reportID)
	trimmedStatus := strings.TrimSpace(status)
	if trimmedID == "" || trimmedStatus == "" {
		return Report{}, ErrInvalidInput
	}

	for idx, report := range s.reports {
		if report.ID != trimmedID {
			continue
		}
		report.Status = trimmedStatus
		report.Action = strings.TrimSpace(action)
		report.Note = strings.TrimSpace(note)
		report.HandledBy = strings.TrimSpace(handledBy)
		report.UpdatedAt = now()
		s.reports[idx] = report
		return report, nil
	}
	return Report{}, ErrNotFound
}

// now returns the current time in UTC RFC3339 format.
func now() string {
	return time.Now().UTC().Format(time.RFC3339)
}

var _ API = (*Store)(nil)

func (s *Store) postExists(postID string) bool {
	for _, post := range s.posts {
		if post.ID == postID && post.DeletedAt == "" {
			return true
		}
	}
	return false
}

func (s *Store) commentExists(postID, commentID string) bool {
	for _, comment := range s.comments {
		if comment.PostID == postID && comment.ID == commentID && comment.DeletedAt == "" {
			return true
		}
	}
	return false
}

func sumVotes(votes map[string]int) int {
	score := 0
	for _, value := range votes {
		score += value
	}
	return score
}
