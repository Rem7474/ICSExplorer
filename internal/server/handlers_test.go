package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Rem7474/ICSExplorer/internal/ade"
	"github.com/Rem7474/ICSExplorer/internal/config"
	"github.com/Rem7474/ICSExplorer/internal/guard"
	"github.com/Rem7474/ICSExplorer/internal/syncer"
)

func setupTestServer(t *testing.T) (*Server, *config.Config, string) {
	tmpDir := t.TempDir()
	outputDir := filepath.Join(tmpDir, "output")
	roomsDir := filepath.Join(tmpDir, "rooms")
	staticDir := filepath.Join(tmpDir, "static")

	_ = os.MkdirAll(outputDir, 0755)
	_ = os.MkdirAll(roomsDir, 0755)
	_ = os.MkdirAll(staticDir, 0755)

	// Create sample index.html
	_ = os.WriteFile(filepath.Join(staticDir, "index.html"), []byte("<html><body>EDT App</body></html>"), 0644)

	// Create sample .ics files
	_ = os.WriteFile(filepath.Join(outputDir, "1A-Test.ics"), make([]byte, 60000), 0644)
	_ = os.WriteFile(filepath.Join(roomsDir, "A166.ics"), []byte("BEGIN:VCALENDAR\r\nEND:VCALENDAR"), 0644)

	cfg := &config.Config{
		Port:             8080,
		OutputDir:        outputDir,
		RoomsOutputDir:   roomsDir,
		DataDir:          tmpDir,
		StaticDir:        staticDir,
		MaxDataAge:       24 * time.Hour,
		MinFileSizeBytes: 50000,
		AcademicYear:     "2026-2027",
		SyncInterval:     30 * time.Minute,
		AdminToken:       "secret-token",
	}

	adeClient := ade.NewClient("", "", cfg.AcademicYear)
	syncService := syncer.New(cfg, adeClient, nil)

	srv := New(cfg, syncService, nil)
	return srv, cfg, tmpDir
}

func TestHealthEndpoint(t *testing.T) {
	srv, _, _ := setupTestServer(t)

	mux := http.NewServeMux()
	srv.registerRoutes(mux)
	handler := srv.applyMiddlewares(mux)

	// Test GET /api/health
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200 OK, got %d. Body: %s", w.Code, w.Body.String())
	}

	var report guard.HealthReport
	if err := json.Unmarshal(w.Body.Bytes(), &report); err != nil {
		t.Fatalf("failed to parse health response: %v", err)
	}

	if report.Status != "healthy" || !report.Fresh {
		t.Errorf("expected healthy report, got %+v", report)
	}
}

func TestStatusEndpoint(t *testing.T) {
	srv, _, _ := setupTestServer(t)

	mux := http.NewServeMux()
	srv.registerRoutes(mux)
	handler := srv.applyMiddlewares(mux)

	req := httptest.NewRequest(http.MethodGet, "/api/status", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200 OK, got %d", w.Code)
	}

	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse status JSON: %v", err)
	}

	if _, exists := resp["sync_stats"]; !exists {
		t.Errorf("expected 'sync_stats' in response")
	}
	if _, exists := resp["health_report"]; !exists {
		t.Errorf("expected 'health_report' in response")
	}
}

