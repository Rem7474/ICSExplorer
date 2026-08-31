package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Rem7474/ICSExplorer/internal/ade"
	"github.com/Rem7474/ICSExplorer/internal/config"
	"github.com/Rem7474/ICSExplorer/internal/server"
	"github.com/Rem7474/ICSExplorer/internal/syncer"
)

var (
	version   = "2.0.0"
	buildTime = "dev"
)

func main() {
	syncOnly := flag.Bool("sync-only", false, "Run one-shot calendar sync and exit")
	showVersion := flag.Bool("version", false, "Print version and exit")
	flag.Parse()

	if *showVersion {
		fmt.Printf("ICSExplorer backend version %s (built: %s)\n", version, buildTime)
		os.Exit(0)
	}

	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to load configuration: %v\n", err)
		os.Exit(1)
	}

	logger := setupLogger(cfg.LogLevel, cfg.LogFormat)
	slog.SetDefault(logger)

	logger.Info("starting ICSExplorer server", "version", version, "academic_year", cfg.AcademicYear, "port", cfg.Port)

	// Initialize ADE client and Syncer
	adeClient := ade.NewClient(cfg.AgalanLogin, cfg.AgalanPassword, cfg.AcademicYear)
	syncService := syncer.New(cfg, adeClient, logger)

	// One-shot mode
	if *syncOnly {
		logger.Info("running in one-shot sync mode")
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
		defer cancel()

		if err := syncService.Sync(ctx); err != nil {
			logger.Error("one-shot sync failed", "error", err)
			os.Exit(1)
		}
		logger.Info("one-shot sync completed successfully")
		os.Exit(0)
	}

	// Context for graceful shutdown
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Initial sync on startup if enabled
	if cfg.SyncOnStartup {
		go func() {
			logger.Info("running initial synchronization on startup...")
			if err := syncService.Sync(ctx); err != nil {
				logger.Warn("initial sync completed with errors", "error", err)
			}
		}()
	}

	// Start background sync scheduler
	ticker := time.NewTicker(cfg.SyncInterval)
	defer ticker.Stop()

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				logger.Info("scheduled sync triggered", "interval", cfg.SyncInterval)
				if err := syncService.Sync(ctx); err != nil {
					logger.Warn("scheduled sync completed with errors", "error", err)
				}
			}
		}
	}()

	// Initialize and run HTTP server
	httpSrv := server.New(cfg, syncService, logger)

	go func() {
		if err := httpSrv.Start(); err != nil {
			logger.Error("server stopped with error", "error", err)
		}
	}()

	// Wait for termination signal
	<-ctx.Done()
	logger.Info("shutdown signal received, draining connections...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutdownCancel()

	if err := httpSrv.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown failed", "error", err)
	} else {
		logger.Info("server shutdown gracefully")
	}
}

func setupLogger(levelStr, formatStr string) *slog.Logger {
	var level slog.Level
	switch levelStr {
	case "debug":
		level = slog.LevelDebug
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}

	opts := &slog.HandlerOptions{
		Level: level,
	}

	if formatStr == "json" {
		return slog.New(slog.NewJSONHandler(os.Stdout, opts))
	}
	return slog.New(slog.NewTextHandler(os.Stdout, opts))
}
