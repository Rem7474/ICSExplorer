package syncer

import (
	"context"
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
)

func TestSyncerWithMockServer(t *testing.T) {
	// Setup mock ADE server
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "tree.jsp") {
			w.Header().Set("Content-Type", "text/html")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`<html><body>
				<div class="treeline"><span><a href="javascript:selectLeaf('1001',0)">1A-Test</a></span></div>
				<div class="treeline"><span><a href="javascript:selectLeaf('1002',0)">2A-Test</a></span></div>
			</body></html>`))
			return
		}
		if r.URL.Path == "/2026-2027/etudiant/esisar" {
			w.WriteHeader(http.StatusOK)
			return
		}
		w.Header().Set("Content-Type", "text/calendar")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Test Class\r\nDESCRIPTION:1A_Test\\nProf A\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n"))
	}))
	defer mockServer.Close()

	tmpDir := t.TempDir()
	outputDir := filepath.Join(tmpDir, "output")
	roomsDir := filepath.Join(tmpDir, "rooms")
	dataDir := filepath.Join(tmpDir, "data")
	_ = os.MkdirAll(dataDir, 0o755)

	cfg := &config.Config{
		OutputDir:        outputDir,
		RoomsOutputDir:   roomsDir,
		DataDir:          dataDir,
		AcademicYear:     "2026-2027",
		Concurrency:      2,
		SyncCercle:       false,
		SyncInterval:     30 * time.Minute,
		MaxDataAge:       24 * time.Hour,
		MinFileSizeBytes: 10,
	}

	adeClient := ade.NewClient("", "", cfg.AcademicYear)
	adeClient.SetBaseURL(mockServer.URL)

	s := New(cfg, adeClient, nil)

	ctx := context.Background()
	err := s.Sync(ctx)
	if err != nil {
		t.Fatalf("Sync() failed: %v", err)
	}

	stats := s.GetStats()
	// 2 promos from crawler + 13 default rooms = 15 processed files
	if stats.ProcessedFiles != 15 {
		t.Errorf("expected 15 processed files, got %d", stats.ProcessedFiles)
	}
	if stats.FailedFiles != 0 {
		t.Errorf("expected 0 failed files, got %d", stats.FailedFiles)
	}

	// Verify generated promo file
	file1 := filepath.Join(outputDir, "1A-Test.ics")
	if _, err := os.Stat(file1); os.IsNotExist(err) {
		t.Errorf("expected file %s to exist", file1)
	}

	// Verify generated room file
	room1 := filepath.Join(roomsDir, "A042.ics")
	if _, err := os.Stat(room1); os.IsNotExist(err) {
		t.Errorf("expected room file %s to exist", room1)
	}

	// Verify files.json
	jsonFile := filepath.Join(outputDir, "files.json")
	data, err := os.ReadFile(jsonFile)
	if err != nil {
		t.Fatalf("failed to read files.json: %v", err)
	}

	var filesList []string
	if err := json.Unmarshal(data, &filesList); err != nil {
		t.Fatalf("invalid files.json content: %v", err)
	}

	if len(filesList) != 2 {
		t.Errorf("expected 2 files in files.json, got %d", len(filesList))
	}
}
