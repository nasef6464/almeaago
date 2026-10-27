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

func TestLegacyDirectorCreateAssessmentEnforcesScopePermissionAndCSRF(t *testing.T) {
	const schoolA = "00000000-0000-0000-0000-000000000101"
	const schoolB = "00000000-0000-0000-0000-000000000102"
	const classroom = "00000000-0000-0000-0000-000000000201"
	const path = "00000000-0000-0000-0000-000000000301"
	const subject = "00000000-0000-0000-0000-000000000302"
	const question = "00000000-0000-0000-0000-000000000401"
	const key = "00000000-0000-0000-0000-000000000501"
	repo := &repoStub{contexts: []orgdomain.SchoolContext{{
		SchoolID: schoolA, Role: identitydomain.RoleSchoolAdmin,
		Permissions: []string{orgdomain.PermissionSchoolAssessmentsManage},
		Modules:     []string{string(orgdomain.ModuleSchoolAssessments)},
	}}}
	body := `{"title":"اختبار مدرسي","classId":"` + classroom + `","targetScope":"class","pathId":"` + path + `","subjectId":"` + subject + `","questionIds":["` + question + `"]}`
	request := func(auth authStub, schoolID, payload, token string) *httptest.ResponseRecorder {
		t.Helper()
		handler := NewLegacy(orgapp.NewService(repo, repo), auth)
		req := httptest.NewRequest(http.MethodPost, "/director/schools/"+schoolID+"/academic/assessments", strings.NewReader(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Idempotency-Key", token)
		resp := httptest.NewRecorder()
		handler.ServeHTTP(resp, req)
		return resp
	}
	good := request(authStub{auth: schoolAdminAuth()}, schoolA, body, key)
	if good.Code != http.StatusCreated || !strings.Contains(good.Body.String(), `"assessmentId"`) || !strings.Contains(good.Body.String(), `"targetScope":"class"`) {
		t.Fatalf("expected school assessment 201; got %d %s", good.Code, good.Body.String())
	}
	if forbidden := request(authStub{auth: schoolAdminAuth()}, schoolB, body, key); forbidden.Code != http.StatusForbidden {
		t.Fatalf("wrong school must not create: %d", forbidden.Code)
	}
	if denied := request(authStub{auth: schoolAdminAuth(), csrfErr: identityapp.ErrCSRF}, schoolA, body, key); denied.Code != http.StatusForbidden {
		t.Fatalf("CSRF bypassed: %d", denied.Code)
	}
	if invalid := request(authStub{auth: schoolAdminAuth()}, schoolA, body, "invalid"); invalid.Code != http.StatusBadRequest {
		t.Fatalf("missing idempotency token validation: %d", invalid.Code)
	}
	if invalid := request(authStub{auth: schoolAdminAuth()}, schoolA, `{"title":"اختبار","targetScope":"class","pathId":"`+path+`","subjectId":"`+subject+`","questionIds":["`+question+`"]}`, key); invalid.Code != http.StatusBadRequest {
		t.Fatalf("class without classId must fail: %d", invalid.Code)
	}
	schoolPayload := `{"title":"اختبار المدرسة","targetScope":"school","pathId":"` + path + `","subjectId":"` + subject + `","questionIds":["` + question + `"]}`
	if created := request(authStub{auth: schoolAdminAuth()}, schoolA, schoolPayload, key); created.Code != http.StatusCreated || !strings.Contains(created.Body.String(), `"targetScope":"school"`) {
		t.Fatalf("whole-school explicit target failed: %d %s", created.Code, created.Body.String())
	}
	repo.contexts[0].Modules = nil
	if denied := request(authStub{auth: schoolAdminAuth()}, schoolA, body, key); denied.Code != http.StatusForbidden {
		t.Fatalf("module gate bypassed: %d", denied.Code)
	}
}

func TestLegacyDirectorAssessmentPickerDoesNotExposeGlobalStaffQuestionBank(t *testing.T) {
	const school = "00000000-0000-0000-0000-000000000101"
	const path = "00000000-0000-0000-0000-000000000301"
	const subject = "00000000-0000-0000-0000-000000000302"
	repo := &repoStub{contexts: []orgdomain.SchoolContext{{
		SchoolID: school, Role: identitydomain.RoleSchoolAdmin,
		Permissions: []string{orgdomain.PermissionSchoolAssessmentsManage},
		Modules:     []string{string(orgdomain.ModuleSchoolAssessments)},
	}}}
	handler := NewLegacy(orgapp.NewService(repo, repo), authStub{auth: schoolAdminAuth()})
	request := func(url string) *httptest.ResponseRecorder {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, url, nil))
		return response
	}
	url := "/director/schools/" + school + "/academic/available-questions?pathId=" + path + "&subjectId=" + subject + "&limit=30"
	if response := request(url); response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"items":[]`) {
		t.Fatalf("scoped approved picker should be accessible: %d %s", response.Code, response.Body.String())
	}
	if denied := request(strings.Replace(url, "limit=30", "limit=999", 1)); denied.Code != http.StatusBadRequest {
		t.Fatalf("unbounded picker must fail: %d", denied.Code)
	}
	if denied := request(strings.Replace(url, school, "00000000-0000-0000-0000-000000000102", 1)); denied.Code != http.StatusForbidden {
		t.Fatalf("wrong-school picker must fail: %d", denied.Code)
	}
	repo.contexts[0].Permissions = nil
	if denied := request(url); denied.Code != http.StatusForbidden {
		t.Fatalf("missing school permission must fail: %d", denied.Code)
	}
}
