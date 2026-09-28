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

func TestSyncerWithCercleIsolation(t *testing.T) {
	// Setup mock servers for ADE and Cercle
	mockADE := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "tree.jsp") {
			w.Header().Set("Content-Type", "text/html")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`<html><body>
				<div class="treeline"><span><a href="javascript:selectLeaf('1001',0)">1A-Test</a></span></div>
			</body></html>`))
			return
		}
		if r.URL.Path == "/2026-2027/etudiant/esisar" {
			w.WriteHeader(http.StatusOK)
			return
		}
		w.Header().Set("Content-Type", "text/calendar")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:ade-class-1\r\nSUMMARY:Cours ADE\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n"))
	}))
	defer mockADE.Close()

	mockCercle := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/calendar")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:cercle-wei-1\r\nSUMMARY:WEI Multi-Day\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n"))
	}))
	defer mockCercle.Close()

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
		SyncCercle:       true,
		CercleIcsURL:     mockCercle.URL,
		SyncInterval:     30 * time.Minute,
		MaxDataAge:       24 * time.Hour,
		MinFileSizeBytes: 10,
	}

	adeClient := ade.NewClient("", "", cfg.AcademicYear)
	adeClient.SetBaseURL(mockADE.URL)

	s := New(cfg, adeClient, nil)

	if err := s.Sync(context.Background()); err != nil {
		t.Fatalf("Sync() failed: %v", err)
	}

	// Verify cercle.ics is written to outputDir
	cercleFile := filepath.Join(outputDir, "cercle.ics")
	cercleContent, err := os.ReadFile(cercleFile)
	if err != nil {
		t.Fatalf("expected cercle.ics to exist: %v", err)
	}
	if !strings.Contains(string(cercleContent), "cercle-wei-1") {
		t.Errorf("expected cercle.ics to contain Cercle event")
	}

	// Verify promo file does NOT contain Cercle event (Option A: pure academic calendar)
	promoFile := filepath.Join(outputDir, "1A-Test.ics")
	promoContent, err := os.ReadFile(promoFile)
	if err != nil {
		t.Fatalf("expected 1A-Test.ics to exist: %v", err)
	}
	if strings.Contains(string(promoContent), "cercle-wei-1") {
		t.Errorf("expected promo file NOT to contain merged Cercle event, but it did")
	}
	if !strings.Contains(string(promoContent), "ade-class-1") {
		t.Errorf("expected promo file to contain ADE event")
	}
}

func newPruneTestSyncer(t *testing.T) (s *Syncer, outputDir, roomsDir string) {
	t.Helper()
	tmpDir := t.TempDir()
	outputDir = filepath.Join(tmpDir, "output")
	roomsDir = filepath.Join(tmpDir, "rooms")
	_ = os.MkdirAll(outputDir, 0o755)
	_ = os.MkdirAll(roomsDir, 0o755)
	cfg := &config.Config{OutputDir: outputDir, RoomsOutputDir: roomsDir, AcademicYear: "2026-2027"}
	return New(cfg, ade.NewClient("", "", cfg.AcademicYear), nil), outputDir, roomsDir
}

func TestPruneStaleFiles(t *testing.T) {
	s, outputDir, roomsDir := newPruneTestSyncer(t)

	for _, name := range []string{"1A-A.ics", "1A-B.ics", "2A-A.ics", "3A-Old.ics", "cercle.ics", "ru.ics", "files.json", "1A-A.ics.tmp"} {
		_ = os.WriteFile(filepath.Join(outputDir, name), []byte("x"), 0o644)
	}
	_ = os.WriteFile(filepath.Join(roomsDir, "A042.ics"), []byte("x"), 0o644)

	s.pruneStaleFiles([]ade.Resource{
		{Name: "1A-A", ID: "1"}, {Name: "1A-B", ID: "2"}, {Name: "2A-A", ID: "3"},
		{Name: "A042", ID: "9", IsRoom: true},
	})

	for _, gone := range []string{"3A-Old.ics", "1A-A.ics.tmp"} {
		if _, err := os.Stat(filepath.Join(outputDir, gone)); !os.IsNotExist(err) {
			t.Errorf("expected %s to be removed", gone)
		}
	}
	for _, kept := range []string{"1A-A.ics", "1A-B.ics", "2A-A.ics", "cercle.ics", "ru.ics", "files.json"} {
		if _, err := os.Stat(filepath.Join(outputDir, kept)); err != nil {
			t.Errorf("expected %s to be kept: %v", kept, err)
		}
	}
	if _, err := os.Stat(filepath.Join(roomsDir, "A042.ics")); err != nil {
		t.Errorf("expected room calendar to be kept: %v", err)
	}
}

func TestPruneStaleFilesRefusesMassDeletion(t *testing.T) {
	s, outputDir, _ := newPruneTestSyncer(t)
	for _, name := range []string{"1A-A.ics", "1A-B.ics", "2A-A.ics", "2A-B.ics"} {
		_ = os.WriteFile(filepath.Join(outputDir, name), []byte("x"), 0o644)
	}

	// A partial crawl returning a single resource must not wipe 3 of 4 calendars.
	s.pruneStaleFiles([]ade.Resource{{Name: "1A-A", ID: "1"}})

	entries, _ := os.ReadDir(outputDir)
	if len(entries) != 4 {
		t.Errorf("expected all 4 calendars to be kept, got %d", len(entries))
	}
}

func TestFilesIndexExcludesAuxiliaryCalendars(t *testing.T) {
	s, outputDir, _ := newPruneTestSyncer(t)
	for _, name := range []string{"1A-A.ics", "cercle.ics", "ru.ics"} {
		_ = os.WriteFile(filepath.Join(outputDir, name), []byte("x"), 0o644)
	}
	if err := s.generateFilesIndex(); err != nil {
		t.Fatalf("generateFilesIndex: %v", err)
	}
	data, _ := os.ReadFile(filepath.Join(outputDir, "files.json"))
	var files []string
	_ = json.Unmarshal(data, &files)
	if len(files) != 1 || files[0] != "1A-A.ics" {
		t.Errorf("expected only 1A-A.ics in files.json, got %v", files)
	}
}
