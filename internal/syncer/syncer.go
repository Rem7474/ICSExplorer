package syncer

import (
	"bufio"
	"bytes"
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
	"github.com/Rem7474/ICSExplorer/internal/crous"
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
	cfg         *config.Config
	adeClient   *ade.Client
	crawler     *ade.Crawler
	logger      *slog.Logger
	verifyDelay time.Duration

	mu    sync.RWMutex
	stats Stats
}

// New creates a new Syncer instance.
func New(cfg *config.Config, adeClient *ade.Client, logger *slog.Logger) *Syncer {
	if logger == nil {
		logger = slog.Default()
	}
	return &Syncer{
		cfg:         cfg,
		adeClient:   adeClient,
		crawler:     ade.NewCrawler(adeClient, cfg.AcademicYear),
		logger:      logger,
		verifyDelay: 2 * time.Second,
	}
}

// SetVerifyDelay configures the delay before double-checking an ADE calendar when missing events are detected.
func (s *Syncer) SetVerifyDelay(d time.Duration) {
	s.verifyDelay = d
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

	// Reset ADE session before starting sync cycle so that each scheduled or manual
	// sync operates with a fresh ADE Campus session.
	if s.adeClient != nil {
		s.adeClient.ResetSession()
	}

	// Ensure destination directories exist
	if err := os.MkdirAll(s.cfg.OutputDir, 0o755); err != nil {
		s.finishSync(startTime, fmt.Errorf("failed to create output dir: %w", err))
		return err
	}
	if err := os.MkdirAll(s.cfg.RoomsOutputDir, 0o755); err != nil {
		s.finishSync(startTime, fmt.Errorf("failed to create rooms output dir: %w", err))
		return err
	}

	// Step 1: Discover resources (dynamic crawler or static fallback)
	resources := s.discoverResources(ctx)

	if len(resources) == 0 {
		err := fmt.Errorf("no resources available to synchronize")
		s.finishSync(startTime, err)
		return err
	}

	// Step 2: Optionally fetch Cercle events and save as standalone cercle.ics
	if s.cfg.SyncCercle && s.cfg.CercleIcsURL != "" {
		s.logger.Info("downloading Cercle Esisar public calendar...")
		cData, err := ics.FetchCercleCalendar(ctx, s.cfg.CercleIcsURL)
		if err != nil {
			s.logger.Warn("failed to fetch Cercle calendar", "error", err)
		} else {
			// Save raw cercle.ics in output directory for frontend use
			_ = os.WriteFile(filepath.Join(s.cfg.OutputDir, ics.CercleFileName), cData, 0o644)
			s.logger.Info("Cercle calendar downloaded successfully")
		}
	}

	// Step 2b: Optionally fetch RU Briff'O menus and save as standalone ru.ics
	if s.cfg.SyncRU {
		s.logger.Info("downloading RU Briff'O menus from CROUStillant Open Data...", "restaurant_id", s.cfg.RURestaurantID)
		ruClient := crous.NewClient(s.cfg.RURestaurantID)
		menus, err := ruClient.FetchMenu(ctx)
		if err != nil {
			s.logger.Warn("failed to fetch RU menu", "error", err)
		} else if len(menus) > 0 {
			icsData := crous.GenerateICS(menus, s.cfg.RUSlotStartHour, s.cfg.RUSlotStartMin, s.cfg.RUSlotEndHour, s.cfg.RUSlotEndMin)
			_ = os.WriteFile(filepath.Join(s.cfg.OutputDir, ics.RUFileName), icsData, 0o644)
			s.logger.Info("RU Briff'O menu downloaded and generated successfully", "days", len(menus))
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
		go func() {
			defer wg.Done()
			for res := range resChan {
				select {
				case <-ctx.Done():
					return
				default:
					if err := s.processResource(ctx, res); err != nil {
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
		}()
	}

	wg.Wait()

	// Step 3b: Remove calendars that no longer exist upstream (renamed or
	// deleted groups), only after a fully successful, uninterrupted run.
	if len(syncErrors) == 0 && ctx.Err() == nil {
		s.pruneStaleFiles(resources)
	}

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

func (s *Syncer) discoverResources(ctx context.Context) []ade.Resource {
	s.logger.Info("crawling ADE tree dynamically for promo resources...")
	discovered, err := s.crawler.DiscoverResources(ctx)
	if err != nil {
		s.logger.Error("dynamic discovery failed", "error", err)
		return nil
	}
	s.logger.Info("dynamic discovery found resources", "count", len(discovered))

	// Append known rooms
	discovered = append(discovered, ade.DefaultRooms()...)
	return discovered
}

func (s *Syncer) processResource(ctx context.Context, res ade.Resource) error {
	raw, err := s.adeClient.FetchCalendarRaw(ctx, res.ID)
	if err != nil {
		return fmt.Errorf("fetch calendar failed: %w", err)
	}

	if !strings.Contains(string(raw), "BEGIN:VCALENDAR") {
		return fmt.Errorf("upstream response does not contain a valid VCALENDAR for %s (%s)", res.Name, res.ID)
	}

	// Unfold lines and format description / summary / location
	unfolded := ics.UnfoldLines(raw)
	formatted := ics.FormatCalendarLines(unfolded)

	calendarBytes := []byte(ics.JoinLines(formatted))

	// Determine output destination
	targetDir := s.cfg.OutputDir
	if res.IsRoom {
		targetDir = s.cfg.RoomsOutputDir
	}

	targetPath := filepath.Join(targetDir, resourceFileName(res))

	// If a calendar already exists on disk, check for missing events.
	// In ADE Campus, race conditions or temporary sync glitches can cause individual
	// events to disappear momentarily. We double-check with a short delay before overwriting.
	if existingBytes, readErr := os.ReadFile(targetPath); readErr == nil && len(existingBytes) > 0 && strings.Contains(string(existingBytes), "BEGIN:VEVENT") {
		missingCount := countMissingEvents(existingBytes, calendarBytes)
		if missingCount > 0 {
			s.logger.Info("detected potential missing events from ADE, performing double-check with delay",
				"resource", res.Name,
				"id", res.ID,
				"missingCount", missingCount,
			)

			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(s.verifyDelay):
			}

			retryRaw, retryErr := s.adeClient.FetchCalendarRaw(ctx, res.ID)
			if retryErr == nil && strings.Contains(string(retryRaw), "BEGIN:VCALENDAR") {
				retryUnfolded := ics.UnfoldLines(retryRaw)
				retryFormatted := ics.FormatCalendarLines(retryUnfolded)
				retryBytes := []byte(ics.JoinLines(retryFormatted))
				retryMissing := countMissingEvents(existingBytes, retryBytes)

				if retryMissing < missingCount {
					s.logger.Info("ADE double-check recovered missing events",
						"resource", res.Name,
						"id", res.ID,
						"previouslyMissing", missingCount,
						"nowMissing", retryMissing,
					)
					calendarBytes = retryBytes
					missingCount = retryMissing
				} else {
					s.logger.Info("ADE double-check confirmed event removal",
						"resource", res.Name,
						"id", res.ID,
						"missingCount", missingCount,
					)
				}
			}
		}

		// Guard against empty or mass disappearance:
		// 1) If 0 events returned, always preserve existing calendar.
		if strings.Count(string(calendarBytes), "BEGIN:VEVENT") == 0 {
			s.logger.Warn("ADE returned 0 events for resource with existing calendar; preserving existing calendar",
				"resource", res.Name, "id", res.ID)
			return nil
		}

		// 2) If more than 50% of events disappeared abruptly from a calendar with at least 10 events,
		// preserve existing calendar (similar to maxPruneRatio) to protect against ADE export truncation.
		existingCount := strings.Count(string(existingBytes), "BEGIN:VEVENT")
		newCount := strings.Count(string(calendarBytes), "BEGIN:VEVENT")
		if existingCount >= 10 && float64(existingCount-newCount)/float64(existingCount) > 0.5 {
			s.logger.Warn("mass event disappearance detected (>50%); preserving existing calendar",
				"resource", res.Name, "id", res.ID, "existing", existingCount, "new", newCount)
			return nil
		}
	}

	// Atomic file write using temporary file
	tmpPath := targetPath + ".tmp"
	if err := os.WriteFile(tmpPath, calendarBytes, 0o644); err != nil {
		return fmt.Errorf("failed to write tmp file: %w", err)
	}

	if err := os.Rename(tmpPath, targetPath); err != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("failed to commit file %s: %w", targetPath, err)
	}

	return nil
}

// extractEventUIDs returns a set of all event UIDs found in the given iCalendar data.
func extractEventUIDs(calendarData []byte) map[string]bool {
	uids := make(map[string]bool)
	scanner := bufio.NewScanner(bytes.NewReader(calendarData))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(line, "UID:") {
			uid := strings.TrimSpace(strings.TrimPrefix(line, "UID:"))
			if uid != "" {
				uids[uid] = true
			}
		} else if strings.HasPrefix(line, "UID;") {
			if idx := strings.Index(line, ":"); idx != -1 {
				uid := strings.TrimSpace(line[idx+1:])
				if uid != "" {
					uids[uid] = true
				}
			}
		}
	}
	return uids
}

// countMissingEvents compares existing and new calendar data and returns the number of
// previously existing events missing in the new data.
func countMissingEvents(existingData, newData []byte) int {
	existingUIDs := extractEventUIDs(existingData)
	newUIDs := extractEventUIDs(newData)

	if len(existingUIDs) > 0 {
		missing := 0
		for uid := range existingUIDs {
			if !newUIDs[uid] {
				missing++
			}
		}
		return missing
	}

	// Fallback to VEVENT count if UIDs were not present
	existingCount := strings.Count(string(existingData), "BEGIN:VEVENT")
	newCount := strings.Count(string(newData), "BEGIN:VEVENT")
	if existingCount > newCount {
		return existingCount - newCount
	}
	return 0
}

// resourceFileName returns the .ics file name a resource is written to.
func resourceFileName(res ade.Resource) string {
	safeName := strings.ReplaceAll(res.Name, "/", "-")
	safeName = strings.ReplaceAll(safeName, "\\", "-")
	return safeName + ".ics"
}

// maxPruneRatio caps the share of existing calendars a single run may delete:
// a sudden mass disappearance is more likely a partial ADE tree crawl than a
// real reorganization, so it is logged and left for a human to check.
const maxPruneRatio = 0.5

// pruneStaleFiles deletes .ics files (and leftover .tmp files) that do not
// correspond to any resource of the current run.
func (s *Syncer) pruneStaleFiles(resources []ade.Resource) {
	expected := map[string]map[string]bool{
		s.cfg.OutputDir:      {},
		s.cfg.RoomsOutputDir: {},
	}
	for _, res := range resources {
		dir := s.cfg.OutputDir
		if res.IsRoom {
			dir = s.cfg.RoomsOutputDir
		}
		expected[dir][resourceFileName(res)] = true
	}

	for dir, keep := range expected {
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}

		var stale []string
		total := 0
		for _, e := range entries {
			name := e.Name()
			if e.IsDir() {
				continue
			}
			if strings.HasSuffix(name, ".tmp") {
				_ = os.Remove(filepath.Join(dir, name))
				continue
			}
			if !strings.HasSuffix(name, ".ics") || ics.IsAuxiliaryCalendar(name) {
				continue
			}
			total++
			if !keep[name] {
				stale = append(stale, name)
			}
		}

		if len(stale) == 0 {
			continue
		}
		if float64(len(stale)) > float64(total)*maxPruneRatio {
			s.logger.Warn("skipping stale calendar cleanup: too many files would be removed",
				"dir", dir, "stale", len(stale), "total", total)
			continue
		}
		for _, name := range stale {
			if err := os.Remove(filepath.Join(dir, name)); err != nil {
				s.logger.Warn("failed to remove stale calendar", "file", name, "error", err)
				continue
			}
			s.logger.Info("removed stale calendar no longer present in ADE", "file", name)
		}
	}
}

// generateFilesIndex scans the OutputDir and writes files.json with the list of student .ics files.
func (s *Syncer) generateFilesIndex() error {
	entries, err := os.ReadDir(s.cfg.OutputDir)
	if err != nil {
		return err
	}

	var files []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".ics") && !ics.IsAuxiliaryCalendar(e.Name()) {
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
	if err := os.WriteFile(tmpPath, jsonData, 0o644); err != nil {
		return err
	}

	return os.Rename(tmpPath, filesJsonPath)
}
