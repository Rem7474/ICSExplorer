package server

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Rem7474/ICSExplorer/internal/university"
)

func setupMockADEServer(t *testing.T) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, pass, ok := r.BasicAuth()
		if !ok || user != "student" || pass != "secret" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if strings.HasPrefix(r.URL.Path, "/directCal") {
			if !r.URL.Query().Has("resources") {
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("BEGIN:VCALENDAR\r\nSUMMARY:Perso\r\nEND:VCALENDAR"))
			return
		}
		if strings.HasSuffix(r.URL.Path, "etudiant/test") {
			w.WriteHeader(http.StatusOK)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
}

func setupMockAnonymousADEServer(t *testing.T) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, _, ok := r.BasicAuth(); ok {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("BEGIN:VCALENDAR\r\nSUMMARY:Perso sans identifiants\r\nEND:VCALENDAR"))
	}))
}

func setupMockPortal(t *testing.T, adeBaseURL string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		fmt.Fprintf(w, `<a href="%s/2026-2027/etudiant/test">Etudiants Test 2026-2027</a>`, adeBaseURL)
	}))
}

// withMockUniversityDirectory points srv at a Directory backed by a mock ADE
// portal + server, so tests never hit the real Grenoble INP deployment.
func withMockUniversityDirectory(t *testing.T, srv *Server) (mockADE *httptest.Server) {
	t.Helper()
	mockADE = setupMockADEServer(t)
	t.Cleanup(mockADE.Close)

	portal := setupMockPortal(t, mockADE.URL)
	t.Cleanup(portal.Close)

	srv.universityDirectory = university.NewDirectory(
		[]university.Deployment{{Slug: "test", RootURL: portal.URL, BaseURL: mockADE.URL}},
		time.Hour,
	)
	return mockADE
}

func TestHandleUniversitiesList(t *testing.T) {
	srv, _, _ := setupTestServer(t)
	mockADE := withMockUniversityDirectory(t, srv)

	mux := http.NewServeMux()
	srv.registerRoutes(mux)
	handler := srv.applyMiddlewares(mux)

	req := httptest.NewRequest(http.MethodGet, "/api/universities", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", w.Code)
	}

	var list []university.University
	if err := json.Unmarshal(w.Body.Bytes(), &list); err != nil {
		t.Fatalf("failed to parse universities list: %v", err)
	}
	if len(list) != 1 || list[0].ID != "test-test" {
		t.Fatalf("unexpected universities list: %+v", list)
	}

	if strings.Contains(w.Body.String(), mockADE.URL) {
		t.Errorf("response should not expose internal ADE base URLs: %s", w.Body.String())
	}
}

// newPersonalCalendarHandler builds a fresh server (and thus a fresh rate
// limiter) so each subtest's request budget doesn't interfere with the others.
func newPersonalCalendarHandler(t *testing.T) http.Handler {
	t.Helper()
	srv, _, _ := setupTestServer(t)
	withMockUniversityDirectory(t, srv)

	mux := http.NewServeMux()
	srv.registerRoutes(mux)
	return srv.applyMiddlewares(mux)
}

