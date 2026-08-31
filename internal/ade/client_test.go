package ade

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestClientFetchCalendarRaw(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, pass, ok := r.BasicAuth()
		if !ok || user != "testuser" || pass != "testpass" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		if r.URL.Path == "/2026-2027/etudiant/esisar" {
			w.WriteHeader(http.StatusOK)
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

func TestClientForInstitutionFetchesOwnCalendarWithoutResourceID(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, pass, ok := r.BasicAuth()
		if !ok || user != "student" || pass != "secret" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		if r.URL.Path == "/2026-2027/etudiant/otherschool" {
			w.WriteHeader(http.StatusOK)
			return
		}

		if r.URL.Path != "/directCal/2026-2027/etudiant/otherschool" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		if r.URL.Query().Get("resources") != "" {
			t.Errorf("expected empty 'resources' query param, got %q", r.URL.Query().Get("resources"))
		}

		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "BEGIN:VCALENDAR\r\nSUMMARY:Perso\r\nEND:VCALENDAR")
	}))
	defer mockServer.Close()

	client := NewClientForInstitution("student", "secret", "2026-2027", mockServer.URL, "etudiant/otherschool")

	data, err := client.FetchCalendarRaw(context.Background(), "")
	if err != nil {
		t.Fatalf("expected success, got: %v", err)
	}
	if string(data) != "BEGIN:VCALENDAR\r\nSUMMARY:Perso\r\nEND:VCALENDAR" {
		t.Errorf("unexpected calendar body: %s", string(data))
	}
}

func TestClientFetchDirectTokenCalendar(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/jsp/custom/modules/plannings/direct_planning.jsp" {
			if r.URL.Query().Get("data") == "testtoken123" {
				w.WriteHeader(http.StatusOK)
				return
			}
		}
		if r.URL.Path == "/jsp/custom/modules/plannings/anonymous_cal.jsp" {
			res := r.URL.Query().Get("resources")
			projID := r.URL.Query().Get("projectId")
			if res == "leaf456" && projID == "2" {
				w.WriteHeader(http.StatusOK)
				fmt.Fprint(w, "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Course 1\r\nEND:VEVENT\r\nEND:VCALENDAR")
				return
			}
			if res == "101,102" && projID == "2" {
				w.WriteHeader(http.StatusOK)
				fmt.Fprint(w, "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Branch Course\r\nEND:VEVENT\r\nEND:VCALENDAR")
				return
			}
			if projID == "2" {
				w.WriteHeader(http.StatusOK)
				fmt.Fprint(w, "BEGIN:VCALENDAR\r\nSUMMARY:Direct Default\r\nEND:VCALENDAR")
				return
			}
			// Other project IDs return empty calendar (0 events)
			w.WriteHeader(http.StatusOK)
			fmt.Fprint(w, "BEGIN:VCALENDAR\r\nEND:VCALENDAR")
			return
		}
		if r.URL.Path == "/jsp/standard/gui/tree.jsp" {
			w.WriteHeader(http.StatusOK)
			branchID := r.URL.Query().Get("branchId")
			if branchID == "branch999" {
				// Return a branch containing two leaf elements 101 and 102
				fmt.Fprint(w, `
					<html><body>
						<DIV class="treeline">&nbsp;&nbsp;&nbsp;<span><a href="javascript:check('101')">Leaf 1</a></span></DIV>
						<DIV class="treeline">&nbsp;&nbsp;&nbsp;<span><a href="javascript:check('102')">Leaf 2</a></span></DIV>
					</body></html>
				`)
			} else {
				// Leaf has no children
				fmt.Fprint(w, `<html><body></body></html>`)
			}
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer mockServer.Close()

	client := NewClientForInstitution("", "", "2026-2027", mockServer.URL, "direct?data=testtoken123")

	t.Run("default export with fallback project ID", func(t *testing.T) {
		data, err := client.FetchDirectTokenCalendar(context.Background(), "testtoken123", "", nil)
		if err != nil {
			t.Fatalf("expected success, got: %v", err)
		}
		if !strings.Contains(string(data), "BEGIN:VCALENDAR") {
			t.Errorf("unexpected calendar body: %s", string(data))
		}
	})

	t.Run("single leaf resource ID", func(t *testing.T) {
		data, err := client.FetchDirectTokenCalendar(context.Background(), "testtoken123", "leaf456", nil)
		if err != nil {
			t.Fatalf("expected success, got: %v", err)
		}
		if !strings.Contains(string(data), "SUMMARY:Course 1") {
			t.Errorf("expected Course 1, got: %s", string(data))
		}
	})

	t.Run("branch resource ID expands to child leaves", func(t *testing.T) {
		data, err := client.FetchDirectTokenCalendar(context.Background(), "testtoken123", "branch999", []string{"branch999"})
		if err != nil {
			t.Fatalf("expected success, got: %v", err)
		}
		if !strings.Contains(string(data), "SUMMARY:Branch Course") {
			t.Errorf("expected Branch Course, got: %s", string(data))
		}
	})
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
