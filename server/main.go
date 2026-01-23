package main

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/Versifine/Cumt-cumpus-hub/server/auth"
	"github.com/Versifine/Cumt-cumpus-hub/server/chat"
	"github.com/Versifine/Cumt-cumpus-hub/server/community"
	"github.com/Versifine/Cumt-cumpus-hub/server/file"
	"github.com/Versifine/Cumt-cumpus-hub/server/notification"
	"github.com/Versifine/Cumt-cumpus-hub/server/report"
	"github.com/Versifine/Cumt-cumpus-hub/server/search"
	"github.com/Versifine/Cumt-cumpus-hub/server/store"
)

func main() {
	loggerWriter, closeLogger := setupLogger()
	defer closeLogger()

	log.SetOutput(loggerWriter)
	gin.DefaultWriter = loggerWriter
	gin.DefaultErrorWriter = loggerWriter

	// -----------------------------
	// 1) 上传目录配置
	// -----------------------------
	// 读取环境变量 UPLOAD_DIR，用于指定文件上传/存储的目录。
	// - 若未设置或为空，则使用 defaultUploadDir() 推导一个默认目录。
	uploadDir := strings.TrimSpace(os.Getenv("UPLOAD_DIR"))
	if uploadDir == "" {
		uploadDir = defaultUploadDir()
	}

	// filepath.Clean 用于规范化路径（消除重复分隔符、.、.. 等）。
	uploadDir = filepath.Clean(uploadDir)

	// -----------------------------
	// 2) 依赖初始化 / “手动注入”
	// -----------------------------
	// 初始化数据存储层：支持内存 / SQLite（通过环境变量切换）。
	dataStore := mustCreateStore(uploadDir)
	if closer, ok := dataStore.(interface{ Close() error }); ok {
		defer func() { _ = closer.Close() }()
	}

	// 认证服务：依赖 store，用于登录、获取当前用户等。
	authService := &auth.Service{Store: dataStore}

	// 聊天 Hub：用于管理 WebSocket 连接、广播消息等（典型的 hub-and-spoke 结构）。
	chatHub := chat.NewHub()

	// -----------------------------
	// 3) 初始化各业务 Handler
	// -----------------------------
	// 社区模块 Handler：依赖 store（数据读写）和 Auth（鉴权/当前用户信息）。
	communityHandler := &community.Handler{Store: dataStore, Auth: authService}

	// 聊天模块 Handler：依赖 store（消息/会话数据等）和 Hub（WS 连接管理）。
	chatHandler := &chat.Handler{Store: dataStore, Hub: chatHub}

	reportHandler := &report.Handler{Store: dataStore, Auth: authService}

	// 搜索模块 Handler：依赖 store（数据检索）。
	searchHandler := &search.Handler{Store: dataStore}

	// 通知模块 Handler：依赖 store 和 auth。
	notificationHandler := &notification.Handler{Store: dataStore, Auth: authService}

	// 文件模块 Handler：依赖 store、鉴权服务，以及上传目录配置。
	fileHandler := &file.Handler{
		Store:     dataStore,
		Auth:      authService,
		UploadDir: uploadDir,
	}

	// -----------------------------
	// 4) 路由注册（Gin）
	// -----------------------------
	router := gin.New()
	router.Use(gin.LoggerWithWriter(loggerWriter))
	router.Use(gin.RecoveryWithWriter(loggerWriter))

	// 健康检查接口：用于容器探活/负载均衡健康检查。
	// 返回 JSON：{"status":"ok"}。
	router.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	})

	// -----------------------------
	// 5) REST API：认证相关
	// -----------------------------
	router.POST("/api/v1/auth/register", authService.RegisterHandler)

	// 登录接口：由 authService 提供处理函数。
	router.POST("/api/v1/auth/login", authService.LoginHandler)

	// 获取当前登录用户信息（通常依赖鉴权 token/cookie 等）。
	router.GET("/api/v1/users/me", authService.GetMe)
	router.PATCH("/api/v1/users/me", authService.UpdateMe)

	router.GET("/api/v1/users/:id", authService.GetUser)
	router.POST("/api/v1/users/:id/follow", authService.FollowUser)
	router.DELETE("/api/v1/users/:id/follow", authService.UnfollowUser)
	router.GET("/api/v1/users/:id/followers", authService.GetFollowers)
	router.GET("/api/v1/users/:id/following", authService.GetFollowing)
	router.GET("/api/v1/users/:id/comments", authService.GetUserComments)

	// -----------------------------
	// 6) REST API：社区相关
	// -----------------------------
	// boards 列表/创建等操作（具体取决于 communityHandler 的实现）。
	router.GET("/api/v1/boards", communityHandler.GetBoards)

	// posts 列表/创建等操作。
	router.GET("/api/v1/posts", communityHandler.ListPosts)
	router.POST("/api/v1/posts", communityHandler.CreatePost)

	router.GET("/api/v1/posts/:id", communityHandler.GetPost)
	router.DELETE("/api/v1/posts/:id", communityHandler.DeletePost)

	router.POST("/api/v1/posts/:id/votes", communityHandler.VotePost)
	router.DELETE("/api/v1/posts/:id/votes", communityHandler.ClearPostVote)

	router.GET("/api/v1/posts/:id/comments", communityHandler.ListComments)
	router.POST("/api/v1/posts/:id/comments", communityHandler.CreateComment)
	router.DELETE("/api/v1/posts/:id/comments/:commentId", communityHandler.DeleteComment)

	router.POST("/api/v1/posts/:id/comments/:commentId/votes", communityHandler.VoteComment)
	router.DELETE("/api/v1/posts/:id/comments/:commentId/votes", communityHandler.ClearCommentVote)

	// -----------------------------
	// 7) REST API：举报与管理（P0）
	// -----------------------------
	router.POST("/api/v1/reports", reportHandler.Create)
	router.GET("/api/v1/admin/reports", reportHandler.AdminList)
	router.PATCH("/api/v1/admin/reports/:id", reportHandler.AdminUpdate)

	// -----------------------------
	// 8) REST API：搜索
	// -----------------------------
	router.GET("/api/v1/search/posts", searchHandler.SearchPosts)
	router.GET("/api/v1/search/users", searchHandler.SearchUsers)

	// -----------------------------
	// 9) REST API：通知
	// -----------------------------
	router.GET("/api/v1/notifications", notificationHandler.List)
	router.GET("/api/v1/notifications/unread-count", notificationHandler.UnreadCount)
	router.PATCH("/api/v1/notifications/:id", notificationHandler.MarkRead)
	router.POST("/api/v1/notifications/read-all", notificationHandler.MarkAllRead)

	// -----------------------------
	// 10) REST API：文件上传/下载
	// -----------------------------
	router.POST("/api/v1/files", fileHandler.Upload)
	router.POST("/api/uploads/images", fileHandler.UploadImage)
	router.GET("/files/:id", fileHandler.Download)

	// -----------------------------
	// 11) WebSocket：聊天
	// -----------------------------
	router.GET("/ws/chat", chatHandler.ServeWS)

	// -----------------------------
	// 12) 静态资源：前端页面
	// -----------------------------
	fileServer := http.FileServer(http.Dir("apps/web"))
	router.NoRoute(func(c *gin.Context) {
		fileServer.ServeHTTP(c.Writer, c.Request)
	})

	// -----------------------------
	// 13) 服务监听地址配置
	// -----------------------------
	// SERVER_ADDR 用于指定监听地址，例如 ":8080" 或 "127.0.0.1:8080"
	addr := strings.TrimSpace(os.Getenv("SERVER_ADDR"))
	if addr == "" {
		// 默认监听 8080
		addr = ":8080"
	}

	// -----------------------------
	// 14) 构造 HTTP Server 并启动
	// -----------------------------
	server := &http.Server{
		Addr: addr,
		// 外层套一层 logging 中间件，用于打印请求日志。
		Handler: router,

		// 读取请求头的超时时间，避免慢速请求头攻击（Slowloris）。
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("server listening on %s", addr)
	log.Fatal(server.ListenAndServe())
}

