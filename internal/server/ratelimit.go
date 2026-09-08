package server

import (
	"net"
	"net/http"
	"sync"
	"time"
)

// ipRateLimiter is a minimal fixed-window rate limiter keyed by client IP,
// used to stop the shared instance from being used to hammer (and get
// blocked by) a third-party university's ADE server.
type ipRateLimiter struct {
	mu     sync.Mutex
	hits   map[string][]time.Time
	limit  int
	window time.Duration
}

func newIPRateLimiter(limit int, window time.Duration) *ipRateLimiter {
	return &ipRateLimiter{
		hits:   make(map[string][]time.Time),
		limit:  limit,
		window: window,
	}
}

// Allow reports whether a new request from ip is permitted, recording it if so.
func (l *ipRateLimiter) Allow(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-l.window)

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

// clientIP extracts the request's remote IP, ignoring the port.
func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
