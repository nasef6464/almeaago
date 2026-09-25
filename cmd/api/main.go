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

	contentapp "github.com/nasef6464/almeaago/internal/content/application"
	contentrepo "github.com/nasef6464/almeaago/internal/content/repository/postgres"
	contenthttp "github.com/nasef6464/almeaago/internal/content/transport/http"
	"github.com/nasef6464/almeaago/internal/identity/application"
	googleprovider "github.com/nasef6464/almeaago/internal/identity/provider/google"
	whatsappprovider "github.com/nasef6464/almeaago/internal/identity/provider/whatsapp"
	identityrepo "github.com/nasef6464/almeaago/internal/identity/repository/postgres"
	identityhttp "github.com/nasef6464/almeaago/internal/identity/transport/http"
	mediaapp "github.com/nasef6464/almeaago/internal/media/application"
	r2provider "github.com/nasef6464/almeaago/internal/media/provider/r2"
	mediarepo "github.com/nasef6464/almeaago/internal/media/repository/postgres"
	mediahttp "github.com/nasef6464/almeaago/internal/media/transport/http"
	operationsrepo "github.com/nasef6464/almeaago/internal/operations/repository/postgres"
	orgapp "github.com/nasef6464/almeaago/internal/organizations/application"
	orgrepo "github.com/nasef6464/almeaago/internal/organizations/repository/postgres"
	organizationshttp "github.com/nasef6464/almeaago/internal/organizations/transport/http"
	"github.com/nasef6464/almeaago/internal/platform/cache"
	"github.com/nasef6464/almeaago/internal/platform/config"
	"github.com/nasef6464/almeaago/internal/platform/database"
	"github.com/nasef6464/almeaago/internal/platform/httpserver"
	"github.com/nasef6464/almeaago/internal/platform/observability"
	questionapp "github.com/nasef6464/almeaago/internal/questionbank/application"
	questionrepo "github.com/nasef6464/almeaago/internal/questionbank/repository/postgres"
	questionhttp "github.com/nasef6464/almeaago/internal/questionbank/transport/http"
	reportingrepo "github.com/nasef6464/almeaago/internal/reporting/repository/postgres"
	taxonomyapp "github.com/nasef6464/almeaago/internal/taxonomy/application"
	taxonomyrepo "github.com/nasef6464/almeaago/internal/taxonomy/repository/postgres"
	taxonomyhttp "github.com/nasef6464/almeaago/internal/taxonomy/transport/http"
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

	auditWriter := operationsrepo.NewAuditWriter()
	organizationScopes := orgrepo.NewAdminScopeWriter()
	contentAdminScopes := contentrepo.NewAdminScopeWriter(auditWriter)
	identityRepository := identityrepo.NewWithContentScopes(db, organizationScopes, contentAdminScopes)
	adminDirectory := reportingrepo.NewAdminUserDirectory(db)
	directorDirectory := reportingrepo.NewSchoolDirectorDirectory(db)

	contentRepository := contentrepo.New(db, auditWriter)
	organizationsRepository := orgrepo.New(db, auditWriter, identityRepository)
	authorScope := contentapp.NewCombinedAuthorScope(contentRepository, organizationsRepository)
	contentService := contentapp.NewServiceWithAuthorScope(contentRepository, authorScope)
	organizationsService := orgapp.NewServiceWithOptions(organizationsRepository, orgapp.ServiceOptions{
		DirectorDirectory:       directorDirectory,
		PlatformTrainerResolver: contentRepository,
	})
	taxonomyRepository := taxonomyrepo.New(db)
	taxonomyService := taxonomyapp.NewService(taxonomyRepository)
	questionRepository := questionrepo.New(db, auditWriter)
	questionService := questionapp.NewServiceWithAuthorScope(questionRepository, authorScope)
	mediaRepository := mediarepo.New(db, auditWriter)
	r2Client := r2provider.New(r2provider.Config{
		AccountID:       cfg.R2AccountID,
		Bucket:          cfg.R2Bucket,
		PublicBaseURL:   cfg.R2PublicBaseURL,
		AccessKeyID:     cfg.R2AccessKeyID,
		SecretAccessKey: cfg.R2SecretAccessKey,
	})
	mediaService := mediaapp.NewService(
		mediaRepository,
		r2Client,
		cfg.MediaMaxUploadBytes,
		time.Duration(cfg.MediaPresignTTLSeconds)*time.Second,
	)
	questionImportService := questionapp.NewImportService(
		questionRepository,
		mediaService,
		30*time.Minute,
	)

	whatsAppDelivery := whatsappprovider.NewWebhook(
		cfg.WhatsAppOTPEndpoint,
		cfg.WhatsAppOTPToken,
	)
	identityService := application.NewServiceWithOptions(identityRepository, application.ServiceOptions{
		WhatsAppDelivery: whatsAppDelivery,
		OTPPepper:        cfg.OTPPepper,
	})
	coursesHandler := contenthttp.NewCourses(contentService, identityService)
	lessonsHandler := contenthttp.NewLessons(contentService, identityService)
	foundationHandler := contenthttp.NewFoundation(contentService, identityService)
	libraryHandler := contenthttp.NewLibrary(contentService, identityService)
	contentManagementHandler := contenthttp.NewManagement(contentService, identityService)
	learningSpacesHandler := contenthttp.NewLearningSpaces(contentService, identityService)
	taxonomyHandler := taxonomyhttp.New(taxonomyService, identityService)
	questionHandler := questionhttp.New(
		questionService,
		identityService,
		questionhttp.Options{Import: questionImportService},
	)
	mediaHandler := mediahttp.New(mediaService, identityService)
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
		Taxonomy:           taxonomyHandler,
		QuestionBank:       questionHandler,
		Media:              mediaHandler,
		Courses:            coursesHandler,
		Lessons:            lessonsHandler,
		Foundation:         foundationHandler,
		Library:            libraryHandler,
		ContentManagement:  contentManagementHandler,
		LearningSpaces:     learningSpacesHandler,
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
