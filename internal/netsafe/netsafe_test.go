package netsafe

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"net/url"
	"testing"
	"time"
)

func TestIsPublicAddr(t *testing.T) {
	cases := map[string]bool{
		"8.8.8.8":          true,
		"152.77.1.1":       true,
		"2a00:1450::1":     true,
		"127.0.0.1":        false,
		"10.1.2.3":         false,
		"172.20.0.5":       false,
		"192.168.1.1":      false,
		"169.254.169.254":  false,
		"100.64.0.1":       false,
		"0.0.0.0":          false,
		"255.255.255.255":  false,
		"::1":              false,
		"fe80::1":          false,
		"fd00::1":          false,
		"::ffff:127.0.0.1": false,
		"64:ff9b::a00:1":   false,
	}
	for s, want := range cases {
		if got := IsPublicAddr(netip.MustParseAddr(s)); got != want {
			t.Errorf("IsPublicAddr(%s) = %v, want %v", s, got, want)
		}
	}
}

func TestValidateURL(t *testing.T) {
	strict := Policy{}
	ok := []string{
		"https://edt.univ-example.fr/2026-2027/etudiant/x",
		"https://edt.univ-example.fr:443/direct/index.jsp?data=abc",
	}
	for _, raw := range ok {
		u, _ := url.Parse(raw)
		if err := strict.ValidateURL(u); err != nil {
			t.Errorf("expected %s to be accepted, got %v", raw, err)
		}
	}

	blocked := []string{
		"http://edt.univ-example.fr/x",
		"https://edt.univ-example.fr:8080/x",
		"https://127.0.0.1/x",
		"https://[::1]/x",
		"https://169.254.169.254/latest/meta-data",
		"https://user:pass@edt.univ-example.fr/x",
		"file:///etc/passwd",
		"gopher://edt.univ-example.fr/x",
	}
	for _, raw := range blocked {
		u, _ := url.Parse(raw)
		if err := strict.ValidateURL(u); !errors.Is(err, ErrBlockedDestination) {
			t.Errorf("expected %s to be blocked, got %v", raw, err)
		}
	}
}

func TestClientRefusesLoopbackAtDialTime(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("internal secret"))
	}))
	defer ts.Close()

	// AllowHTTP lets the URL through validation so we exercise the dial-time guard.
	client := Policy{AllowHTTP: true}.Client(5*time.Second, nil)
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, ts.URL, http.NoBody)
	resp, err := client.Do(req)
	if err == nil {
		resp.Body.Close()
		t.Fatal("expected loopback dial to be refused")
	}
	if !errors.Is(err, ErrBlockedDestination) {
		t.Errorf("expected ErrBlockedDestination, got %v", err)
	}
}

func TestClientRevalidatesRedirects(t *testing.T) {
	internal := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("internal secret"))
	}))
	defer internal.Close()

	redirector := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "https://169.254.169.254/latest/meta-data", http.StatusFound)
	}))
	defer redirector.Close()

	// The first hop is allowed (test policy), but the redirect target must be
	// rejected by CheckRedirect under the strict URL rules.
	client := Policy{AllowPrivate: true, AllowHTTP: true}.Client(5*time.Second, nil)
	client.CheckRedirect = func(req *http.Request, _ []*http.Request) error {
		return Policy{}.ValidateURL(req.URL)
	}
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, redirector.URL, http.NoBody)
	resp, err := client.Do(req)
	if err == nil {
		resp.Body.Close()
		t.Fatal("expected redirect to a metadata IP to be refused")
	}
	if !errors.Is(err, ErrBlockedDestination) {
		t.Errorf("expected ErrBlockedDestination, got %v", err)
	}
}
