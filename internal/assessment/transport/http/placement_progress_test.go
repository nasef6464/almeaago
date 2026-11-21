package assessmenthttp

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	app "github.com/nasef6464/almeaago/internal/assessment/application"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type progressHTTPRepo struct {
	app.PlacementRepository
	student string
}

func (r *progressHTTPRepo) CountLearnerPlacementProgress(_ context.Context, student string, _ assessment.LearnerPlacementQuery) (assessment.PlacementProgress, error) {
	r.student = student
	return assessment.PlacementProgress{Total: 55, Completed: 2}, nil
}

type progressHTTPContent struct{}

func (progressHTTPContent) ValidateAssessmentPlacementTarget(context.Context, string, string, string, string, string, string) (bool, error) {
	return true, nil
}
func (progressHTTPContent) LearnerAssessmentScopeVisible(context.Context, string, string) (bool, error) {
	return true, nil
}

func TestSubjectProgressHTTPRequiresAuthenticationAndDisablesCaching(t *testing.T) {
	repo := &progressHTTPRepo{}
	service := app.NewPlacementService(repo, nil, progressHTTPContent{})
	path := "/subject-progress?pathId=path-1&subjectId=subject-1&slot=training&studentId=other"
	request := func(auth staticAuth) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		NewPlacements(service, auth).ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
		return w
	}
	if w := request(staticAuth{err: errors.New("no session")}); w.Code != http.StatusUnauthorized {
		t.Fatalf("guest status: %d", w.Code)
	}
	w := request(staticAuth{user: identity.User{ID: "student-1", Roles: []identity.Role{identity.RoleStudent}}})
	if w.Code != http.StatusOK || w.Header().Get("Cache-Control") != "private, no-store" || repo.student != "student-1" || !strings.Contains(w.Body.String(), `"completed":2`) {
		t.Fatalf("response %d %s student=%s cache=%s", w.Code, w.Body.String(), repo.student, w.Header().Get("Cache-Control"))
	}
}
