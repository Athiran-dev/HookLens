// Command api is the HookLens server: dashboard API, webhook ingestion and the CLI tunnel endpoint.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/hooklens/hooklens/internal/config"
	"github.com/hooklens/hooklens/internal/server"
	"github.com/hooklens/hooklens/internal/store"
)

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))
	cfg, err := config.Load()
	if err != nil {
		log.Error("config", "err", err)
		os.Exit(1)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	st, err := store.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Error("database", "err", err)
		os.Exit(1)
	}
	defer st.Close()
	if err := st.Migrate(ctx); err != nil {
		log.Error("migrate", "err", err)
		os.Exit(1)
	}

	if err := server.New(cfg, st, log).Run(ctx); err != nil {
		log.Error("server", "err", err)
		os.Exit(1)
	}
}
