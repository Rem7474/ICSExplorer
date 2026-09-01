package server

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"sort"
	"strings"

	"github.com/Rem7474/ICSExplorer/internal/guard"
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
			"academic_year":  s.cfg.AcademicYear,
			"sync_interval":  s.cfg.SyncInterval.String(),
			"sync_cercle":    s.cfg.SyncCercle,
			"concurrency":    s.cfg.Concurrency,
			"max_data_age":   s.cfg.MaxDataAge.String(),
		},
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(resp)
}

// handleSync triggers an on-demand synchronization cycle.
func (s *Server) handleSync(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	// If ADMIN_TOKEN is set, verify authorization
	if s.cfg.AdminToken != "" {
		authHeader := r.Header.Get("Authorization")
		expected := "Bearer " + s.cfg.AdminToken
		if authHeader != expected {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
	}

	stats := s.syncer.GetStats()
	if stats.IsSyncing {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusConflict)
		_ = json.NewEncoder(w).Encode(map[string]string{"message": "synchronization already in progress"})
		return
	}

	// Trigger sync in background goroutine
	go func() {
		_ = s.syncer.Sync(context.Background())
	}()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "synchronization started in background"})
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
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".ics") && e.Name() != "cercle.ics" {
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
