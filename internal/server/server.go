package server

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/Rem7474/ICSExplorer/internal/config"
	"github.com/Rem7474/ICSExplorer/internal/syncer"
	"github.com/Rem7474/ICSExplorer/internal/university"
)

// Server encapsulates the HTTP server, routing, and background services.
type Server struct {
	cfg                     *config.Config
	syncer                  *syncer.Syncer
	logger                  *slog.Logger
	httpServer              *http.Server
	personalCalendarLimiter *ipRateLimiter
	universityDirectory     *university.Directory
}

// New creates a new HTTP Server instance.
func New(cfg *config.Config, s *syncer.Syncer, logger *slog.Logger) *Server {
	if logger == nil {
		logger = slog.Default()
	}

	srv := &Server{
		cfg:                     cfg,
		syncer:                  s,
		logger:                  logger,
		personalCalendarLimiter: newIPRateLimiter(5, 10*time.Minute),
		universityDirectory:     university.NewDirectory(university.DefaultDeployments(), 6*time.Hour),
	}

	mux := http.NewServeMux()
	srv.registerRoutes(mux)

	handler := srv.applyMiddlewares(mux)

	srv.httpServer = &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      handler,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
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

// Shutdown gracefully shuts down the HTTP server.
func (s *Server) Shutdown(ctx context.Context) error {
	s.logger.Info("shutting down HTTP server...")
	return s.httpServer.Shutdown(ctx)
}

// applyMiddlewares wraps the handler with security headers, CORS, logging, and recovery.
func (s *Server) applyMiddlewares(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Security headers
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "SAMEORIGIN")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

		// CORS for API & Output endpoints
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, If-None-Match")

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
			"remote", r.RemoteAddr,
		)
	})
}
