package application

import (
	"context"
	"errors"
	"strings"
	"time"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

var (
	ErrForbidden    = errors.New("operations access forbidden")
	ErrInvalidInput = errors.New("invalid operations request")
	ErrConflict     = operations.ErrConflict
)

type Repository interface {
	ListAudit(context.Context, operations.AuditQuery) (operations.AuditPage, error)
	ReadinessCounts(context.Context) (operations.OperationalCounts, error)
	DependencyHealth(context.Context) operations.DependencyHealth
	GetIntegrationSettings(context.Context) (operations.PlatformIntegrationState, error)
	UpdateIntegrationSettings(context.Context, string, operations.PlatformIntegrationSettings, int) (operations.PlatformIntegrationState, error)
	ListBackupExports(context.Context, int) ([]operations.BackupExportRecord, error)
	CreateBackupExport(context.Context, string, string) (operations.BackupExportResult, error)
	RecordBackupValidation(context.Context, string, map[string]int, int) error
}

type Config struct {
	Integrations       []operations.IntegrationCheck
	Environment        string
	ReleaseSHA         string
	DeploymentProvider string
	SentryConfigured   bool
	OTelConfigured     bool
}

type Service struct {
	repo Repository
	cfg  Config
	now  func() time.Time
}

func NewService(repo Repository, cfg Config) *Service {
	return &Service{repo: repo, cfg: cfg, now: time.Now}
}

func requireAdmin(actor identity.User) error {
	if strings.TrimSpace(actor.ID) == "" || !actor.HasRole(identity.RoleAdmin) {
		return ErrForbidden
	}
	return nil
}

func (s *Service) Audit(
	ctx context.Context,
	actor identity.User,
	query operations.AuditQuery,
) (operations.AuditPage, error) {
	if err := requireAdmin(actor); err != nil {
		return operations.AuditPage{}, err
	}
	query.Action = strings.TrimSpace(query.Action)
	query.ResourceType = strings.TrimSpace(query.ResourceType)
	query.ActorUserID = strings.TrimSpace(query.ActorUserID)
	if len(query.Action) > 160 || len(query.ResourceType) > 120 || len(query.ActorUserID) > 120 {
		return operations.AuditPage{}, ErrInvalidInput
	}
	if query.Status != "" && !operations.ValidAuditStatus(query.Status) {
		return operations.AuditPage{}, ErrInvalidInput
	}
	if query.Page < 1 {
		query.Page = 1
	}
	if query.Limit < 1 {
		query.Limit = 50
	}
	if query.Page > 10000 || query.Limit > 100 {
		return operations.AuditPage{}, ErrInvalidInput
	}
	return s.repo.ListAudit(ctx, query)
}

func (s *Service) Readiness(
	ctx context.Context,
	actor identity.User,
) (operations.Readiness, error) {
	if err := requireAdmin(actor); err != nil {
		return operations.Readiness{}, err
	}
	dependencies := s.repo.DependencyHealth(ctx)
	counts, err := s.repo.ReadinessCounts(ctx)
	if err != nil {
		return operations.Readiness{}, err
	}
	status := "ready"
	if !dependencies.Postgres || !dependencies.Redis {
		status = "blocked"
	} else {
		for _, item := range s.cfg.Integrations {
			if item.Required && !item.Configured {
				status = "blocked"
				break
			}
			if !item.Configured && status == "ready" {
				status = "ready_with_notes"
			}
		}
		if counts.NotificationFailed > 0 || counts.AuditFailed24h > 0 {
			if status == "ready" {
				status = "ready_with_notes"
			}
		}
		// Release readiness cannot be presented as fully green while no dated,
		// verified restore drill is recorded by deployment operations.
		if status == "ready" {
			status = "ready_with_notes"
		}
	}
	releaseSHA := strings.TrimSpace(s.cfg.ReleaseSHA)
	releaseProvider := strings.TrimSpace(s.cfg.DeploymentProvider)
	releaseIdentity := operations.ReleaseIdentity{
		Environment:        strings.TrimSpace(s.cfg.Environment),
		CommitSHA:          releaseSHA,
		DeploymentProvider: releaseProvider,
		Proof:              "external_proof_required",
		Detail:             "Deployment must publish an exact release SHA and external post-deploy evidence before release identity is certified.",
	}
	if releaseSHA != "" {
		releaseIdentity.Proof = "declared"
		releaseIdentity.Detail = "Runtime declares an exact release SHA; external deployment verification is still required before certification."
	}
	evidence := []operations.ReleaseEvidence{
		{
			ID:     "release_identity",
			Status: releaseIdentity.Proof,
			Detail: releaseIdentity.Detail,
		},
		{
			ID:     "observability",
			Status: "external_proof_required",
			Detail: "Structured application logs are internal evidence; live Sentry/OTel event and alert routing proof must come from deployment operations.",
		},
		{
			ID:     "backup_restore",
			Status: "external_proof_required",
			Detail: "A dated isolated restore drill with measured RPO/RTO is not recorded by the application.",
		},
		{
			ID:     "performance_load",
			Status: "external_proof_required",
			Detail: "Production-equivalent p50/p95/p99, error-rate and resource evidence is not recorded by this runtime.",
		},
		{
			ID:     "governance",
			Status: "external_proof_required",
			Detail: "Repository protection, required checks and deployment approval policy require external control-plane evidence.",
		},
	}
	if s.cfg.SentryConfigured || s.cfg.OTelConfigured {
		evidence[1].Status = "configured_not_verified"
		evidence[1].Detail = "Observability export is configured, but live event/trace ingestion and alert routing still require external verification."
	}
	releaseDecision := "internal_ready_external_evidence_pending"
	if status == "blocked" {
		releaseDecision = "blocked_internal_readiness"
	}
	return operations.Readiness{
		CheckedAt:           s.now().UTC(),
		Status:              status,
		Dependencies:        dependencies,
		Integrations:        append([]operations.IntegrationCheck(nil), s.cfg.Integrations...),
		Counts:              counts,
		ReleaseIdentity:     releaseIdentity,
		ReleaseEvidence:     evidence,
		ReleaseDecision:     releaseDecision,
		BackupRestoreProof:  "external_proof_required",
		BackupRestoreDetail: "The application records no verified backup/restore drill yet; deployment infrastructure must supply dated restore evidence.",
	}, nil
}

func (s *Service) integrationRuntimeStatus() map[string]operations.IntegrationRuntimeStatus {
	out := make(map[string]operations.IntegrationRuntimeStatus, len(s.cfg.Integrations))
	for _, check := range s.cfg.Integrations {
		out[check.ID] = operations.IntegrationRuntimeStatus{
			Configured: check.Configured,
			Detail:     check.Detail,
		}
	}
	return out
}

func (s *Service) GetIntegrations(
	ctx context.Context,
	actor identity.User,
) (operations.PlatformIntegrationState, error) {
	if err := requireAdmin(actor); err != nil {
		return operations.PlatformIntegrationState{}, err
	}
	state, err := s.repo.GetIntegrationSettings(ctx)
	if err != nil {
		return operations.PlatformIntegrationState{}, err
	}
	state.RuntimeStatus = s.integrationRuntimeStatus()
	return state, nil
}

func (s *Service) UpdateIntegrations(
	ctx context.Context,
	actor identity.User,
	patch operations.PlatformIntegrationPatch,
) (operations.PlatformIntegrationState, error) {
	if err := requireAdmin(actor); err != nil {
		return operations.PlatformIntegrationState{}, err
	}
	if patch.ExpectedRevision < 0 {
		return operations.PlatformIntegrationState{}, ErrInvalidInput
	}
	if patch.Auth == nil && patch.Providers == nil && patch.SEO == nil && patch.ContactWidget == nil {
		return operations.PlatformIntegrationState{}, ErrInvalidInput
	}

	current, err := s.repo.GetIntegrationSettings(ctx)
	if err != nil {
		return operations.PlatformIntegrationState{}, err
	}
	next := current.Settings

	if patch.Auth != nil {
		a := *patch.Auth
		a.DefaultRole = strings.TrimSpace(a.DefaultRole)
		if a.DefaultRole != "student" && a.DefaultRole != "parent" {
			return operations.PlatformIntegrationState{}, ErrInvalidInput
		}
		a.RegistrationTitle = strings.TrimSpace(a.RegistrationTitle)
		a.RegistrationSubtitle = strings.TrimSpace(a.RegistrationSubtitle)
		a.TermsLink = strings.TrimSpace(a.TermsLink)
		a.PrivacyLink = strings.TrimSpace(a.PrivacyLink)
		if len(a.RegistrationTitle) > 160 || len(a.RegistrationSubtitle) > 300 ||
			len(a.TermsLink) > 300 || len(a.PrivacyLink) > 300 ||
			a.MaxAccountsPerDevice < 1 || a.MaxAccountsPerDevice > 20 {
			return operations.PlatformIntegrationState{}, ErrInvalidInput
		}
		next.Auth = a
	}

	if patch.Providers != nil {
		if next.Providers == nil {
			next.Providers = map[string]operations.PlatformProviderSetting{}
		}
		for key, item := range patch.Providers {
			if _, ok := operations.DefaultPlatformIntegrationSettings().Providers[key]; !ok {
				return operations.PlatformIntegrationState{}, ErrInvalidInput
			}
			item.Mode = strings.TrimSpace(item.Mode)
			item.Note = strings.TrimSpace(item.Note)
			if item.Mode != "oauth" && item.Mode != "api" && item.Mode != "otp" {
				return operations.PlatformIntegrationState{}, ErrInvalidInput
			}
			if len(item.Note) > 240 {
				return operations.PlatformIntegrationState{}, ErrInvalidInput
			}
			next.Providers[key] = item
		}
	}

	if patch.SEO != nil {
		seo := *patch.SEO
		seo.SiteName = strings.TrimSpace(seo.SiteName)
		seo.DefaultTitle = strings.TrimSpace(seo.DefaultTitle)
		seo.DefaultDescription = strings.TrimSpace(seo.DefaultDescription)
		seo.CanonicalBaseUrl = strings.TrimSpace(seo.CanonicalBaseUrl)
		seo.GoogleAnalyticsId = strings.TrimSpace(seo.GoogleAnalyticsId)
		seo.GoogleTagManagerId = strings.TrimSpace(seo.GoogleTagManagerId)
		if len(seo.SiteName) > 160 || len(seo.DefaultTitle) > 200 || len(seo.DefaultDescription) > 500 ||
			len(seo.CanonicalBaseUrl) > 300 || len(seo.GoogleAnalyticsId) > 80 || len(seo.GoogleTagManagerId) > 80 {
			return operations.PlatformIntegrationState{}, ErrInvalidInput
		}
		next.SEO = seo
	}

	if patch.ContactWidget != nil {
		cw := *patch.ContactWidget
		cw.Channel = strings.TrimSpace(cw.Channel)
		cw.WhatsAppNumber = strings.TrimSpace(cw.WhatsAppNumber)
		cw.WhatsAppMessage = strings.TrimSpace(cw.WhatsAppMessage)
		if cw.Channel != "whatsapp" && cw.Channel != "telegram" && cw.Channel != "phone" {
			return operations.PlatformIntegrationState{}, ErrInvalidInput
		}
		if len(cw.WhatsAppNumber) > 40 || len(cw.WhatsAppMessage) > 500 {
			return operations.PlatformIntegrationState{}, ErrInvalidInput
		}
		next.ContactWidget = cw
	}

	updated, err := s.repo.UpdateIntegrationSettings(ctx, actor.ID, next, patch.ExpectedRevision)
	if err != nil {
		return operations.PlatformIntegrationState{}, err
	}
	updated.RuntimeStatus = s.integrationRuntimeStatus()
	return updated, nil
}

func (s *Service) ListBackups(
	ctx context.Context,
	actor identity.User,
) ([]operations.BackupExportRecord, error) {
	if err := requireAdmin(actor); err != nil {
		return nil, err
	}
	return s.repo.ListBackupExports(ctx, 50)
}

func (s *Service) ExportBackup(
	ctx context.Context,
	actor identity.User,
) (operations.BackupExportResult, error) {
	if err := requireAdmin(actor); err != nil {
		return operations.BackupExportResult{}, err
	}
	return s.repo.CreateBackupExport(ctx, actor.ID, strings.TrimSpace(actor.Email))
}

func (s *Service) ValidateBackup(
	ctx context.Context,
	actor identity.User,
	input operations.BackupValidateInput,
) (operations.BackupValidateResult, error) {
	if err := requireAdmin(actor); err != nil {
		return operations.BackupValidateResult{}, err
	}
	if input.Kind != "almeaa-platform-backup" || input.SchemaVersion != 1 || input.Collections == nil {
		return operations.BackupValidateResult{}, ErrInvalidInput
	}
	summary := make(map[string]int, len(input.Collections))
	totalRecords := 0
	for k, items := range input.Collections {
		if len(k) == 0 || len(k) > 80 {
			return operations.BackupValidateResult{}, ErrInvalidInput
		}
		summary[k] = len(items)
		totalRecords += len(items)
	}
	if err := s.repo.RecordBackupValidation(ctx, actor.ID, summary, totalRecords); err != nil {
		return operations.BackupValidateResult{}, err
	}
	return operations.BackupValidateResult{
		Valid:            true,
		CollectionsCount: len(summary),
		TotalRecords:     totalRecords,
		Summary:          summary,
	}, nil
}
