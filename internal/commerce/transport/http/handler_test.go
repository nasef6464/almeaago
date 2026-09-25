package commercehttp

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	commerceapp "github.com/nasef6464/almeaago/internal/commerce/application"
	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitydomain "github.com/nasef6464/almeaago/internal/identity/domain"
	orgdomain "github.com/nasef6464/almeaago/internal/organizations/domain"
)

type contractRepoStub struct {
	contract commerce.SchoolContract
	write    commerce.SchoolContractWrite
	err      error
}

func (r *contractRepoStub) SchoolContractBySchool(
	context.Context,
	string,
) (commerce.SchoolContract, error) {
	if r.err != nil {
		return commerce.SchoolContract{}, r.err
	}
	return r.contract, nil
}

func (r *contractRepoStub) UpsertSchoolContract(
	_ context.Context,
	_ string,
	schoolID string,
	write commerce.SchoolContractWrite,
) (commerce.SchoolContract, error) {
	r.write = write
	if r.err != nil {
		return commerce.SchoolContract{}, r.err
	}
	return commerce.SchoolContract{
		ID:         "contract-1",
		SchoolID:   schoolID,
		Status:     write.Status,
		Modules:    append([]commerce.SchoolModule(nil), write.Modules...),
		ValidFrom:  write.ValidFrom,
		ValidUntil: write.ValidUntil,
	}, nil
}

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

type contextStub struct {
	contexts []orgdomain.SchoolContext
	err      error
}

func (c contextStub) SchoolContexts(
	context.Context,
	identitydomain.User,
) ([]orgdomain.SchoolContext, error) {
	return append([]orgdomain.SchoolContext(nil), c.contexts...), c.err
}

func adminAuth() identityapp.Authenticated {
	return identityapp.Authenticated{User: identitydomain.User{
		ID: "admin-1", Status: "active", Roles: []identitydomain.Role{identitydomain.RoleAdmin},
	}}
}

func teacherAuth() identityapp.Authenticated {
	return identityapp.Authenticated{User: identitydomain.User{
		ID: "teacher-1", Status: "active", Roles: []identitydomain.Role{identitydomain.RoleTeacher},
	}}
}

func TestContractReadRequiresAuthentication(t *testing.T) {
	service := commerceapp.NewSchoolContractService(&contractRepoStub{})
	handler := New(service, authStub{authErr: identityapp.ErrUnauthenticated}, contextStub{})
	request := httptest.NewRequest(http.MethodGet, "/schools/school-1/contract", nil)
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", response.Code)
	}
}

func TestContractMutationRequiresCSRF(t *testing.T) {
	service := commerceapp.NewSchoolContractService(&contractRepoStub{})
	handler := New(service, authStub{auth: adminAuth(), csrfErr: identityapp.ErrCSRF}, contextStub{})
	request := httptest.NewRequest(
		http.MethodPut,
		"/schools/school-1/contract",
		strings.NewReader(`{"status":"active","modules":["SCHOOL_CORE"]}`),
	)
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", response.Code)
	}
}

func TestModuleResolutionDeniesCrossSchoolContext(t *testing.T) {
	repo := &contractRepoStub{contract: commerce.SchoolContract{
		ID: "contract-1", SchoolID: "school-1", Status: commerce.SchoolContractStatusActive,
		Modules: []commerce.SchoolModule{commerce.SchoolModuleSmartClassroom},
	}}
	service := commerceapp.NewSchoolContractService(repo)
	handler := New(service, authStub{auth: teacherAuth()}, contextStub{contexts: []orgdomain.SchoolContext{{
		SchoolID: "school-2", Role: identitydomain.RoleTeacher,
	}}})
	request := httptest.NewRequest(http.MethodGet, "/schools/school-1/modules/SMART_CLASSROOM", nil)
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", response.Code, response.Body.String())
	}
}

func TestModuleResolutionAllowsScopedTeacher(t *testing.T) {
	repo := &contractRepoStub{contract: commerce.SchoolContract{
		ID: "contract-1", SchoolID: "school-1", Status: commerce.SchoolContractStatusActive,
		Modules: []commerce.SchoolModule{commerce.SchoolModuleSmartClassroom},
	}}
	service := commerceapp.NewSchoolContractService(repo)
	handler := New(service, authStub{auth: teacherAuth()}, contextStub{contexts: []orgdomain.SchoolContext{{
		SchoolID: "school-1", Role: identitydomain.RoleTeacher,
	}}})
	request := httptest.NewRequest(http.MethodGet, "/schools/school-1/modules/SMART_CLASSROOM", nil)
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", response.Code, response.Body.String())
	}
	if !strings.Contains(response.Body.String(), `"allowed":true`) {
		t.Fatalf("expected allowed entitlement: %s", response.Body.String())
	}
}

func TestContractMutationRejectsInvalidDateFormat(t *testing.T) {
	service := commerceapp.NewSchoolContractService(&contractRepoStub{})
	handler := New(service, authStub{auth: adminAuth()}, contextStub{})
	request := httptest.NewRequest(
		http.MethodPut,
		"/schools/school-1/contract",
		strings.NewReader(`{"status":"active","modules":["SCHOOL_CORE"],"validFrom":"tomorrow"}`),
	)
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", response.Code, response.Body.String())
	}
}