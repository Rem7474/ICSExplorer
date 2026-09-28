// Package netsafe builds outbound HTTP clients that refuse to reach internal
// network destinations. It is used for every request whose target host is
// supplied by an end user (e.g. a pasted ADE URL), so the server cannot be
// turned into a proxy towards loopback, private networks or cloud metadata
// endpoints (SSRF).
package netsafe

import (
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strings"
	"syscall"
	"time"
)

// ErrBlockedDestination is returned when a URL or resolved address targets a
// destination that the active Policy does not allow.
var ErrBlockedDestination = errors.New("destination not allowed")

// maxRedirects bounds how many redirects a safe client follows.
const maxRedirects = 5

// Policy describes which upstream destinations are acceptable.
// The zero value is the strict production policy: HTTPS on the default port
// only, public unicast addresses only.
type Policy struct {
	// AllowPrivate permits loopback/private/link-local destinations.
	// Only meant for tests against httptest servers.
	AllowPrivate bool
	// AllowHTTP permits plain-HTTP URLs and non-default ports.
	// Only meant for tests against httptest servers.
	AllowHTTP bool
}

// extraBlocked lists special-purpose ranges not covered by netip helpers.
var extraBlocked = []netip.Prefix{
	netip.MustParsePrefix("0.0.0.0/8"),       // "this" network
	netip.MustParsePrefix("100.64.0.0/10"),   // carrier-grade NAT
	netip.MustParsePrefix("192.0.0.0/24"),    // IETF protocol assignments
	netip.MustParsePrefix("192.0.2.0/24"),    // TEST-NET-1
	netip.MustParsePrefix("198.18.0.0/15"),   // benchmarking
	netip.MustParsePrefix("198.51.100.0/24"), // TEST-NET-2
	netip.MustParsePrefix("203.0.113.0/24"),  // TEST-NET-3
	netip.MustParsePrefix("240.0.0.0/4"),     // reserved + broadcast
	netip.MustParsePrefix("64:ff9b::/96"),    // NAT64 (can map to internal IPv4)
	netip.MustParsePrefix("64:ff9b:1::/48"),  // local-use NAT64
	netip.MustParsePrefix("2001:db8::/32"),   // documentation
}

// IsPublicAddr reports whether addr is a globally routable unicast address.
func IsPublicAddr(addr netip.Addr) bool {
	addr = addr.Unmap()
	if !addr.IsValid() || !addr.IsGlobalUnicast() || addr.IsPrivate() {
		return false
	}
	for _, p := range extraBlocked {
		if p.Contains(addr) {
			return false
		}
	}
	return true
}

// ValidateURL checks that raw is an acceptable upstream URL under p, without
// resolving DNS (resolution is checked at dial time, see Client).
func (p Policy) ValidateURL(u *url.URL) error {
	if u == nil || u.Host == "" {
		return fmt.Errorf("%w: missing host", ErrBlockedDestination)
	}
	if u.User != nil {
		return fmt.Errorf("%w: credentials in URL are not allowed", ErrBlockedDestination)
	}
	switch strings.ToLower(u.Scheme) {
	case "https":
	case "http":
		if !p.AllowHTTP {
			return fmt.Errorf("%w: only https URLs are accepted", ErrBlockedDestination)
		}
	default:
		return fmt.Errorf("%w: unsupported scheme %q", ErrBlockedDestination, u.Scheme)
	}
	if port := u.Port(); port != "" && port != "443" && !p.AllowHTTP {
		return fmt.Errorf("%w: non-standard port %s", ErrBlockedDestination, port)
	}
	if ip, err := netip.ParseAddr(strings.Trim(u.Hostname(), "[]")); err == nil && !p.AllowPrivate && !IsPublicAddr(ip) {
		return fmt.Errorf("%w: %s is not a public address", ErrBlockedDestination, ip)
	}
	return nil
}

// control runs after DNS resolution, right before connect(2): it sees the
// actual IP being dialed, which defeats DNS-rebinding tricks.
func (p Policy) control(_, address string, _ syscall.RawConn) error {
	if p.AllowPrivate {
		return nil
	}
	host, _, err := net.SplitHostPort(address)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrBlockedDestination, err)
	}
	ip, err := netip.ParseAddr(host)
	if err != nil || !IsPublicAddr(ip) {
		return fmt.Errorf("%w: %s is not a public address", ErrBlockedDestination, host)
	}
	return nil
}

// Client returns an *http.Client enforcing p on every connection and redirect.
// Environment proxies are ignored on purpose: going through a proxy would
// hide the real destination from the dial-time check.
func (p Policy) Client(timeout time.Duration, jar http.CookieJar) *http.Client {
	dialer := &net.Dialer{
		Timeout:   10 * time.Second,
		KeepAlive: 30 * time.Second,
		Control:   p.control,
	}
	transport := &http.Transport{
		Proxy:                 nil,
		DialContext:           dialer.DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          20,
		IdleConnTimeout:       60 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ResponseHeaderTimeout: 30 * time.Second,
		ExpectContinueTimeout: time.Second,
	}
	return &http.Client{
		Timeout:   timeout,
		Jar:       jar,
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= maxRedirects {
				return fmt.Errorf("stopped after %d redirects", maxRedirects)
			}
			return p.ValidateURL(req.URL)
		},
	}
}
