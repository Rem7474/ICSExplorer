package syncer

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/Rem7474/ICSExplorer/internal/ade"
	"github.com/Rem7474/ICSExplorer/internal/config"
	"github.com/Rem7474/ICSExplorer/internal/ics"
)

// Stats holds information about the latest synchronization run.
type Stats struct {
	LastSyncTime     *time.Time `json:"last_sync_time,omitempty"`
	LastSyncDuration string     `json:"last_sync_duration,omitempty"`
	IsSyncing        bool       `json:"is_syncing"`
	TotalResources   int        `json:"total_resources"`
	ProcessedFiles   int        `json:"processed_files"`
	FailedFiles      int        `json:"failed_files"`
	Errors           []string   `json:"errors,omitempty"`
	LastSuccessTime  *time.Time `json:"last_success_time,omitempty"`
}

// Syncer orchestrates the downloading, formatting, and writing of ADE calendars.
type Syncer struct {
	cfg       *config.Config
	adeClient *ade.Client
	crawler   *ade.Crawler
	logger    *slog.Logger

	mu    sync.RWMutex
	stats Stats
}

// New creates a new Syncer instance.
func New(cfg *config.Config, adeClient *ade.Client, logger *slog.Logger) *Syncer {
	if logger == nil {
		logger = slog.Default()
	}
	return &Syncer{
		cfg:       cfg,
		adeClient: adeClient,
		crawler:   ade.NewCrawler(adeClient, cfg.AcademicYear),
		logger:    logger,
	}
}

// GetStats returns a thread-safe copy of the current sync statistics.
func (s *Syncer) GetStats() Stats {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.stats
}

// Sync runs a full synchronization cycle across all resources.
func (s *Syncer) Sync(ctx context.Context) error {
	s.mu.Lock()
	if s.stats.IsSyncing {
		s.mu.Unlock()
		return fmt.Errorf("synchronization is already in progress")
	}
	s.stats.IsSyncing = true
	s.stats.Errors = nil
	s.mu.Unlock()

	startTime := time.Now()
	s.logger.Info("starting synchronization cycle", "academic_year", s.cfg.AcademicYear, "concurrency", s.cfg.Concurrency)

	// Ensure destination directories exist
	if err := os.MkdirAll(s.cfg.OutputDir, 0755); err != nil {
		s.finishSync(startTime, fmt.Errorf("failed to create output dir: %w", err))
		return err
	}
	if err := os.MkdirAll(s.cfg.RoomsOutputDir, 0755); err != nil {
		s.finishSync(startTime, fmt.Errorf("failed to create rooms output dir: %w", err))
		return err
	}

	// Step 1: Discover resources (dynamic crawler or static fallback)
	resources, err := s.discoverResources(ctx)
	if err != nil {
		s.logger.Warn("resource discovery warning, using fallback", "error", err)
	}

	if len(resources) == 0 {
		err := fmt.Errorf("no resources available to synchronize")
		s.finishSync(startTime, err)
		return err
	}

	// Step 2: Optionally fetch Cercle events
	var cercleData []byte
	if s.cfg.SyncCercle && s.cfg.CercleIcsURL != "" {
		s.logger.Info("downloading Cercle Esisar public calendar...")
		cData, err := ics.FetchCercleCalendar(ctx, s.cfg.CercleIcsURL)
		if err != nil {
			s.logger.Warn("failed to fetch Cercle calendar", "error", err)
		} else {
			cercleData = cData
			// Save raw cercle.ics in output directory
			_ = os.WriteFile(filepath.Join(s.cfg.OutputDir, "cercle.ics"), cData, 0644)
			s.logger.Info("Cercle calendar downloaded successfully")
		}
	}

	// Step 3: Worker pool execution
	resChan := make(chan ade.Resource, len(resources))
	for _, res := range resources {
		resChan <- res
	}
	close(resChan)

	var wg sync.WaitGroup
	var errMu sync.Mutex
	var syncErrors []string
	var successCount int

	workerCount := s.cfg.Concurrency
	if workerCount <= 0 {
		workerCount = 5
	}
	if workerCount > len(resources) {
		workerCount = len(resources)
	}

	for i := 0; i < workerCount; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for res := range resChan {
				select {
				case <-ctx.Done():
					return
				default:
					if err := s.processResource(ctx, res, cercleData); err != nil {
						errMu.Lock()
						syncErrors = append(syncErrors, fmt.Sprintf("%s: %v", res.Name, err))
						errMu.Unlock()
						s.logger.Error("failed to process resource", "name", res.Name, "id", res.ID, "error", err)
					} else {
						errMu.Lock()
						successCount++
						errMu.Unlock()
					}
				}
			}
		}(i)
	}

	wg.Wait()

	// Step 4: Generate files.json index
	if err := s.generateFilesIndex(); err != nil {
		s.logger.Error("failed to generate files.json index", "error", err)
	}

	// Finalize stats
	s.mu.Lock()
	s.stats.TotalResources = len(resources)
	s.stats.ProcessedFiles = successCount
	s.stats.FailedFiles = len(syncErrors)
	s.stats.Errors = syncErrors
	if len(syncErrors) == 0 {
		now := time.Now()
		s.stats.LastSuccessTime = &now
	}
	s.mu.Unlock()

	var finalErr error
	if len(syncErrors) > 0 {
		finalErr = fmt.Errorf("sync completed with %d error(s)", len(syncErrors))
	}
	s.finishSync(startTime, finalErr)

	s.logger.Info("synchronization cycle finished",
		"duration", time.Since(startTime).Round(time.Millisecond).String(),
		"success", successCount,
		"failed", len(syncErrors),
	)

	return finalErr
}

