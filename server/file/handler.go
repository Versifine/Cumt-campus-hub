package file

import (
	"bytes"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/Versifine/Cumt-cumpus-hub/server/auth"
	"github.com/Versifine/Cumt-cumpus-hub/server/store"
)

type Handler struct {
	Store     store.API
	Auth      *auth.Service
	UploadDir string
}

// Upload handles POST /api/v1/files (multipart/form-data, field name: file).
func (h *Handler) Upload(c *gin.Context) {
	user, ok := h.Auth.RequireUser(c)
	if !ok {
		return
	}

	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 100<<20)
	if err := c.Request.ParseMultipartForm(100 << 20); err != nil {
		writeError(c, http.StatusBadRequest, 2001, "invalid multipart form")
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		writeError(c, http.StatusBadRequest, 2001, "missing file")
		return
	}
	defer file.Close()

	filename := sanitizeFilename(header.Filename)
	if filename == "" {
		writeError(c, http.StatusBadRequest, 2001, "invalid filename")
		return
	}

	if err := os.MkdirAll(h.UploadDir, 0o755); err != nil {
		writeError(c, http.StatusInternalServerError, 5000, "failed to prepare storage")
		return
	}

	storageKey := fmt.Sprintf("%d_%s", time.Now().UTC().UnixNano(), filename)
	storagePath := filepath.Join(h.UploadDir, storageKey)

	dst, err := os.Create(storagePath)
	if err != nil {
		writeError(c, http.StatusInternalServerError, 5000, "failed to save file")
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		writeError(c, http.StatusInternalServerError, 5000, "failed to write file")
		return
	}

	width, height, _ := readImageSize(storagePath)
	meta := h.Store.SaveFile(user.ID, filename, storageKey, storagePath, width, height)

	resp := struct {
		ID       string `json:"id"`
		Filename string `json:"filename"`
		URL      string `json:"url"`
		Width    int    `json:"width,omitempty"`
		Height   int    `json:"height,omitempty"`
	}{
		ID:       meta.ID,
		Filename: meta.Filename,
		URL:      "/files/" + meta.ID,
		Width:    meta.Width,
		Height:   meta.Height,
	}

	c.JSON(http.StatusOK, resp)
}

// UploadImage handles POST /api/uploads/images (multipart/form-data, field name: file).
func (h *Handler) UploadImage(c *gin.Context) {
	user, ok := h.Auth.RequireUser(c)
	if !ok {
		return
	}

	const maxInlineImageSize = 100 << 20
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxInlineImageSize)
	if err := c.Request.ParseMultipartForm(maxInlineImageSize); err != nil {
		writeError(c, http.StatusBadRequest, 2001, "invalid multipart form")
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		writeError(c, http.StatusBadRequest, 2001, "missing file")
		return
	}
	defer file.Close()

	filename := sanitizeFilename(header.Filename)
	if filename == "" {
		writeError(c, http.StatusBadRequest, 2001, "invalid filename")
		return
	}

	sniff := make([]byte, 512)
	n, _ := file.Read(sniff)
	contentType := http.DetectContentType(sniff[:n])
	if !strings.HasPrefix(contentType, "image/") {
		writeError(c, http.StatusBadRequest, 2001, "invalid image type")
		return
	}

	if err := os.MkdirAll(h.UploadDir, 0o755); err != nil {
		writeError(c, http.StatusInternalServerError, 5000, "failed to prepare storage")
		return
	}

	storageKey := fmt.Sprintf("%d_%s", time.Now().UTC().UnixNano(), filename)
	storagePath := filepath.Join(h.UploadDir, storageKey)

	dst, err := os.Create(storagePath)
	if err != nil {
		writeError(c, http.StatusInternalServerError, 5000, "failed to save file")
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, io.MultiReader(bytes.NewReader(sniff[:n]), file)); err != nil {
		writeError(c, http.StatusInternalServerError, 5000, "failed to write file")
		return
	}

	width, height, _ := readImageSize(storagePath)
	meta := h.Store.SaveFile(user.ID, filename, storageKey, storagePath, width, height)

	resp := struct {
		URL    string `json:"url"`
		Width  int    `json:"width,omitempty"`
		Height int    `json:"height,omitempty"`
	}{
		URL:    "/files/" + meta.ID,
		Width:  meta.Width,
		Height: meta.Height,
	}

	c.JSON(http.StatusOK, resp)
}

// Download handles GET /files/{file_id}.
func (h *Handler) Download(c *gin.Context) {
	fileID := strings.TrimSpace(c.Param("id"))
	if fileID == "" {
		writeError(c, http.StatusNotFound, 2001, "file not found")
		return
	}

	meta, ok := h.Store.GetFile(fileID)
	if !ok {
		writeError(c, http.StatusNotFound, 2001, "file not found")
		return
	}

	c.File(meta.StoragePath)
}

// sanitizeFilename strips directory components and trims whitespace to prevent path traversal.
func sanitizeFilename(name string) string {
	cleaned := strings.ReplaceAll(name, "\\", "/")
	cleaned = filepath.Base(cleaned)
	cleaned = strings.TrimSpace(cleaned)
	return cleaned
}

func readImageSize(path string) (int, int, bool) {
	file, err := os.Open(path)
	if err != nil {
		return 0, 0, false
	}
	defer file.Close()

	cfg, _, err := image.DecodeConfig(file)
	if err != nil {
		return 0, 0, false
	}
	if cfg.Width <= 0 || cfg.Height <= 0 {
		return 0, 0, false
	}
	return cfg.Width, cfg.Height, true
}

func writeError(c *gin.Context, status int, code int, message string) {
	c.JSON(status, gin.H{"code": code, "message": message})
}
