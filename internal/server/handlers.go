package server

import (
	"crypto/subtle"
	"encoding/json"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/Rem7474/ICSExplorer/internal/guard"
	"github.com/Rem7474/ICSExplorer/internal/ics"
)

func (s *Server) registerRoutes(mux *http.ServeMux) {
	// API Endpoints
	mux.HandleFunc("GET /api/health", s.handleHealth)
	mux.HandleFunc("GET /api/status", s.handleStatus)
	mux.HandleFunc("/api/sync", s.handleSync)
	mux.HandleFunc("GET /api/files", s.handleFilesList)
	mux.HandleFunc("GET /api/rooms", s.handleRoomsList)
	mux.HandleFunc("GET /api/universities", s.handleUniversitiesList)
	mux.HandleFunc("/api/tree", s.handleTree)
	mux.HandleFunc("/api/personal-calendar", s.handlePersonalCalendar)

	// Static endpoints
	mux.Handle("/output/", http.StripPrefix("/output/", s.createOutputHandler()))
	mux.Handle("/rooms/", http.StripPrefix("/rooms/", s.createRoomsHandler()))
	mux.Handle("/", s.createFrontendHandler())
}

// handleHealth returns 200 OK when data is fresh and healthy, or 503 when stale / errored.
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	stats := s.syncer.GetStats()
	var lastErr error
	if len(stats.Errors) > 0 {
		lastErr = &syncError{msg: stats.Errors[0]}
	}

	report := guard.CheckHealth(s.cfg.OutputDir, s.cfg.MaxDataAge, s.cfg.MinFileSizeBytes, stats.LastSyncTime, lastErr)

	w.Header().Set("Content-Type", "application/json")
	if report.Status == "healthy" {
		w.WriteHeader(http.StatusOK)
	} else {
		w.WriteHeader(http.StatusServiceUnavailable)
	}

	_ = json.NewEncoder(w).Encode(report)
}

// handleStatus returns complete sync stats and configuration metadata.
func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	stats := s.syncer.GetStats()
	report := guard.CheckHealth(s.cfg.OutputDir, s.cfg.MaxDataAge, s.cfg.MinFileSizeBytes, stats.LastSyncTime, nil)

	resp := map[string]any{
		"sync_stats":    stats,
		"health_report": report,
		"config": map[string]any{
			"academic_year": s.cfg.AcademicYear,
			"sync_interval": s.cfg.SyncInterval.String(),
			"sync_cercle":   s.cfg.SyncCercle,
			"concurrency":   s.cfg.Concurrency,
			"max_data_age":  s.cfg.MaxDataAge.String(),
		},
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(resp)
}

// handleSync triggers an on-demand synchronization cycle. It is disabled
// unless ADMIN_TOKEN is configured: a full sync hammers the upstream ADE
// server, so it must never be callable anonymously.
func (s *Server) handleSync(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	if s.cfg.AdminToken == "" {
		writeJSONError(w, http.StatusForbidden, "manual synchronization is disabled (ADMIN_TOKEN is not set)")
		return
	}

	token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	if !ok || subtle.ConstantTimeCompare([]byte(token), []byte(s.cfg.AdminToken)) != 1 {
		writeJSONError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	if s.syncer.GetStats().IsSyncing {
		writeJSONError(w, http.StatusConflict, "synchronization already in progress")
		return
	}

	s.manualSyncMu.Lock()
	if wait := manualSyncCooldown - time.Since(s.lastManualSync); wait > 0 {
		s.manualSyncMu.Unlock()
		w.Header().Set("Retry-After", strconv.Itoa(int(wait.Seconds())+1))
		writeJSONError(w, http.StatusTooManyRequests, "a synchronization was triggered recently, please retry later")
		return
	}
	s.lastManualSync = time.Now()
	s.manualSyncMu.Unlock()

	// Run in the background, bound to the server lifetime (canceled on shutdown).
	go func() {
		if err := s.syncer.Sync(s.bgCtx); err != nil {
			s.logger.Warn("manual sync completed with errors", "error", err)
		}
	}()

	writeJSON(w, http.StatusAccepted, map[string]string{"message": "synchronization started in background"})
}

// writeJSON encodes v as the JSON response body with the given status.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// writeJSONError writes a {"error": msg} JSON body with the given status.
func writeJSONError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// handleFilesList returns the list of available student calendar files.
func (s *Server) handleFilesList(w http.ResponseWriter, r *http.Request) {
	files := s.listIcsFiles(s.cfg.OutputDir)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(files)
}

// handleRoomsList returns the list of available room calendar files.
func (s *Server) handleRoomsList(w http.ResponseWriter, r *http.Request) {
	files := s.listIcsFiles(s.cfg.RoomsOutputDir)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(files)
}

func (s *Server) listIcsFiles(dir string) []string {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return []string{}
	}

	var files []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".ics") && !ics.IsAuxiliaryCalendar(e.Name()) {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)
	return files
}

type syncError struct {
	msg string
}

func (e *syncError) Error() string {
	return e.msg
}
