package organizationshttp

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitydomain "github.com/nasef6464/almeaago/internal/identity/domain"
	orgapp "github.com/nasef6464/almeaago/internal/organizations/application"
)

func schoolAdminAuth() identityapp.Authenticated {
	return identityapp.Authenticated{
		User: identitydomain.User{
			ID:     "director-1",
			Status: "active",
			Roles:  []identitydomain.Role{identitydomain.RoleSchoolAdmin},
		},
	}
}

func TestLegacyDirectorStudentsPreservesResponseShape(t *testing.T) {
	repo := &repoStub{}
	service := orgapp.NewService(repo, repo)
	handler := NewLegacy(service, authStub{auth: schoolAdminAuth()})
	request := httptest.NewRequest(
		http.MethodGet,
		"/director/schools/school-1/students?search=stu",
		nil,
	)
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", response.Code, response.Body.String())
	}
	body := response.Body.String()
	for _, fragment := range []string{
		`"studentId":"student-1"`,
		`"classId":"class-1"`,
		`"className":"Class A"`,
		`"total":1`,
	} {
		if !strings.Contains(body, fragment) {
			t.Fatalf("missing %s in %s", fragment, body)
		}
	}
}

func TestLegacyDirectorMoveStudentRequiresCSRF(t *testing.T) {
	repo := &repoStub{}
	service := orgapp.NewService(repo, repo)
	handler := NewLegacy(service, authStub{
		auth:    schoolAdminAuth(),
		csrfErr: identityapp.ErrCSRF,
	})
	request := httptest.NewRequest(
		http.MethodPut,
		"/director/schools/school-1/students/student-1/class",
		strings.NewReader(`{"classId":"class-2"}`),
	)
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", response.Code, response.Body.String())
	}
}
