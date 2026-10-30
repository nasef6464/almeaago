package learninghttp

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learningapp "github.com/nasef6464/almeaago/internal/learning/application"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

type strictProgressAuth struct{}

func (strictProgressAuth) Authenticate(context.Context, string) (identityapp.Authenticated, error) {
	return identityapp.Authenticated{User: identity.User{ID: "student-1", Roles: []identity.Role{identity.RoleStudent}}}, nil
}
func (strictProgressAuth) VerifyCSRF(_ identityapp.Authenticated, token string) error {
	if token != "valid-csrf" {
		return errors.New("invalid csrf")
	}
	return nil
}

type strictProgressRepo struct{ writes int }

func (r *strictProgressRepo) GetLessonProgress(_ context.Context, _, lessonID string, ct learning.LessonProgressContext, courseID, topicID string) (learning.LessonProgress, error) {
	return learning.LessonProgress{LessonID: lessonID, ContextType: ct, CourseID: courseID, TopicID: topicID, Status: learning.LessonInProgress}, nil
}
func (r *strictProgressRepo) SaveVideoProgress(_ context.Context, _, lessonID string, ct learning.LessonProgressContext, courseID, topicID string, pos int) (learning.LessonProgress, error) {
	r.writes++
	return learning.LessonProgress{LessonID: lessonID, ContextType: ct, CourseID: courseID, TopicID: topicID, Status: learning.LessonInProgress, PositionSeconds: pos}, nil
}
func (r *strictProgressRepo) CompleteLesson(_ context.Context, _, lessonID string, ct learning.LessonProgressContext, courseID, topicID string) (learning.LessonProgress, error) {
	r.writes++
	return learning.LessonProgress{LessonID: lessonID, ContextType: ct, CourseID: courseID, TopicID: topicID, Status: learning.LessonCompleted}, nil
}

type strictProgressContent struct{}

func (strictProgressContent) ResolveLessonProgressTarget(context.Context, string, string, string) (bool, string, int, error) {
	return true, "video", 120, nil
}

func TestLessonProgressHTTPRejectsAmbiguousPayloadBeforeAnyWrite(t *testing.T) {
	video := `{"contextType":"course","courseId":"course-1","positionSeconds":12}`
	complete := `{"contextType":"course","courseId":"course-1"}`
	for _, tc := range []struct {
		name, method, path, body string
		wantStatus int
		wantWrites int
	}{
		{"video trailing document", http.MethodPut, "/lessons/lesson-1/video", video + video, http.StatusBadRequest, 0},
		{"complete trailing document", http.MethodPost, "/lessons/lesson-1/complete", complete + complete, http.StatusBadRequest, 0},
		{"video unknown field", http.MethodPut, "/lessons/lesson-1/video", `{"contextType":"course","courseId":"course-1","positionSeconds":12,"shadowContext":"other"}`, http.StatusBadRequest, 0},
		{"complete unknown field", http.MethodPost, "/lessons/lesson-1/complete", `{"contextType":"course","courseId":"course-1","shadowContext":"other"}`, http.StatusBadRequest, 0},
		{"video valid with whitespace", http.MethodPut, "/lessons/lesson-1/video", video + " \n\t", http.StatusOK, 1},
		{"complete valid with whitespace", http.MethodPost, "/lessons/lesson-1/complete", complete + " \n\t", http.StatusOK, 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			repo := &strictProgressRepo{}
			handler := NewLessonProgress(learningapp.NewLessonProgressService(repo, strictProgressContent{}), strictProgressAuth{})
			request := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
			request.Header.Set("X-CSRF-Token", "valid-csrf")
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, request)
			if recorder.Code != tc.wantStatus || repo.writes != tc.wantWrites {
				t.Fatalf("status=%d writes=%d, want status=%d writes=%d; response=%s", recorder.Code, repo.writes, tc.wantStatus, tc.wantWrites, recorder.Body.String())
			}
		})
	}
}

func TestLessonProgressHTTPRejectsMissingCSRFWithoutWrite(t *testing.T) {
	repo := &strictProgressRepo{}
	handler := NewLessonProgress(learningapp.NewLessonProgressService(repo, strictProgressContent{}), strictProgressAuth{})
	request := httptest.NewRequest(http.MethodPut, "/lessons/lesson-1/video", strings.NewReader(`{"contextType":"course","courseId":"course-1","positionSeconds":12}`))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusForbidden || repo.writes != 0 {
		t.Fatalf("status=%d writes=%d; want 403 and zero writes", recorder.Code, repo.writes)
	}
}
