package guard

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestCheckHealthHealthy(t *testing.T) {
	tmpDir := t.TempDir()

	// Create dummy fresh ics file of 60KB
	content := make([]byte, 60000)
	testFile := filepath.Join(tmpDir, "1A-Test.ics")
	if err := os.WriteFile(testFile, content, 0644); err != nil {
		t.Fatalf("failed to write test file: %v", err)
	}

	lastSync := time.Now()
	report := CheckHealth(tmpDir, 24*time.Hour, 50000, &lastSync, nil)

	if report.Status != "healthy" {
		t.Errorf("expected status 'healthy', got %q. Errors: %v", report.Status, report.Errors)
	}
	if !report.Fresh {
		t.Errorf("expected fresh=true, got %v", report.Fresh)
	}
	if report.FilesCount != 1 {
		t.Errorf("expected files_count 1, got %d", report.FilesCount)
	}
}

func TestCheckHealthStale(t *testing.T) {
	tmpDir := t.TempDir()

	content := make([]byte, 60000)
	testFile := filepath.Join(tmpDir, "1A-Test.ics")
	if err := os.WriteFile(testFile, content, 0644); err != nil {
		t.Fatalf("failed to write test file: %v", err)
	}

	// Fake last sync 2 days ago
	oldSync := time.Now().Add(-48 * time.Hour)
	report := CheckHealth(tmpDir, 24*time.Hour, 50000, &oldSync, nil)

	if report.Status != "unhealthy" {
		t.Errorf("expected status 'unhealthy' for stale data, got %q", report.Status)
	}
	if report.Fresh {
		t.Errorf("expected fresh=false, got true")
	}
}

func TestCheckHealthEmptyDir(t *testing.T) {
	tmpDir := t.TempDir()

	report := CheckHealth(tmpDir, 24*time.Hour, 50000, nil, nil)
	if report.Status != "unhealthy" {
		t.Errorf("expected status 'unhealthy' for empty dir, got %q", report.Status)
	}
}
