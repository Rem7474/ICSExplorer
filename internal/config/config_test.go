package config

import (
	"os"
	"testing"
	"time"
)

func TestDetectAcademicYear(t *testing.T) {
	tests := []struct {
		now      time.Time
		expected string
	}{
		{now: time.Date(2026, time.January, 15, 10, 0, 0, 0, time.UTC), expected: "2025-2026"},
		{now: time.Date(2026, time.July, 31, 23, 59, 59, 0, time.UTC), expected: "2025-2026"},
		{now: time.Date(2026, time.August, 1, 0, 0, 0, 0, time.UTC), expected: "2026-2027"},
		{now: time.Date(2026, time.September, 1, 0, 0, 0, 0, time.UTC), expected: "2026-2027"},
		{now: time.Date(2026, time.December, 31, 23, 59, 59, 0, time.UTC), expected: "2026-2027"},
	}

	for _, tt := range tests {
		got := DetectAcademicYear(tt.now)
		if got != tt.expected {
			t.Errorf("DetectAcademicYear(%v) = %q; want %q", tt.now, got, tt.expected)
		}
	}
}

func TestLoadDefaults(t *testing.T) {
	os.Clearenv()
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() unexpected error: %v", err)
	}

	if cfg.Port != 8080 {
		t.Errorf("expected port 8080, got %d", cfg.Port)
	}
	if cfg.DataDir != "data" {
		t.Errorf("expected data dir 'data', got %q", cfg.DataDir)
	}
	if cfg.Concurrency != 5 {
		t.Errorf("expected concurrency 5, got %d", cfg.Concurrency)
	}
	if cfg.SyncInterval != 30*time.Minute {
		t.Errorf("expected sync interval 30m, got %v", cfg.SyncInterval)
	}
	if cfg.MaxDataAge != 24*time.Hour {
		t.Errorf("expected max data age 24h, got %v", cfg.MaxDataAge)
	}
}

func TestLoadCustomEnv(t *testing.T) {
	os.Setenv("PORT", "9090")
	os.Setenv("CONCURRENCY", "10")
	os.Setenv("SYNC_INTERVAL", "15m")
	os.Setenv("AGALAN_LOGIN", "testuser")
	os.Setenv("AGALAN_PASSWORD", "testpass")
	defer os.Clearenv()

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() unexpected error: %v", err)
	}

	if cfg.Port != 9090 {
		t.Errorf("expected port 9090, got %d", cfg.Port)
	}
	if cfg.Concurrency != 10 {
		t.Errorf("expected concurrency 10, got %d", cfg.Concurrency)
	}
	if cfg.SyncInterval != 15*time.Minute {
		t.Errorf("expected sync interval 15m, got %v", cfg.SyncInterval)
	}
	if cfg.AgalanLogin != "testuser" || cfg.AgalanPassword != "testpass" {
		t.Errorf("expected login/pass testuser/testpass, got %q/%q", cfg.AgalanLogin, cfg.AgalanPassword)
	}
}
