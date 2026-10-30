package organizationshttp

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitydomain "github.com/nasef6464/almeaago/internal/identity/domain"
	orgapp "github.com/nasef6464/almeaago/internal/organizations/application"
	orgdomain "github.com/nasef6464/almeaago/internal/organizations/domain"
)

// contractRevisionRepo models a school contract whose modules and revision
// change after a successful administrative write. It is intentionally isolated
// from production data; the database integration gate is a separate check.
type contractRevisionRepo struct {
	contract orgdomain.SchoolContract
	readErr  error
	reads    int
	writes   int
}

func (r *contractRevisionRepo) SchoolContract(_ context.Context, _ string) (orgdomain.SchoolContract, error) {
	r.reads++
	if r.readErr != nil {
		return orgdomain.SchoolContract{}, r.readErr
	}
	return r.contract, nil
}

func (r *contractRevisionRepo) UpsertSchoolContract(
	_ context.Context, _, _ string, input orgdomain.SchoolContractWrite,
) (orgdomain.SchoolContract, error) {
	r.writes++
	if input.ExpectedRevision != r.contract.Revision {
		return orgdomain.SchoolContract{}, orgdomain.ErrConflict
	}
	r.contract.Status = input.Status
	r.contract.Modules = append([]orgdomain.SchoolModule(nil), input.Modules...)
	r.contract.Revision++
	return r.contract, nil
}

func schoolContractRequest(handler http.Handler, method, body string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, "/school-1", strings.NewReader(body))
	if body != "" {
		request.Header.Set("Content-Type", "application/json")
	}
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	return response
}

func requireContractNoStore(t *testing.T, response *httptest.ResponseRecorder) {
	t.Helper()
	if got := response.Header().Get("Cache-Control"); got != "private, no-store" {
		t.Fatalf("school contract response %d must not be cached: Cache-Control=%q, body=%s",
			response.Code, got, response.Body.String())
	}
}

func TestSchoolContractRevisionReadWriteReadCannotReuseStaleModules(t *testing.T) {
	repo := &contractRevisionRepo{contract: orgdomain.SchoolContract{
		ID: "contract-1", SchoolID: "school-1", Status: orgdomain.SchoolContractActive,
		Modules: []orgdomain.SchoolModule{orgdomain.ModuleSchoolAssessments}, Revision: 1,
	}}
	handler := NewSchoolContractHandler(orgapp.NewSchoolContractService(repo), authStub{auth: adminAuth()})

	first := schoolContractRequest(handler, http.MethodGet, "")
	if first.Code != http.StatusOK || !strings.Contains(first.Body.String(), `"revision":1`) {
		t.Fatalf("initial contract read: status=%d body=%s", first.Code, first.Body.String())
	}
	requireContractNoStore(t, first)

	updated := schoolContractRequest(handler, http.MethodPut,
		`{"status":"inactive","modules":[],"expectedRevision":1}`)
	if updated.Code != http.StatusOK || !strings.Contains(updated.Body.String(), `"revision":2`) {
		t.Fatalf("contract update: status=%d body=%s", updated.Code, updated.Body.String())
	}
	requireContractNoStore(t, updated)

	after := schoolContractRequest(handler, http.MethodGet, "")
	if after.Code != http.StatusOK || !strings.Contains(after.Body.String(), `"status":"inactive"`) ||
		!strings.Contains(after.Body.String(), `"revision":2`) ||
		strings.Contains(after.Body.String(), "SCHOOL_ASSESSMENTS") {
		t.Fatalf("contract reload must reflect revocation: status=%d body=%s", after.Code, after.Body.String())
	}
	requireContractNoStore(t, after)

	stale := schoolContractRequest(handler, http.MethodPut,
		`{"status":"active","modules":["SCHOOL_ASSESSMENTS"],"expectedRevision":1}`)
	if stale.Code != http.StatusConflict {
		t.Fatalf("stale revision must not overwrite revocation: status=%d body=%s", stale.Code, stale.Body.String())
	}
	requireContractNoStore(t, stale)

	final := schoolContractRequest(handler, http.MethodGet, "")
	if final.Code != http.StatusOK || !strings.Contains(final.Body.String(), `"status":"inactive"`) ||
		!strings.Contains(final.Body.String(), `"revision":2`) || repo.reads != 3 || repo.writes != 2 {
		t.Fatalf("stale write changed contract or reads were skipped: status=%d body=%s reads=%d writes=%d",
			final.Code, final.Body.String(), repo.reads, repo.writes)
	}
	requireContractNoStore(t, final)
}

func TestSchoolContractFailuresAreNotCached(t *testing.T) {
	teacher := identityapp.Authenticated{User: identitydomain.User{
		ID: "teacher-1", Status: "active", Roles: []identitydomain.Role{identitydomain.RoleTeacher},
	}}
	cases := []struct {
		name   string
		auth   authStub
		repo   *contractRevisionRepo
		method string
		body   string
		want   int
	}{
		{name: "unauthenticated read", auth: authStub{authErr: identityapp.ErrUnauthenticated},
			repo: &contractRevisionRepo{}, method: http.MethodGet, want: http.StatusUnauthorized},
		{name: "unauthorized role", auth: authStub{auth: teacher},
			repo: &contractRevisionRepo{}, method: http.MethodGet, want: http.StatusForbidden},
		{name: "missing contract", auth: authStub{auth: adminAuth()},
			repo: &contractRevisionRepo{readErr: orgdomain.ErrNotFound}, method: http.MethodGet, want: http.StatusNotFound},
		{name: "csrf rejected", auth: authStub{auth: adminAuth(), csrfErr: identityapp.ErrCSRF},
			repo: &contractRevisionRepo{}, method: http.MethodPut,
			body: `{"status":"inactive","modules":[],"expectedRevision":1}`, want: http.StatusForbidden},
		{name: "malformed write", auth: authStub{auth: adminAuth()},
			repo: &contractRevisionRepo{}, method: http.MethodPut,
			body: `{"status":`, want: http.StatusBadRequest},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			handler := NewSchoolContractHandler(orgapp.NewSchoolContractService(tc.repo), tc.auth)
			response := schoolContractRequest(handler, tc.method, tc.body)
			if response.Code != tc.want {
				t.Fatalf("status=%d want=%d body=%s", response.Code, tc.want, response.Body.String())
			}
			requireContractNoStore(t, response)
			if tc.method == http.MethodPut && tc.repo.writes != 0 {
				t.Fatalf("rejected write reached repository: writes=%d", tc.repo.writes)
			}
		})
	}
}
