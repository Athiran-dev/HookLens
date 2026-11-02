package server

import (
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// staticHandler serves the exported Next.js dashboard (STATIC_DIR). Without a build it serves a
// short note so `go run ./cmd/api` still works for API-only development.
func (s *Server) staticHandler() http.Handler {
	dir := s.cfg.StaticDir
	if st, err := os.Stat(dir); err != nil || !st.IsDir() {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if strings.HasPrefix(r.URL.Path, "/api/") {
				writeErr(w, 404, "not found")
				return
			}
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			w.Write([]byte("HookLens API is running. Dashboard not built (set STATIC_DIR or run `npm run build` in web/).\n"))
		})
	}
	fileServer := http.FileServer(http.Dir(dir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			writeErr(w, 404, "not found")
			return
		}
		clean := path.Clean("/" + r.URL.Path)
		candidates := []string{clean, path.Join(clean, "index.html"), clean + ".html"}
		for _, c := range candidates {
			p := filepath.Join(dir, filepath.FromSlash(c))
			if st, err := os.Stat(p); err == nil && !st.IsDir() {
				if strings.HasPrefix(clean, "/_next/static/") {
					w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
				} else {
					w.Header().Set("Cache-Control", "no-cache")
				}
				http.ServeFile(w, r, p)
				return
			}
		}
		_ = fileServer
		w.WriteHeader(http.StatusNotFound)
		if b, err := os.ReadFile(filepath.Join(dir, "404.html")); err == nil {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Write(b)
		}
	})
}
