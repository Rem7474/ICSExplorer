package server

import (
	"net"
	"net/http"
	"net/netip"
	"strings"
	"sync"
	"time"
)

// ipRateLimiter is a minimal sliding-window rate limiter keyed by client IP,
// used to stop the shared instance from being used to hammer (and get
// blocked by) a third-party university's ADE server.
type ipRateLimiter struct {
	mu        sync.Mutex
	hits      map[string][]time.Time
	limit     int
	window    time.Duration
	lastSweep time.Time
}

func newIPRateLimiter(limit int, window time.Duration) *ipRateLimiter {
	return &ipRateLimiter{
		hits:      make(map[string][]time.Time),
		limit:     limit,
		window:    window,
		lastSweep: time.Now(),
	}
}

// Allow reports whether a new request from ip is permitted, recording it if so.
func (l *ipRateLimiter) Allow(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-l.window)

	// Periodically drop IPs with no hit left in the window, so the map does
	// not grow without bound with every client ever seen.
	if now.Sub(l.lastSweep) >= l.window {
		for key, times := range l.hits {
			if len(times) == 0 || !times[len(times)-1].After(cutoff) {
				delete(l.hits, key)
			}
		}
		l.lastSweep = now
	}

	recent := l.hits[ip][:0]
	for _, t := range l.hits[ip] {
		if t.After(cutoff) {
			recent = append(recent, t)
		}
	}

	if len(recent) >= l.limit {
		l.hits[ip] = recent
		return false
	}

	l.hits[ip] = append(recent, now)
	return true
}

// size returns the number of tracked IPs (for tests).
func (l *ipRateLimiter) size() int {
	l.mu.Lock()
	defer l.mu.Unlock()
	return len(l.hits)
}

// isTrustedProxy reports whether addr belongs to one of the configured proxies.
func (s *Server) isTrustedProxy(addr netip.Addr) bool {
	addr = addr.Unmap()
	for _, p := range s.cfg.TrustedProxies {
		if p.Contains(addr) {
			return true
		}
	}
	return false
}

// remoteAddr returns the IP of the direct TCP peer.
func remoteAddr(r *http.Request) (netip.Addr, bool) {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	addr, err := netip.ParseAddr(host)
	if err != nil {
		return netip.Addr{}, false
	}
	return addr.Unmap(), true
}

// clientIP returns the address used for rate limiting. X-Forwarded-For is
// only honored when the direct peer is a trusted proxy; the chain is then
// walked right-to-left, skipping trusted hops, so a client cannot spoof its
// address by prepending fake entries.
func (s *Server) clientIP(r *http.Request) string {
	peer, ok := remoteAddr(r)
	if !ok {
		return r.RemoteAddr
	}
	if !s.isTrustedProxy(peer) {
		return peer.String()
	}

	hops := strings.Split(r.Header.Get("X-Forwarded-For"), ",")
	for i := len(hops) - 1; i >= 0; i-- {
		addr, err := netip.ParseAddr(strings.TrimSpace(hops[i]))
		if err != nil {
			break
		}
		addr = addr.Unmap()
		if !s.isTrustedProxy(addr) {
			return addr.String()
		}
	}
	return peer.String()
}

// isHTTPS reports whether the client-facing connection uses TLS, either
// directly or as reported by a trusted reverse proxy.
func (s *Server) isHTTPS(r *http.Request) bool {
	if r.TLS != nil {
		return true
	}
	if peer, ok := remoteAddr(r); ok && s.isTrustedProxy(peer) {
		return strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
	}
	return false
}
