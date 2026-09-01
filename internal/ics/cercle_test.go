package ics

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestMergeCercleEvents(t *testing.T) {
	studentICS := []byte("BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:123\r\nSUMMARY:Maths\r\nEND:VEVENT\r\nEND:VCALENDAR")
	cercleICS := []byte("BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:456\r\nSUMMARY:Soiree Cercle\r\nEND:VEVENT\r\nEND:VCALENDAR")

	merged, err := MergeCercleEvents(studentICS, cercleICS)
	if err != nil {
		t.Fatalf("MergeCercleEvents unexpected error: %v", err)
	}

	mergedStr := string(merged)
	if !strings.Contains(mergedStr, "UID:123") {
		t.Errorf("merged calendar missing original event UID:123")
	}
	if !strings.Contains(mergedStr, "UID:456") {
		t.Errorf("merged calendar missing Cercle event UID:456")
	}
	if !strings.Contains(mergedStr, "SUMMARY:Soiree Cercle") {
		t.Errorf("merged calendar missing Cercle summary")
	}

	// Test deduplication
	mergedTwice, err := MergeCercleEvents(merged, cercleICS)
	if err != nil {
		t.Fatalf("MergeCercleEvents twice unexpected error: %v", err)
	}
	count456 := strings.Count(string(mergedTwice), "UID:456")
	if count456 != 1 {
		t.Errorf("expected UID:456 once after double merge, found %d times", count456)
	}
}

func TestFetchCercleCalendar(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:cercle-1\r\nSUMMARY:Foyer\r\nEND:VEVENT\r\nEND:VCALENDAR")
	}))
	defer mockServer.Close()

	data, err := FetchCercleCalendar(context.Background(), mockServer.URL)
	if err != nil {
		t.Fatalf("FetchCercleCalendar failed: %v", err)
	}
	if !strings.Contains(string(data), "UID:cercle-1") {
		t.Errorf("expected to fetch cercle event, got: %s", string(data))
	}
}
