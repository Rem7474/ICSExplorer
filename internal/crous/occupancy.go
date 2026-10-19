package crous

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
	_ "time/tzdata" // restaurant hours are Paris time even on images without tzdata
)

const (
	// DefaultOccupancyURL is the lescrous "écran" endpoint of RU Briff'O (lunch service).
	DefaultOccupancyURL = "https://restos.lescrous.fr/api/ecran/38-6-24-1?service=midi"

	// occupancyHistoryDays is how many days of samples are kept on disk.
	occupancyHistoryDays = 90
	// maxSamplesPerDay bounds the intraday series of a single day.
	maxSamplesPerDay = 500
)

// Sample is one reading of the restaurant's attendance.
type Sample struct {
	Time     time.Time `json:"t"`
	Served   int       `json:"served"`
	Capacity int       `json:"capacity"`
}

// Occupancy is a live reading of the number of meals served and remaining.
type Occupancy struct {
	Served    int       `json:"served"`
	Capacity  int       `json:"capacity"`
	Remaining int       `json:"remaining"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// DaySummary is the final tally of one service day.
type DaySummary struct {
	Date     string `json:"date"` // YYYY-MM-DD
	Served   int    `json:"served"`
	Capacity int    `json:"capacity"`
}

// OccupancyReport is what the API exposes: the latest reading, today's curve
// and the daily totals of the previous days.
type OccupancyReport struct {
	Current *Occupancy   `json:"current"`
	Today   []Sample     `json:"today"`
	History []DaySummary `json:"history"`
}

type occupancyAPIResponse struct {
	MajLe        time.Time `json:"majLe"`
	DonneesAJour bool      `json:"donneesAJour"`
	Lieux        []struct {
		Libelle string `json:"libelle"`
		Repas   int    `json:"repas"`
		Jauge   int    `json:"jauge"`
		Restant int    `json:"restant"`
	} `json:"lieux"`
}

// OccupancyClient reads the live attendance from restos.lescrous.fr.
type OccupancyClient struct {
	httpClient *http.Client
	url        string
}

// NewOccupancyClient creates a client; an empty URL selects DefaultOccupancyURL.
func NewOccupancyClient(url string) *OccupancyClient {
	if url == "" {
		url = DefaultOccupancyURL
	}
	return &OccupancyClient{httpClient: &http.Client{Timeout: 15 * time.Second}, url: url}
}

// Fetch returns the current attendance. It fails when the upstream says its
// data is stale, so a frozen screen is never recorded as a fresh reading.
func (c *OccupancyClient) Fetch(ctx context.Context) (Occupancy, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.url, http.NoBody)
	if err != nil {
		return Occupancy{}, fmt.Errorf("failed to create occupancy request: %w", err)
	}
	req.Header.Set("User-Agent", UserAgent)
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return Occupancy{}, fmt.Errorf("failed to call occupancy API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return Occupancy{}, fmt.Errorf("occupancy API returned HTTP %d", resp.StatusCode)
	}

	var apiResp occupancyAPIResponse
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&apiResp); err != nil {
		return Occupancy{}, fmt.Errorf("failed to decode occupancy JSON: %w", err)
	}
	if !apiResp.DonneesAJour {
		return Occupancy{}, errors.New("occupancy data is not up to date")
	}
	if len(apiResp.Lieux) == 0 {
		return Occupancy{}, errors.New("occupancy API returned no location")
	}

	// A screen may cover several places; prefer Briff'O, else the first one.
	idx := 0
	for i, l := range apiResp.Lieux {
		if strings.Contains(strings.ToLower(l.Libelle), "briff") {
			idx = i
			break
		}
	}
	l := apiResp.Lieux[idx]
	return Occupancy{
		Served:    l.Repas,
		Capacity:  l.Jauge,
		Remaining: max(l.Restant, 0),
		UpdatedAt: apiResp.MajLe,
	}, nil
}

// OccupancyStore keeps the samples of the last days, persisted as JSON.
type OccupancyStore struct {
	mu   sync.Mutex
	path string
	loc  *time.Location
	days map[string][]Sample // keyed by YYYY-MM-DD (restaurant local date)
	last *Occupancy
}

// NewOccupancyStore loads (or creates) the store backed by path.
func NewOccupancyStore(path string) *OccupancyStore {
	loc, err := time.LoadLocation("Europe/Paris")
	if err != nil {
		loc = time.UTC
	}
	s := &OccupancyStore{path: path, loc: loc, days: map[string][]Sample{}}
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &s.days) // a corrupt file just starts a new history
	}
	if s.days == nil {
		s.days = map[string][]Sample{}
	}
	return s
}

// Record stores a reading. Readings with no meal served are ignored: they
// are a closed restaurant or a counter that has just reset, not attendance.
func (s *OccupancyStore) Record(o Occupancy) error {
	if o.Served <= 0 || o.Capacity <= 0 {
		return nil
	}
	t := o.UpdatedAt
	if t.IsZero() {
		t = time.Now()
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	cur := o
	s.last = &cur

	key := t.In(s.loc).Format("2006-01-02")
	samples := s.days[key]
	// Same count as the previous reading: nothing new for the curve.
	if n := len(samples); n > 0 && samples[n-1].Served == o.Served && samples[n-1].Capacity == o.Capacity {
		return nil
	}
	if len(samples) < maxSamplesPerDay {
		s.days[key] = append(samples, Sample{Time: t.UTC(), Served: o.Served, Capacity: o.Capacity})
	}
	s.pruneLocked(t)
	return s.saveLocked()
}

func (s *OccupancyStore) pruneLocked(now time.Time) {
	cutoff := now.In(s.loc).AddDate(0, 0, -occupancyHistoryDays).Format("2006-01-02")
	for k := range s.days {
		if k < cutoff {
			delete(s.days, k)
		}
	}
}

func (s *OccupancyStore) saveLocked() error {
	data, err := json.Marshal(s.days)
	if err != nil {
		return fmt.Errorf("failed to encode occupancy history: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
		return fmt.Errorf("failed to create occupancy directory: %w", err)
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return fmt.Errorf("failed to write occupancy history: %w", err)
	}
	if err := os.Rename(tmp, s.path); err != nil {
		return fmt.Errorf("failed to replace occupancy history: %w", err)
	}
	return nil
}

// Report builds the API view at the given instant. The most recent day with
// data is shown as "today" only when it really is today; history lists the
// final tally of every other day, oldest first, limited to the last `days`
// calendar days (0 means no limit).
func (s *OccupancyStore) Report(now time.Time, days int) OccupancyReport {
	s.mu.Lock()
	defer s.mu.Unlock()

	report := OccupancyReport{Today: []Sample{}, History: []DaySummary{}}
	todayKey := now.In(s.loc).Format("2006-01-02")

	if s.last != nil && s.last.UpdatedAt.In(s.loc).Format("2006-01-02") == todayKey {
		cur := *s.last
		report.Current = &cur
	}
	report.Today = append(report.Today, s.days[todayKey]...)

	keys := make([]string, 0, len(s.days))
	for k := range s.days {
		if k != todayKey && len(s.days[k]) > 0 {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)
	if days > 0 {
		cutoff := now.In(s.loc).AddDate(0, 0, -days).Format("2006-01-02")
		keys = keys[sort.SearchStrings(keys, cutoff):]
	}
	for _, k := range keys {
		final := s.days[k][len(s.days[k])-1]
		peak := 0
		for _, sm := range s.days[k] {
			peak = max(peak, sm.Served)
		}
		report.History = append(report.History, DaySummary{Date: k, Served: peak, Capacity: final.Capacity})
	}
	return report
}

// Poller periodically reads the attendance and feeds the store.
type Poller struct {
	client   *OccupancyClient
	store    *OccupancyStore
	logger   *slog.Logger
	interval time.Duration
}

// NewPoller wires a client to a store. The interval applies during service hours.
func NewPoller(client *OccupancyClient, store *OccupancyStore, interval time.Duration, logger *slog.Logger) *Poller {
	if logger == nil {
		logger = slog.Default()
	}
	return &Poller{client: client, store: store, interval: interval, logger: logger}
}

// inServiceWindow reports whether lunch attendance may still be changing.
func (p *Poller) inServiceWindow(now time.Time) bool {
	t := now.In(p.store.loc)
	switch t.Weekday() {
	case time.Saturday, time.Sunday:
		return false
	}
	h := t.Hour()
	return h >= 11 && h < 15
}

func (p *Poller) poll(ctx context.Context) {
	o, err := p.client.Fetch(ctx)
	if err != nil {
		p.logger.Warn("RU occupancy fetch failed", "error", err)
		return
	}
	if err := p.store.Record(o); err != nil {
		p.logger.Warn("RU occupancy could not be stored", "error", err)
	}
}

// Run polls once at startup (so the last known figure is available right
// away), then every interval during service hours, until ctx is canceled.
func (p *Poller) Run(ctx context.Context) {
	p.poll(ctx)

	ticker := time.NewTicker(p.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-ticker.C:
			if p.inServiceWindow(now) {
				p.poll(ctx)
			}
		}
	}
}
