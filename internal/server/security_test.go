package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Rem7474/ICSExplorer/internal/netsafe"
)

func newTestHandler(t *testing.T, srv *Server) http.Handler {
	t.Helper()
	mux := http.NewServeMux()
	srv.registerRoutes(mux)
	return srv.applyMiddlewares(mux)
}

func postJSON(t *testing.T, handler http.Handler, path string, payload any) *httptest.ResponseRecorder {
	t.Helper()
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	return w
}

// TestPersonalCalendarRejectsInternalTargets checks that, under the strict
// production policy, a pasted adeUrl cannot make the server reach internal
// addresses (SSRF), and that no upstream request is ever sent.
func TestPersonalCalendarRejectsInternalTargets(t *testing.T) {
	var hits atomic.Int32
	internal := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		hits.Add(1)
		_, _ = w.Write([]byte("BEGIN:VCALENDAR\r\nSUMMARY:internal secret\r\nEND:VCALENDAR"))
	}))
	defer internal.Close()

	srv, _, _ := setupTestServer(t)
	srv.upstreamPolicy = netsafe.Policy{} // strict production policy
	handler := newTestHandler(t, srv)

	urls := []string{
		internal.URL + "/2026-2027/etudiant/test?resources=42",             // plain http on loopback
		"https://127.0.0.1/2026-2027/etudiant/test",                        // loopback literal
		"https://169.254.169.254/2026-2027/etudiant/test",                  // cloud metadata
		"https://[::1]/direct/index.jsp?data=abc",                          // IPv6 loopback
		"https://10.0.0.1:8443/2026-2027/etudiant/test",                    // private + odd port
		"https://localhost/jsp/custom/modules/plannings/direct.jsp?data=x", // resolves to loopback at dial time
	}
	for _, u := range urls {
		for _, path := range []string{"/api/personal-calendar", "/api/tree"} {
			w := postJSON(t, handler, path, map[string]string{"adeUrl": u})
			if w.Code != http.StatusBadRequest {
				t.Errorf("%s with %s: expected 400, got %d (%s)", path, u, w.Code, w.Body.String())
			}
			if strings.Contains(w.Body.String(), "internal secret") {
				t.Fatalf("%s with %s leaked the internal response", path, u)
			}
		}
	}
	if n := hits.Load(); n != 0 {
		t.Errorf("expected no request to reach the internal server, got %d", n)
	}
}

func TestPersonalEndpointsInputValidation(t *testing.T) {
	srv, _, _ := setupTestServer(t)
	withMockUniversityDirectory(t, srv)
	handler := newTestHandler(t, srv)

	t.Run("non-JSON content type is rejected", func(t *testing.T) {
		for _, path := range []string{"/api/personal-calendar", "/api/tree"} {
			req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(`{"universityId":"test-test"}`))
			req.Header.Set("Content-Type", "text/plain")
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)
			if w.Code != http.StatusUnsupportedMediaType {
				t.Errorf("%s: expected 415, got %d", path, w.Code)
			}
		}
	})

	t.Run("overlong branchPath is rejected", func(t *testing.T) {
		long := make([]string, maxBranchPathLen+1)
		for i := range long {
			long[i] = "1"
		}
		w := postJSON(t, handler, "/api/tree", map[string]any{
			"universityId": "test-test", "login": "student", "password": "secret", "branchPath": long,
		})
		if w.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", w.Code)
		}
	})

	t.Run("query-injecting IDs are rejected", func(t *testing.T) {
		w := postJSON(t, handler, "/api/personal-calendar", map[string]any{
			"universityId": "test-test", "login": "student", "password": "secret", "resourceId": "42&projectId=9",
		})
		if w.Code != http.StatusBadRequest {
			t.Errorf("resourceId: expected 400, got %d", w.Code)
		}
		w = postJSON(t, handler, "/api/tree", map[string]any{
			"universityId": "test-test", "login": "student", "password": "secret", "branchPath": []string{"1&x=2"},
		})
		if w.Code != http.StatusBadRequest {
			t.Errorf("branchPath: expected 400, got %d", w.Code)
		}
	})
}

