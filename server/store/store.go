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

	Boards() []Board
	GetBoard(boardID string) (Board, bool)

	Posts(boardID string) []Post
	GetPost(postID string) (Post, bool)
	CreatePost(boardID, authorID, title, content string) Post
	SoftDeletePost(postID, actorUserID string) error

	Comments(postID string) []Comment
	GetComment(postID, commentID string) (Comment, bool)
	CreateComment(postID, authorID, content string) Comment
	SoftDeleteComment(postID, commentID, actorUserID string) error

	SaveFile(uploaderID, filename, storageKey, storagePath string) FileMeta
	GetFile(fileID string) (FileMeta, bool)

	AddMessage(roomID, senderID, content string) ChatMessage
	Messages(roomID string, limit int) []ChatMessage

	CreateReport(reporterID, targetType, targetID, reason, detail string) (Report, error)
	Reports(status string, page, pageSize int) ([]Report, int, error)
	UpdateReport(reportID, status, action, note, handledBy string) (Report, error)
}

// Board is a simple forum category in the demo community module.
type Board struct {
	ID          string
	Name        string
	Description string
}

// Post is a forum post stored in memory for the demo.
type Post struct {
	ID        string
	BoardID   string
	AuthorID  string
	Title     string
	Content   string
	CreatedAt string
	DeletedAt string
}

// Comment is a reply under a post.
type Comment struct {
	ID        string
	PostID    string
	AuthorID  string
	Content   string
	CreatedAt string
	DeletedAt string
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
	mu          sync.Mutex
	users       map[string]User
	accounts    map[string]string
	passwords   map[string]string
	tokens      map[string]string
	userTokens  map[string]string
	boards      []Board
	posts       []Post
	comments    []Comment
	files       map[string]FileMeta
	messages    map[string][]ChatMessage
	reports     []Report
	nextUserID  int
	nextPostID  int
	nextComment int
	nextFileID  int
	nextMsgID   int
	nextReport  int
}

// NewStore creates a demo store with a few built-in boards.
func NewStore() *Store {
	return &Store{
		users:      map[string]User{},
		accounts:   map[string]string{},
		passwords:  map[string]string{},
		tokens:     map[string]string{},
		userTokens: map[string]string{},
		boards: []Board{
			{ID: "b_1", Name: "General", Description: "General discussion"},
			{ID: "b_2", Name: "Marketplace", Description: "Buy and sell"},
			{ID: "b_3", Name: "Resources", Description: "Study resources"},
		},
		posts:    []Post{},
		comments: []Comment{},
		files:    map[string]FileMeta{},
		messages: map[string][]ChatMessage{},
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
func (s *Store) CreatePost(boardID, authorID, title, content string) Post {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.nextPostID++
	post := Post{
		ID:        fmt.Sprintf("p_%d", s.nextPostID),
		BoardID:   boardID,
		AuthorID:  authorID,
		Title:     title,
		Content:   content,
		CreatedAt: now(),
	}
	s.posts = append(s.posts, post)
	return post
}

// SoftDeletePost marks a post as deleted. Only the post author can delete it in the demo.
func (s *Store) SoftDeletePost(postID, actorUserID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for idx, post := range s.posts {
		if post.ID != postID {
			continue
		}
		if post.DeletedAt != "" {
			return ErrNotFound
		}
		if post.AuthorID != actorUserID {
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
func (s *Store) CreateComment(postID, authorID, content string) Comment {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.nextComment++
	comment := Comment{
		ID:        fmt.Sprintf("c_%d", s.nextComment),
		PostID:    postID,
		AuthorID:  authorID,
		Content:   content,
		CreatedAt: now(),
	}
	s.comments = append(s.comments, comment)
	return comment
}

// SoftDeleteComment marks a comment as deleted. Only the comment author can delete it in the demo.
func (s *Store) SoftDeleteComment(postID, commentID, actorUserID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for idx, comment := range s.comments {
		if comment.PostID != postID || comment.ID != commentID {
			continue
		}
		if comment.DeletedAt != "" {
			return ErrNotFound
		}
		if comment.AuthorID != actorUserID {
			return ErrForbidden
		}
		comment.DeletedAt = now()
		s.comments[idx] = comment
		return nil
	}
	return ErrNotFound
}

// SaveFile stores file metadata and returns it.
func (s *Store) SaveFile(uploaderID, filename, storageKey, storagePath string) FileMeta {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.nextFileID++
	file := FileMeta{
		ID:          fmt.Sprintf("f_%d", s.nextFileID),
		UploaderID:  uploaderID,
		Filename:    filename,
		StorageKey:  storageKey,
		StoragePath: storagePath,
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
