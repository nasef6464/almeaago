package assessmenthttp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	app "github.com/nasef6464/almeaago/internal/assessment/application"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type visibilityRepo struct {
	app.Repository
	item assessment.Assessment
}

type rejectedVisibilityCSRF struct{ staticAuth }

func (rejectedVisibilityCSRF) VerifyCSRF(identityapp.Authenticated, string) error {
	return errors.New("invalid csrf")
}

func (r *visibilityRepo) Get(context.Context, string) (assessment.Assessment, error) {
	return r.item, nil
}
func (r *visibilityRepo) SetVisibility(_ context.Context, _, _ string, rev int, visible bool) (assessment.Assessment, error) {
	if rev != r.item.Revision {
		return assessment.Assessment{}, assessment.ErrVersionConflict
	}
	r.item.IsVisible = visible
	r.item.Revision++
	return r.item, nil
}

func TestVisibilityEndpointAuthorizationAndRevision(t *testing.T) {
	repo := &visibilityRepo{item: assessment.Assessment{ID: "test", WorkflowStatus: assessment.WorkflowApproved, Revision: 1, IsPublished: true, IsVisible: true}}
	request := func(role identity.Role, body string) int {
		h := New(app.NewService(repo), staticAuth{user: identity.User{ID: "actor", Roles: []identity.Role{role}}})
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/test/visibility", strings.NewReader(body)))
		return w.Code
	}
	if got := request(identity.RoleTeacher, `{"expectedRevision":1,"isVisible":false}`); got != 403 {
		t.Fatalf("teacher status=%d", got)
	}
	w := httptest.NewRecorder()
	h := New(app.NewService(repo), rejectedVisibilityCSRF{staticAuth{user: identity.User{ID: "actor", Roles: []identity.Role{identity.RoleAdmin}}}})
	h.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/test/visibility", strings.NewReader(`{"expectedRevision":1,"isVisible":false}`)))
	if w.Code != http.StatusForbidden || !repo.item.IsVisible {
		t.Fatalf("invalid csrf changed visibility: %d", w.Code)
	}
	if got := request(identity.RoleAdmin, `{"expectedRevision":1}`); got != 400 {
		t.Fatalf("missing visibility status=%d", got)
	}
	if got := request(identity.RoleAdmin, `{"expectedRevision":1,"isVisible":false}`); got != 200 || repo.item.IsVisible || !repo.item.IsPublished {
		t.Fatalf("hide status=%d item=%+v", got, repo.item)
	}
	if got := request(identity.RoleAdmin, `{"expectedRevision":1,"isVisible":true}`); got != 409 {
		t.Fatalf("stale status=%d", got)
	}
	if got := request(identity.RoleAdmin, `{"expectedRevision":2,"isVisible":true}`); got != 200 || !repo.item.IsVisible {
		t.Fatalf("show status=%d item=%+v", got, repo.item)
	}
}

func TestAssessmentDetailJSONUsesFrontendFieldNames(t *testing.T) {
	repo := &visibilityRepo{item: assessment.Assessment{ID: "test", IsVisible: true, Revision: 1, Version: assessment.Version{PathID: "path"}, Questions: []assessment.QuestionPlacement{{QuestionID: "q", QuestionVersion: 4}}}}
	h := New(app.NewService(repo), staticAuth{user: identity.User{ID: "actor", Roles: []identity.Role{identity.RoleAdmin}}})
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/test", nil))
	var response struct {
		Assessment map[string]json.RawMessage `json:"assessment"`
	}
	if w.Code != http.StatusOK || json.Unmarshal(w.Body.Bytes(), &response) != nil {
		t.Fatalf("response %d %s", w.Code, w.Body.String())
	}
	for _, key := range []string{"id", "isVisible", "revision", "version", "questions"} {
		if _, ok := response.Assessment[key]; !ok {
			t.Fatalf("missing %q in %s", key, w.Body.String())
		}
	}
	var version map[string]json.RawMessage
	var questions []map[string]json.RawMessage
	if json.Unmarshal(response.Assessment["version"], &version) != nil || json.Unmarshal(response.Assessment["questions"], &questions) != nil || len(questions) != 1 {
		t.Fatalf("invalid nested response: %s", w.Body.String())
	}
	if _, ok := version["pathId"]; !ok {
		t.Fatalf("missing pathId in %s", w.Body.String())
	}
	if _, ok := questions[0]["questionVersion"]; !ok {
		t.Fatalf("missing questionVersion in %s", w.Body.String())
	}
}
