package ade

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClientFetchCalendarRaw(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, pass, ok := r.BasicAuth()
		if !ok || user != "testuser" || pass != "testpass" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		if r.URL.Path == "/directCal/2026-2027/etudiant/esisar" {
			resource := r.URL.Query().Get("resources")
			if resource == "1234" {
				w.WriteHeader(http.StatusOK)
				fmt.Fprint(w, "BEGIN:VCALENDAR\r\nSUMMARY:Test\r\nEND:VCALENDAR")
				return
			}
		}

		w.WriteHeader(http.StatusNotFound)
	}))
	defer mockServer.Close()

	client := NewClient("testuser", "testpass", "2026-2027")
	client.SetBaseURL(mockServer.URL)

	ctx := context.Background()

	// Successful fetch
	data, err := client.FetchCalendarRaw(ctx, "1234")
	if err != nil {
		t.Fatalf("expected success, got: %v", err)
	}
	if string(data) != "BEGIN:VCALENDAR\r\nSUMMARY:Test\r\nEND:VCALENDAR" {
		t.Errorf("unexpected calendar body: %s", string(data))
	}

	// Unauthorized fetch
	unauthClient := NewClient("baduser", "badpass", "2026-2027")
	unauthClient.SetBaseURL(mockServer.URL)
	_, err = unauthClient.FetchCalendarRaw(ctx, "1234")
	if err == nil {
		t.Fatalf("expected 401 error, got nil")
	}

	// 404 Not Found fetch
	_, err = client.FetchCalendarRaw(ctx, "9999")
	if err == nil {
		t.Fatalf("expected 404 error, got nil")
	}
}

func TestCrawlerDiscoverResources(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		w.WriteHeader(http.StatusOK)

		if r.URL.RawQuery == "" {
			// Final expanded tree page with all leaf links
			fmt.Fprint(w, `
				<html><body>
					<div class="treeline"><span><a href="javascript:selectResource('1001')">1A-Prépa-TP1</a></span></div>
					<div class="treeline"><span><a href="javascript:selectResource('2001')">3A-IR-IR1</a></span></div>
				</body></html>
			`)
		} else {
			// Initial / branch pages with branch onclick triggers
			fmt.Fprint(w, `
				<html><body>
					<span class="treebranch"><a href="javascript:checkBranch('100')">1A</a></span>
					<span class="treebranch"><a href="javascript:checkBranch('200')">3A</a></span>
				</body></html>
			`)
		}
	}))
	defer mockServer.Close()

	client := NewClient("testuser", "testpass", "2026-2027")
	client.SetBaseURL(mockServer.URL)

	crawler := NewCrawler(client, "2026-2027")
	resources, err := crawler.DiscoverResources(context.Background())
	if err != nil {
		t.Fatalf("DiscoverResources failed: %v", err)
	}

	if len(resources) != 2 {
		t.Fatalf("expected 2 discovered resources, got %d", len(resources))
	}

	found1A := false
	found3A := false
	for _, res := range resources {
		if res.ID == "1001" {
			found1A = true
		}
		if res.ID == "2001" {
			found3A = true
		}
	}

	if !found1A || !found3A {
		t.Errorf("expected to find resources 1001 and 2001, got %+v", resources)
	}
}
