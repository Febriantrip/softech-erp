package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/nexa-distributor/erp-backend/internal/config"
	"github.com/nexa-distributor/erp-backend/internal/httpapi"
	pgstore "github.com/nexa-distributor/erp-backend/internal/platform/postgres"
)

func main() {
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		slog.Error("invalid_configuration", "error", err)
		os.Exit(1)
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	dbCtx, dbCancel := context.WithTimeout(context.Background(), 10*time.Second)
	db, err := pgstore.Open(dbCtx, cfg.PostgresURL())
	dbCancel()
	if err != nil {
		logger.Error("postgres_connection_failed", "error", err)
		os.Exit(1)
	}
	defer db.Close()
	server := httpapi.NewServer(cfg, logger, db.Pool)
	httpServer := &http.Server{
		Addr: cfg.HTTPAddr, Handler: server.Handler(),
		ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second,
		WriteTimeout: 30 * time.Second, IdleTimeout: 90 * time.Second,
	}

	go func() {
		logger.Info("api_starting", "addr", cfg.HTTPAddr, "env", cfg.Environment)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("api_failed", "error", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	logger.Info("shutdown_started")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpServer.Shutdown(ctx); err != nil {
		logger.Error("shutdown_failed", "error", err)
		os.Exit(1)
	}
	logger.Info("shutdown_complete")
}
