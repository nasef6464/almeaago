package contenthttp

import (
	"context"
	"errors"
	app "github.com/nasef6464/almeaago/internal/content/application"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type discussionHTTPRepo struct{ app.Repository }

func (discussionHTTPRepo) GetLearnerCourseLesson(context.Context, string, string) (content.LearnerLessonDetail, error) {
	return content.LearnerLessonDetail{LearnerLessonSummary: content.LearnerLessonSummary{IsPreview: true}}, nil
}
func (discussionHTTPRepo) ListLessonDiscussion(_ context.Context, _, _ string, page, _ int) (content.LessonDiscussionPage, error) {
	return content.LessonDiscussionPage{Page: page, Items: []content.LessonDiscussionMessage{{Body: "question"}}}, nil
}
func (discussionHTTPRepo) CreateLessonDiscussion(_ context.Context, _, _, _, parent, body, _ string) (content.LessonDiscussionMessage, error) {
	return content.LessonDiscussionMessage{ParentID: parent, Body: body}, nil
}
func TestLessonDiscussionHTTPRequiresCSRFAndReturnsBoundedShape(t *testing.T) {
	service := app.NewService(discussionHTTPRepo{})
	user := identityapp.Authenticated{User: identity.User{ID: "s", Roles: []identity.Role{identity.RoleStudent}}}
	path := "/courses/c/lessons/l/discussion"
	request := func(auth authStub, method, url, body string) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		NewLearningSpaces(service, auth).ServeHTTP(w, httptest.NewRequest(method, url, strings.NewReader(body)))
		return w
	}
	w := request(authStub{auth: user, csrfErr: errors.New("denied")}, http.MethodPost, path, `{"body":"question"}`)
	if w.Code != 403 {
		t.Fatalf("csrf: %d", w.Code)
	}
	w = request(authStub{auth: user}, http.MethodPost, path, `{"body":"answer","parentId":"p","requestId":"request-123456789"}`)
	if w.Code != 201 || !strings.Contains(w.Body.String(), `"parentId":"p"`) {
		t.Fatalf("post: %d %s", w.Code, w.Body.String())
	}
	w = request(authStub{auth: user}, http.MethodGet, path+"?page=1&limit=1", "")
	if w.Code != 200 || w.Header().Get("Cache-Control") != "private, no-store" || !strings.Contains(w.Body.String(), `"body":"question"`) {
		t.Fatalf("get: %d %s", w.Code, w.Body.String())
	}
	w = request(authStub{auth: user}, http.MethodGet, path+"?page=0", "")
	if w.Code != 400 {
		t.Fatalf("page: %d", w.Code)
	}
}
