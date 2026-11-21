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

type selfHTTPRepo struct{ calls int }

func (r *selfHTTPRepo) CreateSelfQuizSnapshot(_ context.Context, _ string, _ assessment.SelfQuizInput, _ []assessment.EligibleSelfQuizQuestion) (string, error) {
	r.calls++
	return "existing", nil
}
func (*selfHTTPRepo) ResolveSelfQuizSkills(context.Context, []string) ([]assessment.SelfQuizSkillScope, error) {
	return nil, nil
}
func (*selfHTTPRepo) ListSelfQuizCandidates(context.Context, assessment.SelfQuizInput) ([]assessment.EligibleSelfQuizQuestion, error) {
	return nil, nil
}
func (*selfHTTPRepo) GetAttempt(context.Context, string) (assessment.Attempt, error) {
	return assessment.Attempt{ID: "existing", StudentID: "student"}, nil
}
func (*selfHTTPRepo) LatestSelfQuizAttempt(context.Context, string) (string, error) {
	return "existing", nil
}

func TestResumeSelfQuizRequiresOwnerAndStudent(t *testing.T) {
	repo := &selfHTTPRepo{}
	for _, tc := range []struct {
		name string
		user identity.User
		want int
	}{
		{"owner", identity.User{ID: "student", Roles: []identity.Role{identity.RoleStudent}}, http.StatusOK},
		{"other student", identity.User{ID: "other", Roles: []identity.Role{identity.RoleStudent}}, http.StatusForbidden},
		{"teacher", identity.User{ID: "student", Roles: []identity.Role{identity.RoleTeacher}}, http.StatusForbidden},
	} {
		t.Run(tc.name, func(t *testing.T) {
			h := NewAttempts(nil, staticAuth{user: tc.user}, app.NewSelfQuizService(repo))
			w := httptest.NewRecorder()
			h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/self/current", nil))
			if w.Code != tc.want {
				t.Fatalf("got %d want %d: %s", w.Code, tc.want, w.Body.String())
			}
			if tc.want == http.StatusOK && w.Header().Get("Cache-Control") != "private, no-store" {
				t.Fatalf("unexpected cache policy: %q", w.Header().Get("Cache-Control"))
			}
		})
	}
}

func TestSelfQuizHTTPRequiresStudentAndCSRF(t *testing.T) {
	repo := &selfHTTPRepo{}
	body := `{"questionCount":10,"timeLimitMinutes":10,"startKey":"key"}`
	request := func(role identity.Role, csrf bool) *httptest.ResponseRecorder {
		base := staticAuth{user: identity.User{ID: "student", Roles: []identity.Role{role}}}
		var auth Authenticator = base
		if !csrf {
			auth = rejectedVisibilityCSRF{base}
		}
		h := NewAttempts(nil, auth, app.NewSelfQuizService(repo))
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/self", strings.NewReader(body)))
		return w
	}
	if w := request(identity.RoleStudent, false); w.Code != http.StatusForbidden {
		t.Fatalf("csrf: %d", w.Code)
	}
	if w := request(identity.RoleTeacher, true); w.Code != http.StatusForbidden {
		t.Fatalf("role: %d", w.Code)
	}
	w := request(identity.RoleStudent, true)
	if w.Code != http.StatusOK || w.Header().Get("Cache-Control") != "private, no-store" || repo.calls != 1 {
		t.Fatalf("student request: %d %q calls=%d", w.Code, w.Body.String(), repo.calls)
	}
}
