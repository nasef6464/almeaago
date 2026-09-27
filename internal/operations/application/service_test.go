package application

import (
	"context"
	"errors"
	"testing"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

type operationsRepoStub struct {
	page   operations.AuditPage
	counts operations.OperationalCounts
	health operations.DependencyHealth
	calls  int
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
}