func TestSyncEndpoint(t *testing.T) {
	srv, _, _ := setupTestServer(t)

	mux := http.NewServeMux()
	srv.registerRoutes(mux)
	handler := srv.applyMiddlewares(mux)

	// GET not allowed on /api/sync
	reqGet := httptest.NewRequest(http.MethodGet, "/api/sync", nil)
	wGet := httptest.NewRecorder()
	handler.ServeHTTP(wGet, reqGet)
	if wGet.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405 Method Not Allowed on GET /api/sync, got %d", wGet.Code)
	}

	// POST without auth token when token configured -> 401
	reqNoAuth := httptest.NewRequest(http.MethodPost, "/api/sync", nil)
	wNoAuth := httptest.NewRecorder()
	handler.ServeHTTP(wNoAuth, reqNoAuth)
	if wNoAuth.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", wNoAuth.Code)
	}

	// POST with valid auth token -> 202 Accepted
	reqAuth := httptest.NewRequest(http.MethodPost, "/api/sync", nil)
	reqAuth.Header.Set("Authorization", "Bearer secret-token")
	wAuth := httptest.NewRecorder()
	handler.ServeHTTP(wAuth, reqAuth)
	if wAuth.Code != http.StatusAccepted {
		t.Errorf("expected 202 Accepted, got %d. Body: %s", wAuth.Code, wAuth.Body.String())
	}
}

func TestFilesAndRoomsEndpoints(t *testing.T) {
	srv, _, _ := setupTestServer(t)

	mux := http.NewServeMux()
	srv.registerRoutes(mux)
	handler := srv.applyMiddlewares(mux)

	// GET /api/files
	reqFiles := httptest.NewRequest(http.MethodGet, "/api/files", nil)
	wFiles := httptest.NewRecorder()
	handler.ServeHTTP(wFiles, reqFiles)
	if wFiles.Code != http.StatusOK {
		t.Errorf("expected 200 OK on /api/files, got %d", wFiles.Code)
	}

	var files []string
	if err := json.Unmarshal(wFiles.Body.Bytes(), &files); err != nil {
		t.Fatalf("failed to unmarshal /api/files: %v", err)
	}
	if len(files) != 1 || files[0] != "1A-Test.ics" {
		t.Errorf("unexpected files list: %v", files)
	}

	// GET /api/rooms
	reqRooms := httptest.NewRequest(http.MethodGet, "/api/rooms", nil)
	wRooms := httptest.NewRecorder()
	handler.ServeHTTP(wRooms, reqRooms)
	if wRooms.Code != http.StatusOK {
		t.Errorf("expected 200 OK on /api/rooms, got %d", wRooms.Code)
	}
}

func TestStaticAndFrontendHandlers(t *testing.T) {
	srv, _, _ := setupTestServer(t)

	mux := http.NewServeMux()
	srv.registerRoutes(mux)
	handler := srv.applyMiddlewares(mux)

	// GET /output/1A-Test.ics
	reqOutput := httptest.NewRequest(http.MethodGet, "/output/1A-Test.ics", nil)
	wOutput := httptest.NewRecorder()
	handler.ServeHTTP(wOutput, reqOutput)
	if wOutput.Code != http.StatusOK {
		t.Errorf("expected 200 OK on /output/1A-Test.ics, got %d", wOutput.Code)
	}
	if ct := wOutput.Header().Get("Content-Type"); ct != "text/calendar; charset=utf-8" {
		t.Errorf("unexpected Content-Type: %s", ct)
	}

	// GET / (SPA root)
	reqRoot := httptest.NewRequest(http.MethodGet, "/", nil)
	wRoot := httptest.NewRecorder()
	handler.ServeHTTP(wRoot, reqRoot)
	if wRoot.Code != http.StatusOK {
		t.Errorf("expected 200 OK on /, got %d", wRoot.Code)
	}
	if !strings.Contains(wRoot.Body.String(), "EDT App") {
		t.Errorf("expected SPA index.html content, got: %s", wRoot.Body.String())
	}

	// GET /promo/1A (SPA client route fallback)
	reqSPA := httptest.NewRequest(http.MethodGet, "/promo/1A", nil)
	wSPA := httptest.NewRecorder()
	handler.ServeHTTP(wSPA, reqSPA)
	if wSPA.Code != http.StatusOK {
		t.Errorf("expected 200 OK on SPA fallback /promo/1A, got %d", wSPA.Code)
	}
	if !strings.Contains(wSPA.Body.String(), "EDT App") {
		t.Errorf("expected SPA fallback to index.html, got: %s", wSPA.Body.String())
	}
}
