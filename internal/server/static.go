package server

import (
	"encoding/json"
	"fmt"
	"html"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

// createOutputHandler serves generated .ics files and files.json with CORS and ETag support.
func (s *Server) createOutputHandler() http.Handler {
	fileServer := http.FileServer(http.Dir(s.cfg.OutputDir))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")

		path := filepath.Join(s.cfg.OutputDir, filepath.Clean("/"+r.URL.Path))

		if strings.HasSuffix(path, ".ics") {
			w.Header().Set("Content-Type", "text/calendar; charset=utf-8")
			w.Header().Set("Cache-Control", "public, max-age=300, must-revalidate")
		} else if strings.HasSuffix(path, ".json") {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.Header().Set("Cache-Control", "no-cache")
		}

		// If requesting root of /output/ and directory listing is needed
		if r.URL.Path == "" || r.URL.Path == "/" {
			// If files.json exists, we can let file server or custom autoindex serve
			filesJsonPath := filepath.Join(s.cfg.OutputDir, "files.json")
			if _, err := os.Stat(filesJsonPath); err == nil {
				// Render basic HTML directory listing matching nginx/apache autoindex
				s.renderAutoIndex(w, s.cfg.OutputDir)
				return
			}
		}

		fileServer.ServeHTTP(w, r)
	})
}

// createRoomsHandler serves room calendar files.
func (s *Server) createRoomsHandler() http.Handler {
	fileServer := http.FileServer(http.Dir(s.cfg.RoomsOutputDir))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		if strings.HasSuffix(r.URL.Path, ".ics") {
			w.Header().Set("Content-Type", "text/calendar; charset=utf-8")
		}
		fileServer.ServeHTTP(w, r)
	})
}

// createFrontendHandler serves the built Vue 3 SPA with history fallback.
func (s *Server) createFrontendHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Clean the path
		relPath := filepath.Clean("/" + r.URL.Path)
		filePath := filepath.Join(s.cfg.StaticDir, relPath)

		// Check if file exists on disk
		info, err := os.Stat(filePath)
		if err == nil && !info.IsDir() {
			// Serve index.html with potential license injection
			if strings.HasSuffix(filePath, "index.html") {
				s.serveIndexHTML(w, r, filePath)
				return
			}

			// Cache control for other assets
			if strings.HasSuffix(filePath, "sw.js") {
				w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			} else if strings.Contains(relPath, "/assets/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			}
			http.ServeFile(w, r, filePath)
			return
		}

		// Fallback to index.html for SPA routing
		indexPath := filepath.Join(s.cfg.StaticDir, "index.html")
		if _, err := os.Stat(indexPath); err == nil {
			s.serveIndexHTML(w, r, indexPath)
			return
		}

		// Default fallback if frontend dist is not built yet
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `<!DOCTYPE html><html><head><title>EDT Esisar API</title></head><body><h1>EDT Esisar Backend API</h1><p>Frontend dist directory (%s) not found. Run <code>npm run build</code> in frontend directory.</p><p><a href="/api/status">API Status</a> | <a href="/api/health">Health Check</a> | <a href="/output/">Output Directory</a></p></body></html>`, s.cfg.StaticDir)
	})
}

func (s *Server) renderAutoIndex(w http.ResponseWriter, dir string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		http.Error(w, "unable to list directory", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)

	var sb strings.Builder
	sb.WriteString("<!DOCTYPE html><html><head><title>Index of /output/</title></head><body><h1>Index of /output/</h1><hr><ul>")
	for _, e := range entries {
		name := e.Name()
		escapedHref := html.EscapeString(url.PathEscape(name))
		escapedName := html.EscapeString(name)
		fmt.Fprintf(&sb, `<li><a href="%s">%s</a></li>`, escapedHref, escapedName)
	}
	sb.WriteString("</ul><hr></body></html>")

	_, _ = w.Write([]byte(sb.String()))
}

// serveIndexHTML delivers index.html, optionally injecting the PrimeUI license key.
func (s *Server) serveIndexHTML(w http.ResponseWriter, r *http.Request, filePath string) {
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")

	if s.cfg.PrimeUILicense == "" {
		http.ServeFile(w, r, filePath)
		return
	}

	content, err := os.ReadFile(filePath)
	if err != nil {
		http.ServeFile(w, r, filePath)
		return
	}

	jsonLicense, err := json.Marshal(s.cfg.PrimeUILicense)
	if err != nil {
		http.ServeFile(w, r, filePath)
		return
	}

	injection := fmt.Sprintf("<script>window.PRIMEUI_LICENSE=%s;</script>", jsonLicense)

	htmlStr := string(content)
	if idx := strings.Index(htmlStr, "</head>"); idx != -1 {
		htmlStr = htmlStr[:idx] + injection + htmlStr[idx:]
	} else {
		htmlStr = injection + htmlStr
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(htmlStr))
}
