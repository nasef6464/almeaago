package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	communicationapp "github.com/nasef6464/almeaago/internal/communication/application"
	communicationprovider "github.com/nasef6464/almeaago/internal/communication/provider"
	communicationrepo "github.com/nasef6464/almeaago/internal/communication/repository/postgres"
	"github.com/nasef6464/almeaago/internal/platform/config"
	"github.com/nasef6464/almeaago/internal/platform/database"
	"github.com/nasef6464/almeaago/internal/platform/observability"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("configuration_error", "error", err)
		os.Exit(1)
	}

	logger := observability.NewLogger(cfg.LogLevel)
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	db, err := database.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("postgres_startup_failed", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	notifications := communicationrepo.New(db)
	sender := communicationprovider.New(communicationprovider.Config{
		EmailProvider:         cfg.EmailProvider,
		EmailFrom:             cfg.EmailFrom,
		ResendAPIKey:          cfg.ResendAPIKey,
		EmailWebhookURL:       cfg.EmailWebhookURL,
		EmailWebhookToken:     cfg.EmailWebhookToken,
		WhatsAppProvider:      cfg.WhatsAppProvider,
		WhatsAppAccessToken:   cfg.WhatsAppAccessToken,
		WhatsAppPhoneNumberID: cfg.WhatsAppPhoneNumberID,
		WhatsAppWebhookURL:    cfg.WhatsAppWebhookURL,
		WhatsAppWebhookToken:  cfg.WhatsAppWebhookToken,
	})
	processor := communicationapp.NewProcessor(notifications, sender)

	process := func() {
		runCtx, cancel := context.WithTimeout(ctx, 45*time.Second)
		defer cancel()
		result, processErr := processor.ProcessBatch(runCtx, cfg.NotificationWorkerBatch)
		if processErr != nil {
			if ctx.Err() == nil {
				logger.Error("notification_worker_batch_failed", "error", processErr)
			}
			return
		}
		if result.Claimed > 0 {
			logger.Info(
				"notification_worker_batch",
				"claimed", result.Claimed,
				"sent", result.Sent,
				"retrying", result.Retrying,
				"failed", result.Failed,
			)
		}
	}

	logger.Info(
		"worker_started",
		"env", cfg.Environment,
		"notification_batch", cfg.NotificationWorkerBatch,
		"notification_poll_seconds", cfg.NotificationWorkerPollSeconds,
	)
	process()
	ticker := time.NewTicker(time.Duration(cfg.NotificationWorkerPollSeconds) * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			logger.Info("worker_stopped")
			return
		case <-ticker.C:
			process()
		}
	}
}
