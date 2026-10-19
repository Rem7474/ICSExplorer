package crous

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"
)

const sampleOccupancyJSON = `{"majLe":"2026-10-19T15:36:43+02:00","donneesAJour":true,"lieux":[` +
	`{"libelle":"Restaurant Briff O'","repas":849,"jauge":850,"restant":1,"pourcentageRestant":0,"couleur":"noir","depassement":false}]}`

func TestOccupancyClientFetch(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("User-Agent") != UserAgent {
			t.Errorf("unexpected user agent %q", r.Header.Get("User-Agent"))
		}
		_, _ = w.Write([]byte(sampleOccupancyJSON))
	}))
	defer ts.Close()

	o, err := NewOccupancyClient(ts.URL).Fetch(context.Background())
	if err != nil {
		t.Fatalf("Fetch: %v", err)
	}
	if o.Served != 849 || o.Capacity != 850 || o.Remaining != 1 {
		t.Errorf("unexpected occupancy %+v", o)
	}
	if o.UpdatedAt.IsZero() {
		t.Error("UpdatedAt not parsed")
	}
}

func TestOccupancyClientFetchErrors(t *testing.T) {
	cases := map[string]struct {
		status int
		body   string
	}{
		"http error": {http.StatusInternalServerError, ""},
		"stale":      {http.StatusOK, `{"donneesAJour":false,"lieux":[{"repas":1,"jauge":2,"restant":1}]}`},
		"no place":   {http.StatusOK, `{"donneesAJour":true,"lieux":[]}`},
		"bad json":   {http.StatusOK, `nope`},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(tc.status)
				_, _ = w.Write([]byte(tc.body))
			}))
			defer ts.Close()
			if _, err := NewOccupancyClient(ts.URL).Fetch(context.Background()); err == nil {
				t.Error("expected an error")
			}
		})
	}
}

func TestOccupancyStoreReport(t *testing.T) {
	path := filepath.Join(t.TempDir(), "ru.json")
	store := NewOccupancyStore(path)
	paris := store.loc
	day := func(d, h, m int) time.Time { return time.Date(2026, 10, d, h, m, 0, 0, paris) }

	for _, o := range []Occupancy{
		{Served: 100, Capacity: 850, UpdatedAt: day(16, 12, 0)},
		{Served: 700, Capacity: 850, UpdatedAt: day(16, 13, 0)},
		{Served: 0, Capacity: 850, UpdatedAt: day(17, 0, 5)}, // reset: ignored
		{Served: 200, Capacity: 850, UpdatedAt: day(19, 12, 0)},
		{Served: 200, Capacity: 850, UpdatedAt: day(19, 12, 5)}, // unchanged: not duplicated
		{Served: 500, Capacity: 850, UpdatedAt: day(19, 12, 30)},
	} {
		if err := store.Record(o); err != nil {
			t.Fatalf("Record: %v", err)
		}
	}

	r := store.Report(day(19, 14, 0), 30)
	if r.Current == nil || r.Current.Served != 500 {
		t.Fatalf("unexpected current %+v", r.Current)
	}
	if len(r.Today) != 2 {
		t.Errorf("expected 2 samples today, got %d", len(r.Today))
	}
	if len(r.History) != 1 || r.History[0].Date != "2026-10-16" || r.History[0].Served != 700 {
		t.Errorf("unexpected history %+v", r.History)
	}

	// A later day: the last reading is no longer "current".
	r = store.Report(day(20, 9, 0), 30)
	if r.Current != nil || len(r.Today) != 0 || len(r.History) != 2 {
		t.Errorf("unexpected next-day report %+v", r)
	}

	// Persisted and reloaded.
	reloaded := NewOccupancyStore(path).Report(day(20, 9, 0), 2) // window: Oct 18 onwards
	if len(reloaded.History) != 1 || reloaded.History[0].Date != "2026-10-19" || reloaded.History[0].Served != 500 {
		t.Errorf("unexpected reloaded history %+v", reloaded.History)
	}
}

func TestOccupancyStorePrunesOldDays(t *testing.T) {
	store := NewOccupancyStore(filepath.Join(t.TempDir(), "ru.json"))
	old := time.Date(2026, 1, 5, 12, 0, 0, 0, store.loc)
	now := old.AddDate(0, 0, occupancyHistoryDays+5)
	_ = store.Record(Occupancy{Served: 10, Capacity: 850, UpdatedAt: old})
	_ = store.Record(Occupancy{Served: 20, Capacity: 850, UpdatedAt: now})

	if got := len(store.Report(now.AddDate(0, 0, 1), 0).History); got != 1 {
		t.Errorf("expected only the recent day to remain, got %d days", got)
	}
}

func TestPollerServiceWindow(t *testing.T) {
	p := NewPoller(NewOccupancyClient(""), NewOccupancyStore(filepath.Join(t.TempDir(), "x.json")), time.Minute, nil)
	paris := p.store.loc
	at := func(d, h int) time.Time { return time.Date(2026, 10, d, h, 0, 0, 0, paris) }

	if !p.inServiceWindow(at(19, 12)) { // Monday noon
		t.Error("Monday noon should be in the service window")
	}
	if p.inServiceWindow(at(19, 20)) {
		t.Error("Monday evening should be outside")
	}
	if p.inServiceWindow(at(17, 12)) { // Saturday
		t.Error("Saturday should be outside")
	}
}