func TestHandlePersonalCalendar(t *testing.T) {
	t.Run("method not allowed", func(t *testing.T) {
		handler := newPersonalCalendarHandler(t)
		req := httptest.NewRequest(http.MethodGet, "/api/personal-calendar", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusMethodNotAllowed {
			t.Errorf("expected 405, got %d", w.Code)
		}
	})

	t.Run("missing fields", func(t *testing.T) {
		handler := newPersonalCalendarHandler(t)
		body, _ := json.Marshal(map[string]string{"universityId": "test-test"})
		req := httptest.NewRequest(http.MethodPost, "/api/personal-calendar", bytes.NewReader(body))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", w.Code)
		}
	})

	t.Run("unknown university", func(t *testing.T) {
		handler := newPersonalCalendarHandler(t)
		body, _ := json.Marshal(map[string]string{"universityId": "nope", "login": "a", "password": "b"})
		req := httptest.NewRequest(http.MethodPost, "/api/personal-calendar", bytes.NewReader(body))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", w.Code)
		}
	})

	t.Run("invalid credentials returns 401 and does not leak them", func(t *testing.T) {
		handler := newPersonalCalendarHandler(t)
		body, _ := json.Marshal(map[string]string{"universityId": "test-test", "login": "student", "password": "wrong"})
		req := httptest.NewRequest(http.MethodPost, "/api/personal-calendar", bytes.NewReader(body))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d. Body: %s", w.Code, w.Body.String())
		}
		if strings.Contains(w.Body.String(), "wrong") {
			t.Errorf("response must not echo back the submitted password: %s", w.Body.String())
		}
	})

	t.Run("valid credentials with a resourceId return the ICS calendar", func(t *testing.T) {
		handler := newPersonalCalendarHandler(t)
		body, _ := json.Marshal(map[string]string{"universityId": "test-test", "login": "student", "password": "secret", "resourceId": "42"})
		req := httptest.NewRequest(http.MethodPost, "/api/personal-calendar", bytes.NewReader(body))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d. Body: %s", w.Code, w.Body.String())
		}
		if ct := w.Header().Get("Content-Type"); ct != "text/calendar; charset=utf-8" {
			t.Errorf("unexpected Content-Type: %s", ct)
		}
		if !strings.Contains(w.Body.String(), "SUMMARY:Perso") {
			t.Errorf("expected calendar body to contain the mock event, got: %s", w.Body.String())
		}
	})

	t.Run("valid credentials without a resourceId succeed using default resources", func(t *testing.T) {
		handler := newPersonalCalendarHandler(t)
		body, _ := json.Marshal(map[string]string{"universityId": "test-test", "login": "student", "password": "secret"})
		req := httptest.NewRequest(http.MethodPost, "/api/personal-calendar", bytes.NewReader(body))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d. Body: %s", w.Code, w.Body.String())
		}
		if !strings.Contains(w.Body.String(), "SUMMARY:Perso") {
			t.Errorf("expected calendar body to contain the mock event, got: %s", w.Body.String())
		}
	})

	t.Run("adeUrl with an embedded resource ID bypasses the registry and is parsed directly", func(t *testing.T) {
		handler := newPersonalCalendarHandler(t)
		mockADE := setupMockADEServer(t)
		defer mockADE.Close()

		body, _ := json.Marshal(map[string]string{
			"adeUrl":   mockADE.URL + "/2026-2027/etudiant/test?resources=42",
			"login":    "student",
			"password": "secret",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/personal-calendar", bytes.NewReader(body))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d. Body: %s", w.Code, w.Body.String())
		}
		if !strings.Contains(w.Body.String(), "SUMMARY:Perso") {
			t.Errorf("expected calendar body to contain the mock event, got: %s", w.Body.String())
		}
	})

	t.Run("adeUrl with direct data token works without credentials", func(t *testing.T) {
		mockDirectServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/jsp/custom/modules/plannings/direct_planning.jsp" {
				w.WriteHeader(http.StatusOK)
				return
			}
			if r.URL.Path == "/jsp/custom/modules/plannings/anonymous_cal.jsp" {
				w.WriteHeader(http.StatusOK)
				w.Write([]byte("BEGIN:VCALENDAR\r\nSUMMARY:Direct Token\r\nEND:VCALENDAR"))
				return
			}
			w.WriteHeader(http.StatusNotFound)
		}))
		defer mockDirectServer.Close()

		handler := newPersonalCalendarHandler(t)
		body, _ := json.Marshal(map[string]string{
			"adeUrl": mockDirectServer.URL + "/direct/index.jsp?data=secretToken123,1",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/personal-calendar", bytes.NewReader(body))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d. Body: %s", w.Code, w.Body.String())
		}
		if !strings.Contains(w.Body.String(), "SUMMARY:Direct Token") {
			t.Errorf("expected calendar body to contain the direct token event, got: %s", w.Body.String())
		}
	})

	t.Run("adeUrl without credentials works against a self-authenticating link", func(t *testing.T) {
		handler := newPersonalCalendarHandler(t)
		mockADE := setupMockAnonymousADEServer(t)
		defer mockADE.Close()

		body, _ := json.Marshal(map[string]string{
			"adeUrl": mockADE.URL + "/2026-2027/etudiant/test",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/personal-calendar", bytes.NewReader(body))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d. Body: %s", w.Code, w.Body.String())
		}
		if !strings.Contains(w.Body.String(), "Perso sans identifiants") {
			t.Errorf("expected calendar body to contain the mock event, got: %s", w.Body.String())
		}
	})

	t.Run("unparseable adeUrl returns 400", func(t *testing.T) {
		handler := newPersonalCalendarHandler(t)
		body, _ := json.Marshal(map[string]string{
			"adeUrl":   "https://example.org/not-an-ade-url",
			"login":    "student",
			"password": "secret",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/personal-calendar", bytes.NewReader(body))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d. Body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("rate limit kicks in after repeated requests", func(t *testing.T) {
		srv2, _, _ := setupTestServer(t)
		withMockUniversityDirectory(t, srv2)
		mux2 := http.NewServeMux()
		srv2.registerRoutes(mux2)
		handler2 := srv2.applyMiddlewares(mux2)

		body, _ := json.Marshal(map[string]string{"universityId": "test-test", "login": "student", "password": "wrong"})
		var lastCode int
		for i := 0; i < 10; i++ {
			req := httptest.NewRequest(http.MethodPost, "/api/personal-calendar", bytes.NewReader(body))
			req.RemoteAddr = "203.0.113.5:12345"
			w := httptest.NewRecorder()
			handler2.ServeHTTP(w, req)
			lastCode = w.Code
		}
		if lastCode != http.StatusTooManyRequests {
			t.Errorf("expected the last request to be rate-limited (429), got %d", lastCode)
		}
	})
}
