package organizationshttp

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitydomain "github.com/nasef6464/almeaago/internal/identity/domain"
	orgapp "github.com/nasef6464/almeaago/internal/organizations/application"
	orgdomain "github.com/nasef6464/almeaago/internal/organizations/domain"
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

func TestLegacyDirectorOverviewHasSixCanonicalMetricsAndSchoolScope(t *testing.T) {
	const school = "00000000-0000-0000-0000-000000000101"
	repo := &repoStub{
		allowedSchoolID: school,
		directorOverview: orgdomain.DirectorOverview{
			School:  orgdomain.DirectorOverviewSchool{SchoolID: school, SchoolName: "مدرسة المئة"},
			Metrics: orgdomain.DirectorOverviewMetrics{Students: 12, Classes: 3, Teachers: 2, Supervisors: 1, SchoolAssessments: 5, CompletedSmartClasses: 4},
			Classes: []orgdomain.DirectorOverviewClass{{ClassID: "class-1", ClassName: "الأول أ"}},
		},
	}
	handler := NewLegacy(orgapp.NewService(repo, repo), authStub{auth: schoolAdminAuth()})
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/director/schools/"+school+"/overview", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", response.Code, response.Body.String())
	}
	var raw struct {
		Metrics map[string]json.RawMessage `json:"metrics"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &raw); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"students", "classes", "teachers", "supervisors", "schoolAssessments", "completedSmartClasses"} {
		if _, ok := raw.Metrics[key]; !ok {
			t.Fatalf("missing literal Node-compatible JSON metric %q in %s", key, response.Body.String())
		}
	}
	if len(raw.Metrics) != 6 {
		t.Fatalf("unexpected extra metrics: %v", raw.Metrics)
	}
	var parsed struct {
		School  orgdomain.DirectorOverviewSchool  `json:"school"`
		Metrics orgdomain.DirectorOverviewMetrics `json:"metrics"`
		Classes []orgdomain.DirectorOverviewClass `json:"classes"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &parsed); err != nil {
		t.Fatal(err)
	}
	if parsed.School.SchoolID != school || parsed.Metrics.Students != 12 || parsed.Metrics.Classes != 3 || parsed.Metrics.Teachers != 2 || parsed.Metrics.Supervisors != 1 || parsed.Metrics.SchoolAssessments != 5 || parsed.Metrics.CompletedSmartClasses != 4 || len(parsed.Classes) != 1 {
		t.Fatalf("overview contract mismatch: %+v", parsed)
	}
	if repo.lastDirectorOverviewSchool != school {
		t.Fatalf("read did not retain authorized school ID: %q", repo.lastDirectorOverviewSchool)
	}

	denied := httptest.NewRecorder()
	handler.ServeHTTP(denied, httptest.NewRequest(http.MethodGet, "/director/schools/00000000-0000-0000-0000-000000000102/overview", nil))
	if denied.Code != http.StatusForbidden || repo.lastDirectorOverviewSchool != school {
		t.Fatalf("cross-school read was not denied: status=%d directorySchool=%q", denied.Code, repo.lastDirectorOverviewSchool)
	}
}

func TestLegacyDirectorAcademicAssessmentsRequiresModuleAndSchoolPermission(t *testing.T) {
	const schoolA = "00000000-0000-0000-0000-000000000101"
	const schoolB = "00000000-0000-0000-0000-000000000102"
	repo := &repoStub{contexts: []orgdomain.SchoolContext{{
		SchoolID: schoolA, Role: identitydomain.RoleSchoolAdmin,
		Permissions: []string{orgdomain.PermissionSchoolAssessmentsManage},
		Modules:     []string{string(orgdomain.ModuleSchoolAssessments)},
	}}}
	handler := NewLegacy(orgapp.NewService(repo, repo), authStub{auth: schoolAdminAuth()})
	request := func(school string) *httptest.ResponseRecorder {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/director/schools/"+school+"/academic/assessments", nil))
		return response
	}
	authorized := request(schoolA)
	if authorized.Code != http.StatusOK {
		t.Fatalf("authorized GET: status %d: %s", authorized.Code, authorized.Body.String())
	}
	var body map[string]json.RawMessage
	if err := json.Unmarshal(authorized.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if string(body["assessments"]) != "[]" || string(body["classes"]) != "[]" {
		t.Fatalf("wrong empty workspace response: %s", authorized.Body.String())
	}
	if denied := request(schoolB); denied.Code != http.StatusForbidden {
		t.Fatalf("cross-school access: %d", denied.Code)
	}
	if denied := request("bad-uuid"); denied.Code != http.StatusBadRequest {
		t.Fatalf("malformed UUID: %d", denied.Code)
	}
	repo.contexts[0].Modules = nil
	if denied := request(schoolA); denied.Code != http.StatusForbidden {
		t.Fatalf("missing contract: %d", denied.Code)
	}
	repo.contexts[0].Modules = []string{string(orgdomain.ModuleSchoolAssessments)}
	repo.contexts[0].Permissions = nil
	if denied := request(schoolA); denied.Code != http.StatusForbidden {
		t.Fatalf("missing permission: %d", denied.Code)
	}
}