func TestSyncEndpointHardening(t *testing.T) {
	t.Run("disabled when no ADMIN_TOKEN is configured", func(t *testing.T) {
		srv, cfg, _ := setupTestServer(t)
		cfg.AdminToken = ""
		handler := newTestHandler(t, srv)

		req := httptest.NewRequest(http.MethodPost, "/api/sync", http.NoBody)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusForbidden {
			t.Errorf("expected 403, got %d", w.Code)
		}
		if srv.syncer.GetStats().IsSyncing {
			t.Error("sync must not start without ADMIN_TOKEN")
		}
	})

	t.Run("wrong token and cooldown", func(t *testing.T) {
		srv, _, _ := setupTestServer(t)
		handler := newTestHandler(t, srv)

		send := func(auth string) int {
			req := httptest.NewRequest(http.MethodPost, "/api/sync", http.NoBody)
			if auth != "" {
				req.Header.Set("Authorization", auth)
			}
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)
			return w.Code
		}

		if code := send("Bearer secret-tokenX"); code != http.StatusUnauthorized {
			t.Errorf("wrong token: expected 401, got %d", code)
		}
		if code := send("secret-token"); code != http.StatusUnauthorized {
			t.Errorf("missing Bearer prefix: expected 401, got %d", code)
		}
		if code := send("Bearer secret-token"); code != http.StatusAccepted {
			t.Fatalf("valid token: expected 202, got %d", code)
		}

		// Wait for the background sync to finish, then retry within the cooldown.
		deadline := time.Now().Add(2 * time.Second)
		for time.Now().Before(deadline) && (srv.syncer.GetStats().IsSyncing || srv.syncer.GetStats().LastSyncTime == nil) {
			time.Sleep(5 * time.Millisecond)
		}
		if code := send("Bearer secret-token"); code != http.StatusTooManyRequests {
			t.Errorf("second sync within cooldown: expected 429, got %d", code)
		}
	})
}

func TestSecurityHeadersAndCORS(t *testing.T) {
	srv, _, _ := setupTestServer(t)
	handler := newTestHandler(t, srv)

	get := func(path string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, path, http.NoBody)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		return w
	}

	root := get("/")
	if csp := root.Header().Get("Content-Security-Policy"); !strings.Contains(csp, "default-src 'self'") || !strings.Contains(csp, "frame-ancestors 'self'") {
		t.Errorf("unexpected CSP: %q", csp)
	}
	if root.Header().Get("Strict-Transport-Security") != "" {
		t.Error("HSTS must not be sent over plain HTTP")
	}

	if got := get("/output/1A-Test.ics").Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Errorf("public ICS feeds should allow cross-origin reads, got %q", got)
	}
	if got := get("/api/status").Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("/api/status must not send CORS headers, got %q", got)
	}

	preflight := httptest.NewRequest(http.MethodOptions, "/api/personal-calendar", http.NoBody)
	preflight.Header.Set("Origin", "https://evil.example")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, preflight)
	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("credential endpoints must not allow cross-origin calls, got %q", got)
	}
}

func TestClientIPAndHTTPSBehindTrustedProxy(t *testing.T) {
	srv, cfg, _ := setupTestServer(t)

	newReq := func(remote, xff, proto string) *http.Request {
		req := httptest.NewRequest(http.MethodGet, "/", http.NoBody)
		req.RemoteAddr = remote
		if xff != "" {
			req.Header.Set("X-Forwarded-For", xff)
		}
		if proto != "" {
			req.Header.Set("X-Forwarded-Proto", proto)
		}
		return req
	}

	// Without trusted proxies, forwarded headers are ignored.
	if ip := srv.clientIP(newReq("198.51.100.7:1234", "1.2.3.4", "https")); ip != "198.51.100.7" {
		t.Errorf("untrusted peer: expected peer IP, got %s", ip)
	}
	if srv.isHTTPS(newReq("198.51.100.7:1234", "", "https")) {
		t.Error("untrusted peer must not be able to claim HTTPS")
	}

	cfg.TrustedProxies = []netip.Prefix{netip.MustParsePrefix("172.16.0.0/12")}
	// The spoofed left-most entry is ignored: the right-most untrusted hop wins.
	if ip := srv.clientIP(newReq("172.18.0.2:1234", "6.6.6.6, 203.0.113.9, 172.18.0.3", "")); ip != "203.0.113.9" {
		t.Errorf("trusted proxy: expected 203.0.113.9, got %s", ip)
	}
	if !srv.isHTTPS(newReq("172.18.0.2:1234", "", "https")) {
		t.Error("trusted proxy reporting https should be honored")
	}
}

func TestRateLimiterSweepsIdleIPs(t *testing.T) {
	l := newIPRateLimiter(2, 20*time.Millisecond)
	for i := 0; i < 50; i++ {
		l.Allow(netip.AddrFrom4([4]byte{203, 0, 113, byte(i)}).String())
	}
	if l.size() != 50 {
		t.Fatalf("expected 50 tracked IPs, got %d", l.size())
	}
	time.Sleep(30 * time.Millisecond)
	l.Allow("198.51.100.1")
	if l.size() != 1 {
		t.Errorf("expected idle IPs to be swept, %d still tracked", l.size())
	}
}
