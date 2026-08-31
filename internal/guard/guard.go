package guard

import (
	"fmt"
	"os"
	"strings"
	"time"
)

// HealthReport contains detailed diagnostic info about data freshness and file integrity.
type HealthReport struct {
	Status           string        `json:"status"` // "healthy" or "unhealthy"
	Fresh            bool          `json:"fresh"`
	LastSync         *time.Time    `json:"last_sync,omitempty"`
	LastSyncAge      string        `json:"last_sync_age,omitempty"`
	FilesCount       int           `json:"files_count"`
	StaleFiles       []string      `json:"stale_files,omitempty"`
	SmallFiles       []string      `json:"small_files,omitempty"`
	MaxDataAge       string        `json:"max_data_age"`
	MinFileSizeBytes int64         `json:"min_file_size_bytes"`
	Errors           []string      `json:"errors,omitempty"`
	Uptime           string        `json:"uptime"`
	UptimeSeconds    int64         `json:"uptime_seconds"`
}

var serverStartTime = time.Now()

// CheckHealth analyzes the output directory for file count, freshness, and size constraints.
func CheckHealth(outputDir string, maxAge time.Duration, minFileSize int64, lastSyncTime *time.Time, lastSyncErr error) HealthReport {
	now := time.Now()
	uptime := now.Sub(serverStartTime)

	report := HealthReport{
		Status:           "healthy",
		Fresh:            true,
		MaxDataAge:       maxAge.String(),
		MinFileSizeBytes: minFileSize,
		Uptime:           uptime.Round(time.Second).String(),
		UptimeSeconds:    int64(uptime.Seconds()),
		LastSync:         lastSyncTime,
	}

	if lastSyncTime != nil {
		syncAge := now.Sub(*lastSyncTime)
		report.LastSyncAge = syncAge.Round(time.Second).String()
		if syncAge > maxAge {
			report.Fresh = false
			report.Errors = append(report.Errors, fmt.Sprintf("last sync was %s ago (threshold: %s)", syncAge.Round(time.Minute), maxAge))
		}
	}

	if lastSyncErr != nil {
		report.Errors = append(report.Errors, fmt.Sprintf("last sync error: %v", lastSyncErr))
	}

	entries, err := os.ReadDir(outputDir)
	if err != nil {
		report.Status = "unhealthy"
		report.Fresh = false
		report.Errors = append(report.Errors, fmt.Sprintf("failed to read output directory: %v", err))
		return report
	}

	var icsCount int
	var newestModTime time.Time

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".ics") || entry.Name() == "cercle.ics" {
			continue
		}
		icsCount++

		info, err := entry.Info()
		if err != nil {
			continue
		}

		if info.ModTime().After(newestModTime) {
			newestModTime = info.ModTime()
		}

		// Check size constraint (ignore small special test files if any, but flag standard schedules)
		if info.Size() < minFileSize {
			report.SmallFiles = append(report.SmallFiles, fmt.Sprintf("%s (%d bytes)", entry.Name(), info.Size()))
		}

		// Check age constraint
		if now.Sub(info.ModTime()) > maxAge {
			report.StaleFiles = append(report.StaleFiles, entry.Name())
		}
	}

	report.FilesCount = icsCount

	if icsCount == 0 {
		report.Status = "unhealthy"
		report.Fresh = false
		report.Errors = append(report.Errors, "no ICS calendar files found in output directory")
	}

	if len(report.StaleFiles) > 0 && len(report.StaleFiles) > icsCount/2 {
		report.Fresh = false
		report.Errors = append(report.Errors, fmt.Sprintf("%d of %d files are older than %s", len(report.StaleFiles), icsCount, maxAge))
	}

	if len(report.Errors) > 0 || !report.Fresh {
		report.Status = "unhealthy"
	}

	return report
}
