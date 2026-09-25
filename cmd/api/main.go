package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/nasef6464/almeaago/internal/identity/application"
	googleprovider "github.com/nasef6464/almeaago/internal/identity/provider/google"
	whatsappprovider "github.com/nasef6464/almeaago/internal/identity/provider/whatsapp"
	identityrepo "github.com/nasef6464/almeaago/internal/identity/repository/postgres"
	identityhttp "github.com/nasef6464/almeaago/internal/identity/transport/http"
	operationsrepo "github.com/nasef6464/almeaago/internal/operations/repository/postgres"
	orgapp "github.com/nasef6464/almeaago/internal/organizations/application"
	orgrepo "github.com/nasef6464/almeaago/internal/organizations/repository/postgres"
	organizationshttp "github.com/nasef6464/almeaago/internal/organizations/transport/http"
	"github.com/nasef6464/almeaago/internal/platform/cache"
	"github.com/nasef6464/almeaago/internal/platform/config"
	"github.com/nasef6464/almeaago/internal/platform/database"
	"github.com/nasef6464/almeaago/internal/platform/httpserver"
	"github.com/nasef6464/almeaago/internal/platform/observability"
	reportingrepo "github.com/nasef6464/almeaago/internal/reporting/repository/postgres"
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

	organizationScopes := orgrepo.NewAdminScopeWriter()
	identityRepository := identityrepo.New(db, organizationScopes)
	adminDirectory := reportingrepo.NewAdminUserDirectory(db)
	directorDirectory := reportingrepo.NewSchoolDirectorDirectory(db)

	auditWriter := operationsrepo.NewAuditWriter()
	organizationsRepository := orgrepo.New(db, auditWriter, identityRepository)
	organizationsService := orgapp.NewService(organizationsRepository, directorDirectory)

	whatsAppDelivery := whatsappprovider.NewWebhook(
		cfg.WhatsAppOTPEndpoint,
		cfg.WhatsAppOTPToken,
	)
	identityService := application.NewServiceWithOptions(identityRepository, application.ServiceOptions{
		WhatsAppDelivery: whatsAppDelivery,
		OTPPepper:        cfg.OTPPepper,
	})
	organizationsHandler := organizationshttp.New(organizationsService, identityService)
	parentsHandler := organizationshttp.NewParentFacade(organizationsService, identityService)
	legacySchoolAccessHandler := organizationshttp.NewLegacy(organizationsService, identityService)

	adminService := application.NewAdminService(identityRepository, adminDirectory)
	accountService := application.NewAccountService(identityRepository)

	googleClient := googleprovider.New(googleprovider.Config{
		ClientID:     cfg.GoogleClientID,
		ClientSecret: cfg.GoogleClientSecret,
		RedirectURI:  cfg.GoogleRedirectURI,
	})
	identityHandler := identityhttp.New(identityService, cfg.IsProduction(), identityhttp.Options{
		Google:    googleClient,
		Admin:     adminService,
		Account:   accountService,
		WebOrigin: cfg.WebOrigin,
	})

	server := httpserver.New(cfg.HTTPAddr, httpserver.Dependencies{
		Logger:             logger,
		DB:                 db,
		Redis:              redisClient,
		Identity:           identityHandler,
		Organizations:      organizationsHandler,
		Parents:            parentsHandler,
		LegacySchoolAccess: legacySchoolAccessHandler,
	})

	go func() {
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("api_failed", "error", err)
			stop()
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = server.Shutdown(shutdownCtx)
}
