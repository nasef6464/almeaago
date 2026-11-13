package assessmenthttp

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	app "github.com/nasef6464/almeaago/internal/assessment/application"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type preparedStageHTTPRepo struct {
	app.Repository
	calls int
}

func (r *preparedStageHTTPRepo) StagePreparedQuiz(context.Context, string, string, assessment.PreparedQuizStage) error {
	r.calls++
	return nil
}
func (r *preparedStageHTTPRepo) GetPreparedQuizStage(context.Context, string) (assessment.PreparedQuizStage, error) {
	return assessment.PreparedQuizStage{Mode: "saher", AudienceType: "public", TargetUsers: []assessment.PreparedQuizGroupMember{{ID: "student-id", Name: "اسم", Email: "student@example.invalid"}}}, nil
}
func (r *preparedStageHTTPRepo) ListPreparedQuizGroups(context.Context) ([]assessment.PreparedQuizGroup, error) {
	return []assessment.PreparedQuizGroup{}, nil
}
func (r *preparedStageHTTPRepo) CreatePreparedQuizGroup(_ context.Context, _ string, g assessment.PreparedQuizGroup) (assessment.PreparedQuizGroup, error) {
	r.calls++
	return g, nil
}
func (r *preparedStageHTTPRepo) ListPreparedQuizGroupMembers(context.Context, string) ([]string, error) {
	return []string{}, nil
}
func (r *preparedStageHTTPRepo) ListPreparedQuizGroupMemberDetails(context.Context, string) ([]assessment.PreparedQuizGroupMember, error) {
	return []assessment.PreparedQuizGroupMember{{ID: "student-id", Name: "اسم", Email: "student@example.invalid"}}, nil
}
func (r *preparedStageHTTPRepo) SetPreparedQuizGroupMember(context.Context, string, string, string, bool) error {
	r.calls++
	return nil
}
func (r *preparedStageHTTPRepo) ListPreparedQuizzes(_ context.Context, student string) ([]assessment.PreparedQuizCard, error) {
	return []assessment.PreparedQuizCard{{ID: student, Title: "اختبار", Mode: "saher", QuestionCount: 1}}, nil
}

func TestPreparedQuizListIsStudentOnly(t *testing.T) {
	repo := &preparedStageHTTPRepo{}
	student := staticAuth{user: identity.User{ID: "student-id", Roles: []identity.Role{identity.RoleStudent}}}
	teacher := staticAuth{user: identity.User{ID: "teacher-id", Roles: []identity.Role{identity.RoleTeacher}}}
	request := func(auth Authenticator) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		New(app.NewService(repo), auth).ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/prepared-available", nil))
		return w
	}
	if w := request(teacher); w.Code != http.StatusForbidden {
		t.Fatalf("teacher %d", w.Code)
	}
	if w := request(student); w.Code != http.StatusOK || !strings.Contains(w.Body.String(), "student-id") || w.Header().Get("Cache-Control") != "private, no-store" {
		t.Fatalf("student %d %s", w.Code, w.Body.String())
	}
}

func TestPreparedQuizAudienceDenialIsForbidden(t *testing.T) {
	for _, writer := range []func(http.ResponseWriter, error){writeAttemptError, writeError} {
		w := httptest.NewRecorder()
		writer(w, assessment.ErrPreparedQuizAccessDenied)
		if w.Code != http.StatusForbidden {
			t.Fatalf("got %d, want 403", w.Code)
		}
	}
}

func TestPreparedQuizGroupsHTTPRequiresAdminAndCSRF(t *testing.T) {
	repo := &preparedStageHTTPRepo{}
	admin := staticAuth{user: identity.User{ID: "00000000-0000-0000-0000-000000000001", Roles: []identity.Role{identity.RoleAdmin}}}
	teacher := staticAuth{user: identity.User{ID: "00000000-0000-0000-0000-000000000001", Roles: []identity.Role{identity.RoleTeacher}}}
	request := func(method, path, body string, auth Authenticator) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		New(app.NewService(repo), auth).ServeHTTP(w, httptest.NewRequest(method, path, strings.NewReader(body)))
		return w
	}
	body := `{"name":"مجموعة","groupType":"PRIVATE_GROUP"}`
	if w := request(http.MethodPost, "/prepared-groups", body, rejectedVisibilityCSRF{admin}); w.Code != http.StatusForbidden {
		t.Fatalf("csrf %d", w.Code)
	}
	if w := request(http.MethodPost, "/prepared-groups", body, teacher); w.Code != http.StatusForbidden {
		t.Fatalf("teacher %d", w.Code)
	}
	if w := request(http.MethodPost, "/prepared-groups", body, admin); w.Code != http.StatusCreated {
		t.Fatalf("create %d %s", w.Code, w.Body.String())
	}
	if w := request(http.MethodGet, "/prepared-groups/00000000-0000-0000-0000-000000000003/members", "", admin); w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"userIds":["student-id"]`) || !strings.Contains(w.Body.String(), `"email":"student@example.invalid"`) {
		t.Fatalf("member details %d %s", w.Code, w.Body.String())
	}
	path := "/prepared-groups/00000000-0000-0000-0000-000000000003/members/00000000-0000-0000-0000-000000000004"
	if w := request(http.MethodPut, path, "", teacher); w.Code != http.StatusForbidden {
		t.Fatalf("teacher member %d", w.Code)
	}
	if w := request(http.MethodPut, path, "", admin); w.Code != http.StatusOK {
		t.Fatalf("add %d %s", w.Code, w.Body.String())
	}
	if w := request(http.MethodDelete, path, "", admin); w.Code != http.StatusOK {
		t.Fatalf("remove %d %s", w.Code, w.Body.String())
	}
	if repo.calls != 3 {
		t.Fatalf("calls %d", repo.calls)
	}
}

func TestPreparedQuizStageHTTPIsAdminOnlyAndInactive(t *testing.T) {
	repo := &preparedStageHTTPRepo{}
	id := "00000000-0000-0000-0000-000000000003"
	user := "00000000-0000-0000-0000-000000000001"
	request := func(method string, auth Authenticator, body string) *httptest.ResponseRecorder {
		h := New(app.NewService(repo), auth)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest(method, "/"+id+"/prepared-staging", strings.NewReader(body)))
		return w
	}
	admin := staticAuth{user: identity.User{ID: user, Roles: []identity.Role{identity.RoleAdmin}}}
	teacher := staticAuth{user: identity.User{ID: user, Roles: []identity.Role{identity.RoleTeacher}}}
	body := `{"mode":"saher","audienceType":"public"}`
	if w := request(http.MethodPut, rejectedVisibilityCSRF{admin}, body); w.Code != http.StatusForbidden {
		t.Fatalf("csrf: %d", w.Code)
	}
	if w := request(http.MethodPut, teacher, body); w.Code != http.StatusForbidden {
		t.Fatalf("teacher: %d", w.Code)
	}
	if w := request(http.MethodPut, admin, body); w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"active":false`) || repo.calls != 1 {
		t.Fatalf("admin: %d %s calls=%d", w.Code, w.Body.String(), repo.calls)
	}
	if w := request(http.MethodGet, teacher, ""); w.Code != http.StatusForbidden {
		t.Fatalf("teacher read: %d", w.Code)
	}
	if w := request(http.MethodGet, admin, ""); w.Code != http.StatusOK || w.Header().Get("Cache-Control") != "private, no-store" || !strings.Contains(w.Body.String(), `"targetUsers":[{"id":"student-id","name":"اسم","email":"student@example.invalid"}]`) {
		t.Fatalf("admin read: %d %s", w.Code, w.Body.String())
	}
}
