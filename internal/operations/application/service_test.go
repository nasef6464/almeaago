package application

import (
	"context"
	"errors"
	"testing"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

type operationsRepoStub struct {
	page         operations.AuditPage
	counts       operations.OperationalCounts
	health       operations.DependencyHealth
	integrations operations.PlatformIntegrationState
	backups      []operations.BackupExportRecord
	calls        int
}

func (s *operationsRepoStub) ListAudit(context.Context, operations.AuditQuery) (operations.AuditPage, error) {
	s.calls++
	return s.page, nil
}
func (s *operationsRepoStub) ReadinessCounts(context.Context) (operations.OperationalCounts, error) {
	return s.counts, nil
}
func (s *operationsRepoStub) DependencyHealth(context.Context) operations.DependencyHealth {
	return s.health
}
func (s *operationsRepoStub) GetIntegrationSettings(context.Context) (operations.PlatformIntegrationState, error) {
	if s.integrations.Revision == 0 {
		return operations.PlatformIntegrationState{
			Settings: operations.DefaultPlatformIntegrationSettings(),
			Revision: 1,
		}, nil
	}
	return s.integrations, nil
}
func (s *operationsRepoStub) UpdateIntegrationSettings(_ context.Context, _ string, next operations.PlatformIntegrationSettings, expectedRevision int) (operations.PlatformIntegrationState, error) {
	s.calls++
	if expectedRevision > 0 && s.integrations.Revision > 0 && expectedRevision != s.integrations.Revision {
		return operations.PlatformIntegrationState{}, ErrConflict
	}
	rev := s.integrations.Revision + 1
	if rev < 2 {
		rev = 2
	}
	s.integrations = operations.PlatformIntegrationState{Settings: next, Revision: rev}
	return s.integrations, nil
}
func (s *operationsRepoStub) ListBackupExports(context.Context, int) ([]operations.BackupExportRecord, error) {
	s.calls++
	return s.backups, nil
}
func (s *operationsRepoStub) CreateBackupExport(context.Context, string, string) (operations.BackupExportResult, error) {
	s.calls++
	return operations.BackupExportResult{}, nil
}
func (s *operationsRepoStub) RecordBackupValidation(context.Context, string, map[string]int, int) error {
	s.calls++
	return nil
}

func operationsActor(role identity.Role) identity.User {
	return identity.User{ID: "actor-1", Roles: []identity.Role{role}}
}

func TestAuditIsPlatformAdminOnly(t *testing.T) {
	repo := &operationsRepoStub{}
	s := NewService(repo, Config{})
	_, err := s.Audit(context.Background(), operationsActor(identity.RoleSupervisor), operations.AuditQuery{})
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
	if repo.calls != 0 {
		t.Fatal("audit repository must not run for non-admin")
	}
}

func TestAuditRejectsUnknownStatus(t *testing.T) {
	repo := &operationsRepoStub{}
	s := NewService(repo, Config{})
	_, err := s.Audit(context.Background(), operationsActor(identity.RoleAdmin), operations.AuditQuery{Status: "unknown"})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
}

func TestReadinessNeverClaimsFullReleaseReadinessWithoutRestoreProof(t *testing.T) {
	repo := &operationsRepoStub{health: operations.DependencyHealth{Postgres: true, Redis: true}}
	s := NewService(repo, Config{Integrations: []operations.IntegrationCheck{{ID: "r2", Configured: true}}})
	out, err := s.Readiness(context.Background(), operationsActor(identity.RoleAdmin))
	if err != nil {
		t.Fatal(err)
	}
	if out.Status != "ready_with_notes" {
		t.Fatalf("expected explicit release evidence note, got %q", out.Status)
	}
	if out.BackupRestoreProof != "external_proof_required" {
		t.Fatalf("restore proof must remain explicit, got %q", out.BackupRestoreProof)
	}
}

func TestReadinessBlocksWhenDependencyFails(t *testing.T) {
	repo := &operationsRepoStub{health: operations.DependencyHealth{Postgres: true, Redis: false}}
	s := NewService(repo, Config{})
	out, err := s.Readiness(context.Background(), operationsActor(identity.RoleAdmin))
	if err != nil {
		t.Fatal(err)
	}
	if out.Status != "blocked" {
		t.Fatalf("expected blocked readiness, got %q", out.Status)
	}
	if out.ReleaseDecision != "blocked_internal_readiness" {
		t.Fatalf("blocked dependency must block internal release decision: %q", out.ReleaseDecision)
	}
}

func TestReadinessSeparatesDeclaredReleaseIdentityFromCertification(t *testing.T) {
	repo := &operationsRepoStub{health: operations.DependencyHealth{Postgres: true, Redis: true}}
	s := NewService(repo, Config{
		Environment:        "staging",
		ReleaseSHA:         "abc123",
		DeploymentProvider: "render",
		SentryConfigured:   true,
	})
	out, err := s.Readiness(context.Background(), operationsActor(identity.RoleAdmin))
	if err != nil {
		t.Fatal(err)
	}
	if out.ReleaseIdentity.CommitSHA != "abc123" || out.ReleaseIdentity.Proof != "declared" {
		t.Fatalf("unexpected release identity: %+v", out.ReleaseIdentity)
	}
	if out.ReleaseDecision != "internal_ready_external_evidence_pending" {
		t.Fatalf("unexpected release decision: %q", out.ReleaseDecision)
	}
	if len(out.ReleaseEvidence) != 5 {
		t.Fatalf("expected five release evidence checks, got %d", len(out.ReleaseEvidence))
	}
	if out.ReleaseEvidence[1].Status != "configured_not_verified" {
		t.Fatalf("observability configuration must not be presented as live proof: %+v", out.ReleaseEvidence[1])
	}
}

func TestReadinessKeepsMissingReleaseIdentityExplicit(t *testing.T) {
	repo := &operationsRepoStub{health: operations.DependencyHealth{Postgres: true, Redis: true}}
	s := NewService(repo, Config{Environment: "production"})
	out, err := s.Readiness(context.Background(), operationsActor(identity.RoleAdmin))
	if err != nil {
		t.Fatal(err)
	}
	if out.ReleaseIdentity.Proof != "external_proof_required" {
		t.Fatalf("missing deployment identity must remain explicit: %+v", out.ReleaseIdentity)
	}
}

func TestIntegrationsAdminRBACAndValidation(t *testing.T) {
	repo := &operationsRepoStub{}
	s := NewService(repo, Config{
		Integrations: []operations.IntegrationCheck{{ID: "google_oauth", Configured: true, Detail: "Google OAuth"}},
	})

	if _, err := s.GetIntegrations(context.Background(), operationsActor(identity.RoleTeacher)); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden for non-admin, got %v", err)
	}
	state, err := s.GetIntegrations(context.Background(), operationsActor(identity.RoleAdmin))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !state.RuntimeStatus["google_oauth"].Configured {
		t.Fatalf("expected runtime status flag to propagate: %+v", state.RuntimeStatus)
	}

	// Reject invalid defaultRole
	badAuth := state.Settings.Auth
	badAuth.DefaultRole = "admin"
	if _, err := s.UpdateIntegrations(context.Background(), operationsActor(identity.RoleAdmin), operations.PlatformIntegrationPatch{
		Auth: &badAuth,
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input for admin defaultRole, got %v", err)
	}

	// Reject unknown provider key
	if _, err := s.UpdateIntegrations(context.Background(), operationsActor(identity.RoleAdmin), operations.PlatformIntegrationPatch{
		Providers: map[string]operations.PlatformProviderSetting{
			"unknown_provider": {Enabled: true, Mode: "oauth"},
		},
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input for unknown provider, got %v", err)
	}

	// Valid update succeeds
	cw := state.Settings.ContactWidget
	cw.WhatsAppNumber = "+966511111111"
	updated, err := s.UpdateIntegrations(context.Background(), operationsActor(identity.RoleAdmin), operations.PlatformIntegrationPatch{
		ContactWidget:    &cw,
		ExpectedRevision: 1,
	})
	if err != nil || updated.Settings.ContactWidget.WhatsAppNumber != "+966511111111" || updated.Revision != 2 {
		t.Fatalf("expected valid update, got %+v err=%v", updated, err)
	}
}

func TestBackupsAdminRBACAndValidation(t *testing.T) {
	repo := &operationsRepoStub{}
	s := NewService(repo, Config{})

	if _, err := s.ListBackups(context.Background(), operationsActor(identity.RoleSupervisor)); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
	if _, err := s.ExportBackup(context.Background(), operationsActor(identity.RoleSchoolAdmin)); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
	if _, err := s.ValidateBackup(context.Background(), operationsActor(identity.RoleAdmin), operations.BackupValidateInput{
		Kind: "wrong", SchemaVersion: 1, Collections: map[string][]any{},
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
	res, err := s.ValidateBackup(context.Background(), operationsActor(identity.RoleAdmin), operations.BackupValidateInput{
		Kind:          "almeaa-platform-backup",
		SchemaVersion: 1,
		Collections:   map[string][]any{"paths": {"p1", "p2"}, "schools": {"s1"}},
	})
	if err != nil || !res.Valid || res.CollectionsCount != 2 || res.TotalRecords != 3 {
		t.Fatalf("unexpected validation result: %+v err=%v", res, err)
	}
}
