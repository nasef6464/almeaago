package application

import (
	"context"
	"errors"
	"testing"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

type directPlacementRepo struct {
	*fakeAttemptRepo
	hasPlacements bool
	visibleScopes []assessment.AccessContext
}

func (r *directPlacementRepo) DirectPlacementAccessContexts(context.Context, string) (bool, []assessment.AccessContext, error) {
	return r.hasPlacements, r.visibleScopes, nil
}

func TestDirectStartAndSingleShotRespectLearningPlacements(t *testing.T) {
	base := assessment.AccessContext{AssessmentID: "exam", AssessmentKind: assessment.KindNormal, BaseAccess: assessment.AccessFree, PathID: "path", SubjectID: "subject"}
	packageScope := base
	packageScope.PlacementSlot = assessment.PlacementTraining
	packageScope.PlacementAccess = assessment.PlacementAccessPackage
	freeScope := packageScope
	freeScope.PlacementAccess = assessment.PlacementAccessFree
	for _, tc := range []struct {
		name    string
		has     bool
		scopes  []assessment.AccessContext
		allowed bool
	}{
		{"independent free assessment", false, nil, true},
		{"package placement locked", true, []assessment.AccessContext{packageScope}, false},
		{"only hidden or older placements", true, nil, false},
		{"one free placement", true, []assessment.AccessContext{packageScope, freeScope}, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			repo := &directPlacementRepo{fakeAttemptRepo: &fakeAttemptRepo{access: base}, hasPlacements: tc.has, visibleScopes: tc.scopes}
			resolver := &recordingCommerceAccess{commerceAccessStub: commerceAccessStub{allowed: false, reason: "package_required"}}
			svc := NewAttemptServiceWithLearningAndCommerce(repo, nil, resolver)
			_, startErr := svc.Start(context.Background(), student("student"), "exam", "start")
			_, submitErr := svc.SingleShotSubmit(context.Background(), student("student"), "exam", assessment.SingleShotSubmissionRequest{SubmissionKey: "submit"})
			if tc.allowed && (startErr != nil || submitErr != nil) {
				t.Fatalf("expected access: start=%v submit=%v", startErr, submitErr)
			}
			if !tc.allowed && (!errors.Is(startErr, ErrForbidden) || !errors.Is(submitErr, ErrForbidden)) {
				t.Fatalf("expected both routes denied: start=%v submit=%v", startErr, submitErr)
			}
		})
	}
}

func TestFreePlacementWorksWhenOtherCommerceLookupFails(t *testing.T) {
	base := assessment.AccessContext{AssessmentID: "exam", AssessmentKind: assessment.KindNormal, BaseAccess: assessment.AccessFree, PathID: "path", SubjectID: "subject"}
	paid, free := base, base
	paid.PlacementSlot, paid.PlacementAccess = assessment.PlacementTraining, assessment.PlacementAccessPackage
	free.PlacementSlot, free.PlacementAccess = assessment.PlacementTests, assessment.PlacementAccessFree
	repo := &directPlacementRepo{fakeAttemptRepo: &fakeAttemptRepo{access: base}, hasPlacements: true, visibleScopes: []assessment.AccessContext{paid, free}}
	if _, err := NewAttemptService(repo).Start(context.Background(), student("student"), "exam", "start"); err != nil {
		t.Fatalf("free placement should not depend on unavailable commerce: %v", err)
	}
}
