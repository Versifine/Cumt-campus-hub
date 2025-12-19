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

type Board struct {
	ID          string
	Name        string
	Description string
}

type Post struct {
	ID        string
	BoardID   string
	AuthorID  string
	Title     string
	Content   string
	CreatedAt string
}

type Comment struct {
	ID        string
	PostID    string
	AuthorID  string
	Content   string
	CreatedAt string
}

type ChatMessage struct {
	ID        string
	RoomID    string
	SenderID  string
	Content   string
	CreatedAt string
}

type FileMeta struct {
	ID          string
	UploaderID  string
	Filename    string
	StorageKey  string
	StoragePath string
	CreatedAt   string
}

type Store struct {
	mu          sync.Mutex
	users       map[string]User
	accounts    map[string]string
	tokens      map[string]string
	userTokens  map[string]string
	boards      []Board
	posts       []Post
	comments    []Comment
	files       map[string]FileMeta
	messages    map[string][]ChatMessage
	nextUserID  int
	nextPostID  int
	nextComment int
	nextFileID  int
	nextMsgID   int
}

func NewStore() *Store {
	return &Store{
		users:      map[string]User{},
		accounts:   map[string]string{},
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

func (s *Store) Login(account string) (string, User) {
	s.mu.Lock()
	defer s.mu.Unlock()

	trimmed := strings.TrimSpace(account)
	if trimmed == "" {
		trimmed = "anonymous"
	}

	userID, ok := s.accounts[trimmed]
	if !ok {
		s.nextUserID++
		userID = fmt.Sprintf("u_%d", s.nextUserID)
		user := User{
			ID:        userID,
			Nickname:  trimmed,
			CreatedAt: now(),
		}
		s.users[userID] = user
		s.accounts[trimmed] = userID
	}

	token := s.userTokens[userID]
	if token == "" {
		token = fmt.Sprintf("token_%s", userID)
		s.tokens[token] = userID
		s.userTokens[userID] = token
	}

	return token, s.users[userID]
}

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

func (s *Store) GetUser(userID string) (User, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	user, ok := s.users[userID]
	return user, ok
}

func (s *Store) Boards() []Board {
	s.mu.Lock()
	defer s.mu.Unlock()

	boards := make([]Board, len(s.boards))
	copy(boards, s.boards)
	return boards
}

func (s *Store) Posts(boardID string) []Post {
	s.mu.Lock()
	defer s.mu.Unlock()

	if boardID == "" {
		posts := make([]Post, len(s.posts))
		copy(posts, s.posts)
		return posts
	}

	filtered := make([]Post, 0, len(s.posts))
	for _, post := range s.posts {
		if post.BoardID == boardID {
			filtered = append(filtered, post)
		}
	}
	return filtered
}

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

func (s *Store) Comments(postID string) []Comment {
	s.mu.Lock()
	defer s.mu.Unlock()

	filtered := make([]Comment, 0, len(s.comments))
	for _, comment := range s.comments {
		if comment.PostID == postID {
			filtered = append(filtered, comment)
		}
	}
	return filtered
}

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

func (s *Store) GetFile(fileID string) (FileMeta, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	file, ok := s.files[fileID]
	return file, ok
}

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

func now() string {
	return time.Now().UTC().Format(time.RFC3339)
}
