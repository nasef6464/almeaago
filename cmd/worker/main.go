package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	assessmentrepo "github.com/nasef6464/almeaago/internal/assessment/repository/postgres"
	communicationapp "github.com/nasef6464/almeaago/internal/communication/application"
	communicationredis "github.com/nasef6464/almeaago/internal/communication/infrastructure/redis"
	communicationprovider "github.com/nasef6464/almeaago/internal/communication/provider"
	communicationrepo "github.com/nasef6464/almeaago/internal/communication/repository/postgres"
	identityrepo "github.com/nasef6464/almeaago/internal/identity/repository/postgres"
	learningrepo "github.com/nasef6464/almeaago/internal/learning/repository/postgres"
	orgapp "github.com/nasef6464/almeaago/internal/organizations/application"
	orgrepo "github.com/nasef6464/almeaago/internal/organizations/repository/postgres"
	parentapp "github.com/nasef6464/almeaago/internal/parents/application"
	"github.com/nasef6464/almeaago/internal/platform/cache"
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

	redisClient, err := cache.Open(ctx, cfg.RedisURL)
	if err != nil {
		logger.Error("redis_startup_failed", "error", err)
		os.Exit(1)
	}
	defer redisClient.Close()

	notifications := communicationrepo.New(db)
	identityRepository := identityrepo.New(db)
	organizationsRepository := orgrepo.New(db, nil, identityRepository)
	organizationsService := orgapp.NewService(organizationsRepository)
	assessmentRepository := assessmentrepo.New(db, nil)
	learningRepository := learningrepo.New(db)
	parentService := parentapp.NewService(
		organizationsService,
		identityRepository,
		assessmentRepository,
		learningRepository,
	)
	notificationRealtime := communicationredis.New(redisClient)
	communicationService := communicationapp.NewServiceWithRealtime(
		notifications,
		identityRepository,
		notificationRealtime,
	)
	weeklyParentReporter := communicationapp.NewWeeklyParentReporter(
		communicationService,
		parentService,
	)

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

	lastWeeklyKey := ""
	processWeeklyParentReports := func() {
		key, due := communicationapp.ShouldRunWeeklyParentReport(time.Now().UTC())
		if !due || key == lastWeeklyKey {
			return
		}
		runCtx, cancel := context.WithTimeout(ctx, 4*time.Minute)
		defer cancel()
		result, reportErr := weeklyParentReporter.Run(runCtx, time.Now().UTC())
		if reportErr != nil {
			if ctx.Err() == nil {
				logger.Error(
					"weekly_parent_report_failed",
					"execution_key", key,
					"error", reportErr,
					"sent", result.Sent,
					"reused", result.Reused,
					"failed", result.Failed,
				)
			}
			return
		}
		lastWeeklyKey = key
		logger.Info(
			"weekly_parent_report",
			"execution_key", result.ExecutionKey,
			"processed_parents", result.ProcessedParents,
			"sent", result.Sent,
			"reused", result.Reused,
			"skipped_no_links", result.SkippedNoLinks,
			"skipped_no_activity", result.SkippedNoActivity,
			"whatsapp_opt_in", result.WhatsAppOptIn,
		)
	}

	logger.Info(
		"worker_started",
		"env", cfg.Environment,
		"notification_batch", cfg.NotificationWorkerBatch,
		"notification_poll_seconds", cfg.NotificationWorkerPollSeconds,
	)
	process()
	processWeeklyParentReports()
	ticker := time.NewTicker(time.Duration(cfg.NotificationWorkerPollSeconds) * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			logger.Info("worker_stopped")
			return
		case <-ticker.C:
			process()
			processWeeklyParentReports()
		}
	}
}