func (s *Syncer) finishSync(startTime time.Time, err error) {
	now := time.Now()
	dur := now.Sub(startTime).Round(time.Millisecond).String()

	s.mu.Lock()
	defer s.mu.Unlock()
	s.stats.IsSyncing = false
	s.stats.LastSyncTime = &now
	s.stats.LastSyncDuration = dur
	if err != nil && len(s.stats.Errors) == 0 {
		s.stats.Errors = []string{err.Error()}
	}
}

func (s *Syncer) discoverResources(ctx context.Context) ([]ade.Resource, error) {
	// If credentials provided, attempt dynamic discovery first
	if s.cfg.AgalanLogin != "" && s.cfg.AgalanPassword != "" {
		s.logger.Info("crawling ADE tree dynamically for promo resources...")
		discovered, err := s.crawler.DiscoverResources(ctx)
		if err == nil && len(discovered) > 0 {
			s.logger.Info("dynamic discovery found resources", "count", len(discovered))
			// Also append rooms from static file
			roomsFile := filepath.Join(s.cfg.DataDir, "Rooms-IDS.txt")
			if rooms, err := ade.LoadStaticIDs(roomsFile, true); err == nil {
				discovered = append(discovered, rooms...)
			}
			return discovered, nil
		}
		s.logger.Warn("dynamic discovery failed or empty, falling back to static IDS.txt", "error", err)
	}

	// Fallback to static IDS.txt and Rooms-IDS.txt
	var all []ade.Resource
	idsFile := filepath.Join(s.cfg.DataDir, "IDS.txt")
	if promos, err := ade.LoadStaticIDs(idsFile, false); err == nil {
		all = append(all, promos...)
	} else {
		s.logger.Warn("failed to load static IDS.txt", "path", idsFile, "error", err)
	}

	roomsFile := filepath.Join(s.cfg.DataDir, "Rooms-IDS.txt")
	if rooms, err := ade.LoadStaticIDs(roomsFile, true); err == nil {
		all = append(all, rooms...)
	} else {
		s.logger.Warn("failed to load static Rooms-IDS.txt", "path", roomsFile, "error", err)
	}

	return all, nil
}

func (s *Syncer) processResource(ctx context.Context, res ade.Resource, cercleData []byte) error {
	raw, err := s.adeClient.FetchCalendarRaw(ctx, res.ID)
	if err != nil {
		return fmt.Errorf("fetch calendar failed: %w", err)
	}

	// Unfold lines and format description / summary / location
	unfolded := ics.UnfoldLines(raw)
	formatted := ics.FormatCalendarLines(unfolded)

	calendarBytes := []byte(ics.JoinLines(formatted))

	// If not a room and Cercle events exist, merge them
	if !res.IsRoom && len(cercleData) > 0 {
		merged, err := ics.MergeCercleEvents(calendarBytes, cercleData)
		if err == nil {
			calendarBytes = merged
		}
	}

	// Determine output destination
	targetDir := s.cfg.OutputDir
	if res.IsRoom {
		targetDir = s.cfg.RoomsOutputDir
	}

	// Clean filename (replace slashes or invalid characters)
	safeName := strings.ReplaceAll(res.Name, "/", "-")
	safeName = strings.ReplaceAll(safeName, "\\", "-")
	fileName := fmt.Sprintf("%s.ics", safeName)
	targetPath := filepath.Join(targetDir, fileName)

	// Atomic file write using temporary file
	tmpPath := targetPath + ".tmp"
	if err := os.WriteFile(tmpPath, calendarBytes, 0644); err != nil {
		return fmt.Errorf("failed to write tmp file: %w", err)
	}

	if err := os.Rename(tmpPath, targetPath); err != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("failed to commit file %s: %w", targetPath, err)
	}

	return nil
}

// generateFilesIndex scans the OutputDir and writes files.json with the list of student .ics files.
func (s *Syncer) generateFilesIndex() error {
	entries, err := os.ReadDir(s.cfg.OutputDir)
	if err != nil {
		return err
	}

	var files []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".ics") && e.Name() != "cercle.ics" {
			files = append(files, e.Name())
		}
	}

	sort.Strings(files)

	jsonData, err := json.MarshalIndent(files, "", "  ")
	if err != nil {
		return err
	}

	filesJsonPath := filepath.Join(s.cfg.OutputDir, "files.json")
	tmpPath := filesJsonPath + ".tmp"
	if err := os.WriteFile(tmpPath, jsonData, 0644); err != nil {
		return err
	}

	return os.Rename(tmpPath, filesJsonPath)
}
