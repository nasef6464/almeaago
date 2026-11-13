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
)

type mockPreviewRepo struct {
	*mockAttemptRepo
	hasPlacements bool
	scopes        []assessment.AccessContext
}

func (r *mockPreviewRepo) GetPublishedAccessContext(context.Context, string) (assessment.AccessContext, error) {
	return assessment.AccessContext{AssessmentID: "mock-1", AssessmentKind: assessment.KindMock, BaseAccess: assessment.AccessFree, PathID: "path-1"}, nil
}
func (r *mockPreviewRepo) DirectPlacementAccessContexts(context.Context, string) (bool, []assessment.AccessContext, error) {
	return r.hasPlacements, r.scopes, nil
}

func TestGuestMockAccessReflectsPublishedPlacements(t *testing.T) {
	paid := assessment.AccessContext{AssessmentID: "mock-1", AssessmentKind: assessment.KindMock, BaseAccess: assessment.AccessFree, PlacementSlot: assessment.PlacementTests, PlacementAccess: assessment.PlacementAccessPackage, PathID: "path-1"}
	for _, tc := range []struct {
		name    string
		has     bool
		scopes  []assessment.AccessContext
		allowed bool
		reason  string
	}{
		{"independent free", false, nil, true, "free_assessment"},
		{"package locked", true, []assessment.AccessContext{paid}, false, "package_required"},
		{"hidden only", true, nil, false, "unavailable"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			repo := &mockPreviewRepo{mockAttemptRepo: &mockAttemptRepo{}, hasPlacements: tc.has, scopes: tc.scopes}
			h := New(nil, staticAuth{err: errors.New("guest")}, app.NewAttemptService(repo))
			w := httptest.NewRecorder()
			h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/mock-1/access", nil))
			var result struct {
				Allowed bool   `json:"allowed"`
				Reason  string `json:"reason"`
			}
			if w.Code != http.StatusOK || json.Unmarshal(w.Body.Bytes(), &result) != nil || result.Allowed != tc.allowed || result.Reason != tc.reason {
				t.Fatalf("access=%d %s", w.Code, w.Body.String())
			}
		})
	}
}
