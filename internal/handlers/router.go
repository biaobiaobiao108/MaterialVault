package handlers

import (
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"materialvault/internal/config"
)

func NewRouter(cfg *config.Config, embeddedFS fs.FS) http.Handler {
	mux := http.NewServeMux()

	// 1. Items API
	mux.HandleFunc("POST /api/items/url", HandleCaptureURL(cfg.AssetsDir))
	mux.HandleFunc("POST /api/items/note", HandleCreateNote)
	mux.HandleFunc("POST /api/items/batch", HandleBatchItems)
	mux.HandleFunc("POST /api/items/{id}/retry", HandleRetryItem(cfg.AssetsDir))
	mux.HandleFunc("POST /api/items/{id}/tags", HandleLinkItemTag)
	mux.HandleFunc("DELETE /api/items/{id}/tags/{tagId}", HandleUnlinkItemTag)
	mux.HandleFunc("GET /api/items/{id}", HandleGetItem)
	mux.HandleFunc("PATCH /api/items/{id}", HandleUpdateItem)
	mux.HandleFunc("DELETE /api/items/{id}", HandleDeleteItem)
	mux.HandleFunc("GET /api/items", HandleListItems)

	// 2. Tags API
	mux.HandleFunc("GET /api/tags", HandleListTags)
	mux.HandleFunc("POST /api/tags", HandleCreateTag)
	mux.HandleFunc("PATCH /api/tags/{id}", HandleUpdateTag)
	mux.HandleFunc("DELETE /api/tags/{id}", HandleDeleteTag)

	// 3. Assets & Uploads
	mux.HandleFunc("GET /api/assets/{id}", HandleGetAsset(cfg.AssetsDir))
	mux.HandleFunc("POST /api/uploads", HandleUploads(cfg.AssetsDir))

	// 4. Search, Stats, Backup
	mux.HandleFunc("GET /api/search", HandleSearch)
	mux.HandleFunc("GET /api/stats", HandleStats)
	mux.HandleFunc("GET /api/backup", HandleBackup)

	// Fallback 404 for unhandled /api/
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"error":"API route not found"}`, http.StatusNotFound)
	})

	// 5. Wrap with SPA & Static File Server & CORS
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Handle CORS Preflight
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Max-Age", "86400")
			w.WriteHeader(http.StatusNoContent)
			return
		}

		w.Header().Set("Access-Control-Allow-Origin", "*")

		// If it's an API route, pass directly to mux
		if strings.HasPrefix(r.URL.Path, "/api/") {
			mux.ServeHTTP(w, r)
			return
		}

		// Try embedded FS first if provided
		if embeddedFS != nil {
			reqPath := strings.TrimPrefix(r.URL.Path, "/")
			if reqPath == "" {
				reqPath = "index.html"
			}
			f, err := embeddedFS.Open(reqPath)
			if err == nil {
				_ = f.Close()
				http.FileServer(http.FS(embeddedFS)).ServeHTTP(w, r)
				return
			}
			// SPA fallback to index.html from embed
			indexFile, err := embeddedFS.Open("index.html")
			if err == nil {
				_ = indexFile.Close()
				r.URL.Path = "/index.html"
				http.FileServer(http.FS(embeddedFS)).ServeHTTP(w, r)
				return
			}
		}

		// Try public directory on disk
		if cfg.PublicDir != "" {
			publicFile := filepath.Join(cfg.PublicDir, r.URL.Path)
			if stat, err := os.Stat(publicFile); err == nil && !stat.IsDir() {
				http.ServeFile(w, r, publicFile)
				return
			}
		}

		// Try dist directory on disk
		if cfg.DistDir != "" {
			distFile := filepath.Join(cfg.DistDir, r.URL.Path)
			if stat, err := os.Stat(distFile); err == nil && !stat.IsDir() {
				http.ServeFile(w, r, distFile)
				return
			}

			// SPA Fallback: dist/index.html
			indexHtml := filepath.Join(cfg.DistDir, "index.html")
			if _, err := os.Stat(indexHtml); err == nil {
				http.ServeFile(w, r, indexHtml)
				return
			}
		}

		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("Material Vault Go Server Running"))
	})
}
