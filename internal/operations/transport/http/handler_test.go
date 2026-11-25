package operationshttp

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	operationsapp "github.com/nasef6464/almeaago/internal/operations/application"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

type authStub struct {
	user    identity.User
	csrfErr error
}

func (a authStub) Authenticate(context.Context, string) (identityapp.Authenticated, error) {
	return identityapp.Authenticated{User: a.user}, nil
}

func (a authStub) VerifyCSRF(identityapp.Authenticated, string) error {
	return a.csrfErr
}

type repoStub struct {
	conflict bool
}

func (r repoStub) ListAudit(context.Context, operations.AuditQuery) (operations.AuditPage, error) {
	return operations.AuditPage{}, nil
}
func (r repoStub) ReadinessCounts(context.Context) (operations.OperationalCounts, error) {
	return operations.OperationalCounts{}, nil
}
func (r repoStub) DependencyHealth(context.Context) operations.DependencyHealth {
	return operations.DependencyHealth{Postgres: true, Redis: true}
}
func (r repoStub) GetIntegrationSettings(context.Context) (operations.PlatformIntegrationState, error) {
	return operations.PlatformIntegrationState{
		Settings: operations.DefaultPlatformIntegrationSettings(),
		Revision: 1,
	}, nil
}
func (r repoStub) UpdateIntegrationSettings(_ context.Context, _ string, next operations.PlatformIntegrationSettings, _ int) (operations.PlatformIntegrationState, error) {
	if r.conflict {
		return operations.PlatformIntegrationState{}, operationsapp.ErrConflict
	}
	return operations.PlatformIntegrationState{Settings: next, Revision: 2}, nil
}
func (r repoStub) ListBackupExports(context.Context, int) ([]operations.BackupExportRecord, error) {
	return []operations.BackupExportRecord{}, nil
}
func (r repoStub) CreateBackupExport(context.Context, string, string) (operations.BackupExportResult, error) {
	return operations.BackupExportResult{}, nil
}
func (r repoStub) RecordBackupValidation(context.Context, string, map[string]int, int) error {
	return nil
}

func TestOperationsIntegrationsEnforcesCSRFAndStrictJSON(t *testing.T) {
	svc := operationsapp.NewService(repoStub{}, operationsapp.Config{})
	admin := identity.User{ID: "admin-1", Roles: []identity.Role{identity.RoleAdmin}}

	// CSRF failure must block PATCH
	hBadCSRF := New(svc, authStub{user: admin, csrfErr: errors.New("bad csrf")})
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPatch, "/integrations", bytes.NewBufferString(`{"contactWidget":{"enabled":true,"channel":"whatsapp","whatsappNumber":"+966500","whatsappMessage":"hi","openInNewTab":true,"showOnPublicPages":true,"showOnDashboardPages":true}}`))
	hBadCSRF.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 on bad csrf, got %d", rec.Code)
	}

	// Unknown JSON field rejected
	h := New(svc, authStub{user: admin})
	rec2 := httptest.NewRecorder()
	req2 := httptest.NewRequest(http.MethodPatch, "/integrations", bytes.NewBufferString(`{"unknownField":true}`))
	h.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 on unknown field, got %d", rec2.Code)
	}

	// Non-admin rejected on backups
	nonAdmin := identity.User{ID: "teacher-1", Roles: []identity.Role{identity.RoleTeacher}}
	hNonAdmin := New(svc, authStub{user: nonAdmin})
	rec3 := httptest.NewRecorder()
	req3 := httptest.NewRequest(http.MethodPost, "/backups/export", nil)
	hNonAdmin.ServeHTTP(rec3, req3)
	if rec3.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for non-admin backup export, got %d", rec3.Code)
	}
}
