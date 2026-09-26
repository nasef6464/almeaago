package application

import (
	"context"
	"testing"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

type studyPlanCatalogRepoStub struct {
	items []assessment.StudyPlanResource
}

func (s studyPlanCatalogRepoStub) ListStudyPlanResources(context.Context, string, string, []string, []string, int) ([]assessment.StudyPlanResource, error) {
	return s.items, nil
}

func TestStudyPlanCatalogExcludesCommerceLockedAssessment(t *testing.T) {
	repo := studyPlanCatalogRepoStub{items: []assessment.StudyPlanResource{
		{
			PlacementID: "free", AssessmentID: "a-free", AssessmentKind: assessment.KindNormal,
			BaseAccessType: assessment.AccessFree, PlacementAccess: assessment.PlacementAccessInherit,
			SubjectID: "subject-1", Slot: assessment.PlacementTests,
		},
		{
			PlacementID: "paid", AssessmentID: "a-paid", AssessmentKind: assessment.KindNormal,
			BaseAccessType: assessment.AccessPaid, PlacementAccess: assessment.PlacementAccessInherit,
			SubjectID: "subject-1", Slot: assessment.PlacementTests,
		},
	}}
	commerce := &recordingCommerceAccess{commerceAccessStub: commerceAccessStub{allowed: false, reason: "paid_required"}}
	catalog := NewStudyPlanCatalog(repo, commerce)
	items, err := catalog.ListStudyPlanResources(context.Background(), "student-1", "path-1", []string{"subject-1"}, nil, 20)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].PlacementID != "free" {
		t.Fatalf("unexpected adaptive assessment candidates: %#v", items)
	}
	if commerce.calls != 1 {
		t.Fatalf("expected one commerce check for paid candidate, got %d", commerce.calls)
	}
}
