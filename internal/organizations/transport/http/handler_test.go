package organizationshttp

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitydomain "github.com/nasef6464/almeaago/internal/identity/domain"
	orgapp "github.com/nasef6464/almeaago/internal/organizations/application"
	orgdomain "github.com/nasef6464/almeaago/internal/organizations/domain"
)

type authStub struct {
	auth    identityapp.Authenticated
	authErr error
	csrfErr error
}

func (a authStub) Authenticate(context.Context, string) (identityapp.Authenticated, error) {
	return a.auth, a.authErr
}

func (a authStub) VerifyCSRF(identityapp.Authenticated, string) error {
	return a.csrfErr
}

type repoStub struct {
	page orgdomain.SchoolPage
}

func (r *repoStub) ListSchools(context.Context, orgdomain.AccessContext, orgdomain.SchoolListQuery) (orgdomain.SchoolPage, error) {
	return r.page, nil
}
func (r *repoStub) SchoolByID(context.Context, orgdomain.AccessContext, string) (orgdomain.School, error) {
	return orgdomain.School{}, orgdomain.ErrNotFound
}
func (r *repoStub) CreateSchool(context.Context, string, orgdomain.SchoolWrite) (orgdomain.School, error) {
	return orgdomain.School{ID: "school-1", Code: "SCH-1", Name: "School", Status: orgdomain.SchoolStatusActive}, nil
}
func (r *repoStub) UpdateSchool(context.Context, string, string, orgdomain.SchoolPatch) (orgdomain.School, error) {
	return orgdomain.School{}, nil
}
func (r *repoStub) ArchiveSchool(context.Context, string, string) (orgdomain.School, error) {
	return orgdomain.School{}, nil
}
func (r *repoStub) ListClasses(context.Context, orgdomain.AccessContext, string, orgdomain.ClassListQuery) (orgdomain.ClassPage, error) {
	return orgdomain.ClassPage{}, nil
}
func (r *repoStub) CreateClass(context.Context, string, string, orgdomain.ClassWrite) (orgdomain.Class, error) {
	return orgdomain.Class{}, nil
}
func (r *repoStub) UpdateClass(context.Context, string, string, string, orgdomain.ClassPatch) (orgdomain.Class, error) {
	return orgdomain.Class{}, nil
}
func (r *repoStub) ArchiveClass(context.Context, string, string, string) (orgdomain.Class, error) {
	return orgdomain.Class{}, nil
}
func (r *repoStub) Roster(context.Context, orgdomain.AccessContext, string, orgdomain.RosterQuery) (orgdomain.RosterPage, error) {
	return orgdomain.RosterPage{}, nil
}
func (r *repoStub) CanAccessSchool(context.Context, orgdomain.AccessContext, string) (bool, error) {
	return true, nil
}
func (r *repoStub) CanManageSchool(context.Context, string, string) (bool, error) {
	return true, nil
}
func (r *repoStub) HasSchoolPermission(context.Context, string, string, string) (bool, error) {
	return true, nil
}

func adminAuth() identityapp.Authenticated {
	return identityapp.Authenticated{User: identitydomain.User{
		ID: "admin-1", Status: "active", Roles: []identitydomain.Role{identitydomain.RoleAdmin},
	}}
}

func TestListSchoolsRequiresSession(t *testing.T) {
	service := orgapp.NewService(&repoStub{})
	handler := New(service, authStub{authErr: identityapp.ErrUnauthenticated})
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", response.Code)
	}
}

func TestCreateSchoolRequiresCSRF(t *testing.T) {
	service := orgapp.NewService(&repoStub{})
	handler := New(service, authStub{auth: adminAuth(), csrfErr: identityapp.ErrCSRF})
	request := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"School"}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", response.Code)
	}
}

func TestAdminCanListSchools(t *testing.T) {
	service := orgapp.NewService(&repoStub{
		page: orgdomain.SchoolPage{
			Schools: []orgdomain.School{{ID: "school-1", Code: "SCH-1", Name: "School", Status: orgdomain.SchoolStatusActive}},
			Page:    1, Limit: 50, Total: 1,
		},
	})
	handler := New(service, authStub{auth: adminAuth()})
	request := httptest.NewRequest(http.MethodGet, "/?page=1&limit=50", nil)
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", response.Code, response.Body.String())
	}
	if !strings.Contains(response.Body.String(), `"total":1`) {
		t.Fatalf("unexpected response %s", response.Body.String())
	}
}

func TestParsePageLimitRejectsUnboundedRequests(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/?limit=101", nil)
	var page, limit int
	if err := parsePageLimit(request, &page, &limit); !errors.Is(err, orgapp.ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
}

func TestParseRosterRejectsInvalidBoolean(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/?isActive=maybe", nil)
	if _, err := parseRosterQuery(request); !errors.Is(err, orgapp.ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
}
