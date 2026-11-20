package assessmenthttp

import (
	"context"
	app "github.com/nasef6464/almeaago/internal/assessment/application"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type sectionAdvanceRepo struct {
	app.AttemptRepository
	calls                int
	student, id, section string
}

func (r *sectionAdvanceRepo) AdvanceStrictSection(_ context.Context, student, id, section string) (assessment.Attempt, error) {
	r.calls++
	r.student, r.id, r.section = student, id, section
	return assessment.Attempt{ID: id, StudentID: student}, nil
}
func TestStrictSectionAdvanceHTTPBoundaries(t *testing.T) {
	repo := &sectionAdvanceRepo{}
	request := func(role identity.Role, body string, csrf bool) int {
		base := staticAuth{user: identity.User{ID: "student", Roles: []identity.Role{role}}}
		var auth Authenticator = base
		if !csrf {
			auth = rejectedVisibilityCSRF{base}
		}
		h := NewAttempts(app.NewAttemptService(repo), auth)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/attempt/sections/advance", strings.NewReader(body)))
		return w.Code
	}
	if status := request(identity.RoleStudent, `{"expectedSectionId":"section"}`, false); status != 403 {
		t.Fatalf("csrf status %d", status)
	}
	if status := request(identity.RoleTeacher, `{"expectedSectionId":"section"}`, true); status != 403 {
		t.Fatalf("role status %d", status)
	}
	if status := request(identity.RoleStudent, `{}`, true); status != 400 {
		t.Fatalf("empty section status %d", status)
	}
	if status := request(identity.RoleStudent, `{"expectedSectionId":"section"}`, true); status != 200 {
		t.Fatalf("advance status %d", status)
	}
	if repo.calls != 1 || repo.student != "student" || repo.id != "attempt" || repo.section != "section" {
		t.Fatalf("wrong repository call: %+v", repo)
	}
}
