package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Versifine/Cumt-cumpus-hub/server/auth"
	"github.com/Versifine/Cumt-cumpus-hub/server/chat"
	"github.com/Versifine/Cumt-cumpus-hub/server/community"
	"github.com/Versifine/Cumt-cumpus-hub/server/file"
	"github.com/Versifine/Cumt-cumpus-hub/server/internal/transport"
	"github.com/Versifine/Cumt-cumpus-hub/server/store"
)

func main() {
	store := store.NewStore()
	authService := &auth.Service{Store: store}
	chatHub := chat.NewHub()

	communityHandler := &community.Handler{Store: store, Auth: authService}
	chatHandler := &chat.Handler{Store: store, Hub: chatHub}

	uploadDir := strings.TrimSpace(os.Getenv("UPLOAD_DIR"))
	if uploadDir == "" {
		uploadDir = defaultUploadDir()
	}
	uploadDir = filepath.Clean(uploadDir)

	fileHandler := &file.Handler{
		Store:     store,
		Auth:      authService,
		UploadDir: uploadDir,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		transport.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	mux.HandleFunc("/api/v1/auth/login", authService.LoginHandler)
	mux.HandleFunc("/api/v1/users/me", authService.MeHandler)
	mux.HandleFunc("/api/v1/boards", communityHandler.Boards)
	mux.HandleFunc("/api/v1/posts", communityHandler.Posts)
	mux.HandleFunc("/api/v1/posts/", func(w http.ResponseWriter, r *http.Request) {
		trimmed := strings.TrimPrefix(r.URL.Path, "/api/v1/posts/")
		parts := strings.Split(trimmed, "/")
		if len(parts) == 2 && parts[1] == "comments" {
			communityHandler.Comments(parts[0])(w, r)
			return
		}
		transport.WriteError(w, http.StatusNotFound, 2001, "not found")
	})

	mux.HandleFunc("/api/v1/files", fileHandler.Upload)
	mux.HandleFunc("/files/", func(w http.ResponseWriter, r *http.Request) {
		fileID := strings.TrimPrefix(r.URL.Path, "/files/")
		fileHandler.Download(fileID)(w, r)
	})

	mux.HandleFunc("/ws/chat", chatHandler.ServeWS)
	mux.Handle("/", http.FileServer(http.Dir("apps/web")))

	addr := strings.TrimSpace(os.Getenv("SERVER_ADDR"))
	if addr == "" {
		addr = ":8080"
	}

	server := &http.Server{
		Addr:              addr,
		Handler:           logging(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("server listening on %s", addr)
	log.Fatal(server.ListenAndServe())
}

func logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s", r.Method, r.URL.Path)
		next.ServeHTTP(w, r)
	})
}

func defaultUploadDir() string {
	cwd, err := os.Getwd()
	if err != nil {
		return "storage"
	}
	candidate := filepath.Join(cwd, "server", "storage")
	if info, err := os.Stat(candidate); err == nil && info.IsDir() {
		return candidate
	}
	return filepath.Join(cwd, "storage")
}