func mustCreateStore(uploadDir string) store.API {
	path := strings.TrimSpace(os.Getenv("SQLITE_PATH"))
	if path == "" {
		path = filepath.Join("server", "storage", "dev.db")
	}
	path = filepath.Clean(path)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		log.Fatalf("failed to create sqlite directory: %v", err)
	}

	log.Printf("storage: using sqlite database at %s", path)
	dbStore, err := store.OpenSQLite(path)
	if err != nil {
		log.Fatalf("failed to open sqlite store: %v", err)
	}
	return dbStore
}

type dailyLogWriter struct {
	dir         string
	prefix      string
	currentDate string
	file        *os.File
	mu          sync.Mutex
}

func newDailyLogWriter(dir, prefix string) (*dailyLogWriter, error) {
	if strings.TrimSpace(dir) == "" {
		return nil, fmt.Errorf("log dir is empty")
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	return &dailyLogWriter{dir: dir, prefix: prefix}, nil
}

func (w *dailyLogWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	date := time.Now().Format("2006-01-02")
	if w.file == nil || w.currentDate != date {
		if w.file != nil {
			_ = w.file.Close()
		}
		filename := filepath.Join(w.dir, fmt.Sprintf("%s%s.log", w.prefix, date))
		file, err := os.OpenFile(filename, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
		if err != nil {
			return 0, err
		}
		w.file = file
		w.currentDate = date
	}
	return w.file.Write(p)
}

func (w *dailyLogWriter) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.file == nil {
		return nil
	}
	err := w.file.Close()
	w.file = nil
	return err
}

func setupLogger() (io.Writer, func()) {
	logDir := strings.TrimSpace(os.Getenv("LOG_DIR"))
	if logDir == "" {
		logDir = defaultLogDir()
	}
	logDir = filepath.Clean(logDir)

	writer, err := newDailyLogWriter(logDir, "gin-")
	if err != nil {
		log.Printf("failed to initialize logger: %v", err)
		return os.Stdout, func() {}
	}

	return io.MultiWriter(os.Stdout, writer), func() {
		_ = writer.Close()
	}
}

// defaultUploadDir 推导默认上传目录：
//  1. 优先使用 <repo>/server/storage：当进程工作目录在仓库根目录时，
//     server/storage 存在则使用该路径。
//  2. 否则使用 <cwd>/storage：在其他工作目录运行时也能落盘存储。
func defaultUploadDir() string {
	// 获取当前工作目录（cwd = current working directory）
	cwd, err := os.Getwd()
	if err != nil {
		// 若获取失败，退化为相对路径 "storage"
		return "storage"
	}

	// 候选路径：<cwd>/server/storage
	candidate := filepath.Join(cwd, "server", "storage")

	// 如果 candidate 存在且是目录，则认为是在仓库根目录启动，使用该目录。
	if info, err := os.Stat(candidate); err == nil && info.IsDir() {
		return candidate
	}

	// 否则使用 <cwd>/storage
	return filepath.Join(cwd, "storage")
}

func defaultLogDir() string {
	cwd, err := os.Getwd()
	if err != nil {
		return "logs"
	}

	serverDir := filepath.Join(cwd, "server")
	if info, err := os.Stat(serverDir); err == nil && info.IsDir() {
		return filepath.Join(serverDir, "logs")
	}

	return filepath.Join(cwd, "logs")
}
