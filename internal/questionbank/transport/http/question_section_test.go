package questionhttp

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	questionapp "github.com/nasef6464/almeaago/internal/questionbank/application"
)

type sectionHTTPRepo struct {
	repoStub
	calls int
}

func (r *sectionHTTPRepo) GetQuestionSection(context.Context, string) (string, error) {
	r.calls++
	return "00000000-0000-0000-0000-000000000004", nil
}
func (r *sectionHTTPRepo) SetQuestionSection(context.Context, string, string, string) error {
	r.calls++
	return nil
}

func TestQuestionSectionHTTPRequiresAdminAndCSRF(t *testing.T) {
	repo := &sectionHTTPRepo{}
	user := "00000000-0000-0000-0000-000000000001"
	admin := identityapp.Authenticated{User: identity.User{ID: user, Roles: []identity.Role{identity.RoleAdmin}}}
	student := identityapp.Authenticated{User: identity.User{ID: user, Roles: []identity.Role{identity.RoleStudent}}}
	path := "/00000000-0000-0000-0000-000000000003/section"
	call := func(method, body string, auth authStub) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		New(questionapp.NewService(repo), auth).ServeHTTP(w, httptest.NewRequest(method, path, strings.NewReader(body)))
		return w
	}
	if w := call(http.MethodGet, "", authStub{auth: student}); w.Code != http.StatusForbidden {
		t.Fatalf("student read: %d", w.Code)
	}
	if w := call(http.MethodPut, `{"sectionId":""}`, authStub{auth: admin, csrfErr: errors.New("csrf")}); w.Code != http.StatusForbidden {
		t.Fatalf("csrf: %d", w.Code)
	}
	if w := call(http.MethodPut, `{}`, authStub{auth: admin}); w.Code != http.StatusBadRequest {
		t.Fatalf("missing section: %d", w.Code)
	}
	if repo.calls != 0 {
		t.Fatalf("unexpected repository calls: %d", repo.calls)
	}
	if w := call(http.MethodGet, "", authStub{auth: admin}); w.Code != http.StatusOK || w.Header().Get("Cache-Control") != "private, no-store" || !strings.Contains(w.Body.String(), `"sectionId":"00000000-0000-0000-0000-000000000004"`) {
		t.Fatalf("admin read: %d %s", w.Code, w.Body.String())
	}
	if w := call(http.MethodPut, `{"sectionId":""}`, authStub{auth: admin}); w.Code != http.StatusOK {
		t.Fatalf("admin clear: %d %s", w.Code, w.Body.String())
	}
}
