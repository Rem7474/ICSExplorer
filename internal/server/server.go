package server

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/Rem7474/ICSExplorer/internal/config"
	"github.com/Rem7474/ICSExplorer/internal/netsafe"
	"github.com/Rem7474/ICSExplorer/internal/syncer"
	"github.com/Rem7474/ICSExplorer/internal/university"
)

// contentSecurityPolicy is the default CSP for every response. Vuetify
// injects its theme as a runtime <style> tag and Vue binds inline style
// attributes, hence 'unsafe-inline' for styles only; scripts must come from
// the same origin.
const contentSecurityPolicy = "default-src 'self'; " +
	"script-src 'self'; " +
	"style-src 'self' 'unsafe-inline'; " +
	"img-src 'self' data: blob:; " +
	"font-src 'self' data:; " +
	"connect-src 'self'; " +
	"worker-src 'self'; " +
	"manifest-src 'self'; " +
	"object-src 'none'; " +
	"base-uri 'self'; " +
	"form-action 'self'; " +
	"frame-ancestors 'self'"

// manualSyncCooldown is the minimum delay between two accepted POST /api/sync calls.
const manualSyncCooldown = time.Minute

// Server encapsulates the HTTP server, routing, and background services.
type Server struct {
	cfg                 *config.Config
	syncer              *syncer.Syncer
	logger              *slog.Logger
	httpServer          *http.Server
	treeLimiter         *ipRateLimiter
	calendarLimiter     *ipRateLimiter
	universityDirectory *university.Directory

	// upstreamPolicy restricts where user-supplied ADE URLs may point to.
	// The zero value is the strict production policy.
	upstreamPolicy netsafe.Policy

	// bgCtx is canceled on Shutdown, stopping syncs started from HTTP handlers.
	bgCtx    context.Context
	bgCancel context.CancelFunc

	manualSyncMu   sync.Mutex
	lastManualSync time.Time
}

// New creates a new HTTP Server instance.
func New(cfg *config.Config, s *syncer.Syncer, logger *slog.Logger) *Server {
	if logger == nil {
		logger = slog.Default()
	}

	bgCtx, bgCancel := context.WithCancel(context.Background())
	srv := &Server{
		cfg:    cfg,
		syncer: s,
		logger: logger,
		// Browsing the tree issues one request per click; fetching a calendar
		// is much heavier upstream (it may walk a whole branch), hence the
		// tighter budget.
		treeLimiter:         newIPRateLimiter(60, time.Minute),
		calendarLimiter:     newIPRateLimiter(15, time.Minute),
		universityDirectory: university.NewDirectory(university.DefaultDeployments(), 6*time.Hour),
		bgCtx:               bgCtx,
		bgCancel:            bgCancel,
	}

	mux := http.NewServeMux()
	srv.registerRoutes(mux)

	handler := srv.applyMiddlewares(mux)

	srv.httpServer = &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.Port),
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    64 << 10,
	}

	return srv
}

// Start runs the HTTP server.
func (s *Server) Start() error {
	s.logger.Info("starting HTTP server", "addr", s.httpServer.Addr)
	if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("HTTP server listen error: %w", err)
	}
	return nil
}

// Shutdown gracefully shuts down the HTTP server and cancels background work
// it started.
func (s *Server) Shutdown(ctx context.Context) error {
	s.logger.Info("shutting down HTTP server...")
	s.bgCancel()
	return s.httpServer.Shutdown(ctx)
}

// isPublicReadPath reports whether path serves public, read-only data that
// third-party sites (calendar apps, widgets) may fetch cross-origin.
func isPublicReadPath(path string) bool {
	switch path {
	case "/api/health", "/api/files", "/api/rooms":
		return true
	}
	return strings.HasPrefix(path, "/output/") || strings.HasPrefix(path, "/rooms/")
}

// applyMiddlewares wraps the handler with security headers, CORS, logging, and recovery.
func (s *Server) applyMiddlewares(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Security headers
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "SAMEORIGIN")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		h.Set("Content-Security-Policy", contentSecurityPolicy)
		h.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
		h.Set("Cross-Origin-Opener-Policy", "same-origin")
		if s.isHTTPS(r) {
			h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}

		// CORS: only public read-only data is shared cross-origin. The API
		// endpoints receiving credentials stay same-origin, so another site
		// cannot use this instance as a proxy towards ADE servers.
		if isPublicReadPath(r.URL.Path) {
			h.Set("Access-Control-Allow-Origin", "*")
			h.Set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
			h.Set("Access-Control-Allow-Headers", "If-None-Match")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		// Panic recovery
		defer func() {
			if rec := recover(); rec != nil {
				s.logger.Error("panic recovered in HTTP handler", "error", rec, "path", r.URL.Path)
				http.Error(w, `{"error":"internal server error"}`, http.StatusInternalServerError)
			}
		}()

		next.ServeHTTP(w, r)

		s.logger.Debug("HTTP request served",
			"method", r.Method,
			"path", r.URL.Path,
			"duration", time.Since(start).String(),
			"remote", s.clientIP(r),
		)
	})
}
