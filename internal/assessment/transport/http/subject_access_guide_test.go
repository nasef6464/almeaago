package assessmenthttp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	app "github.com/nasef6464/almeaago/internal/assessment/application"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type guideHTTPRepo struct{ app.PlacementRepository }

func (guideHTTPRepo) ListSubjectGuidePlacementGroups(context.Context, string, string) ([]assessment.GuidePlacementGroup, error) {
	return nil, nil
}

type guideHTTPContent struct{}

func (guideHTTPContent) LearnerAssessmentScopeVisible(context.Context, string, string) (bool, error) {
	return true, nil
}
func (guideHTTPContent) ValidateAssessmentPlacementTarget(context.Context, string, string, string, string, string, string) (bool, error) {
	return true, nil
}
func (guideHTTPContent) CountSubjectAccessContent(context.Context, string, string) (content.SubjectAccessGuideCounts, error) {
	return content.SubjectAccessGuideCounts{FoundationFree: 1}, nil
}

func TestSubjectAccessGuideHTTPGuestAndPrivateCaching(t *testing.T) {
	service := app.NewPlacementService(guideHTTPRepo{}, nil, guideHTTPContent{})
	call := func(auth staticAuth, query string) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		NewPlacements(service, auth).ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/subject-access-guide?"+query, nil))
		return w
	}
	guest := call(staticAuth{err: errors.New("no session")}, "pathId=path&subjectId=subject")
	var result assessment.SubjectAccessGuide
	if guest.Code != http.StatusOK || guest.Header().Get("Cache-Control") != "private, no-store" || json.Unmarshal(guest.Body.Bytes(), &result) != nil || result.Complete || len(result.Unavailable) != 1 || result.Unavailable[0] != "courses" || !result.Categories[0].HasFree {
		t.Fatalf("guest %d %s", guest.Code, guest.Body.String())
	}
	if bad := call(staticAuth{err: errors.New("no session")}, "pathId=path"); bad.Code != http.StatusBadRequest {
		t.Fatalf("missing subject=%d", bad.Code)
	}
	if denied := call(staticAuth{user: identity.User{ID: "other", Roles: []identity.Role{identity.RoleParent}}}, "pathId=path&subjectId=subject"); denied.Code != http.StatusForbidden {
		t.Fatalf("unsupported role=%d", denied.Code)
	}
}
