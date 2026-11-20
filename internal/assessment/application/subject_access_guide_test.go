package application

import (
	"context"
	"errors"
	"testing"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type guideTestContent struct {
	placementContentStub
	counts content.SubjectAccessGuideCounts
}

func (c guideTestContent) CountSubjectAccessContent(context.Context, string, string) (content.SubjectAccessGuideCounts, error) {
	return c.counts, nil
}

type guideTestRepo struct {
	*placementRepoStub
	groups []assessment.GuidePlacementGroup
}

func (r *guideTestRepo) ListSubjectGuidePlacementGroups(context.Context, string, string) ([]assessment.GuidePlacementGroup, error) {
	return r.groups, nil
}

type guideTestAccess struct{ err error }

func (a guideTestAccess) CheckFoundationAccess(_ context.Context, user, _, _ string) (commerce.AccessDecision, error) {
	return commerce.AccessDecision{Allowed: user == "student-1"}, a.err
}

type guideCourseContent struct {
	guideTestContent
	courses content.SubjectGuideCourses
}

func (c guideCourseContent) ListSubjectGuideCourses(context.Context, string, string, int) (content.SubjectGuideCourses, error) {
	return c.courses, nil
}

type guideCourseAccess struct {
	guideTestAccess
	unknown bool
	failure bool
}

func (a guideCourseAccess) CheckGuideCourseAccess(_ context.Context, user, course string) (commerce.AccessDecision, error) {
	if a.failure {
		return commerce.AccessDecision{}, errors.New("unavailable")
	}
	if a.unknown && course == "paid" {
		return commerce.AccessDecision{Configured: false, Reason: "commerce_unconfigured"}, nil
	}
	if course == "free" {
		return commerce.AccessDecision{Configured: true, Allowed: true, Reason: "free_product"}, nil
	}
	if user == "purchaser" {
		return commerce.AccessDecision{Configured: true, Allowed: true, Reason: "user_entitlement"}, nil
	}
	if user == "school" {
		return commerce.AccessDecision{Configured: true, Allowed: true, Reason: "school_entitlement"}, nil
	}
	return commerce.AccessDecision{Configured: true, Allowed: false, Reason: "paid_required"}, nil
}

func TestSubjectAccessGuideCoursesRespectPerCourseDecisionsAndIncompleteState(t *testing.T) {
	repo := &guideTestRepo{placementRepoStub: &placementRepoStub{}}
	data := guideCourseContent{guideTestContent: guideTestContent{placementContentStub: placementContentStub{ok: true}}, courses: content.SubjectGuideCourses{IDs: []string{"free", "paid"}}}
	for _, tc := range []struct {
		user   string
		locked bool
	}{{"", true}, {"purchaser", false}, {"school", false}, {"other", true}} {
		actor := identity.User{}
		if tc.user != "" {
			actor = identity.User{ID: tc.user, Roles: []identity.Role{identity.RoleStudent}}
		}
		result, err := NewPlacementServiceWithCommerce(repo, nil, data, guideCourseAccess{}).SubjectAccessGuide(context.Background(), actor, "path", "subject")
		if err != nil || !result.Complete || len(result.Unavailable) != 0 || len(result.Categories) != 5 {
			t.Fatalf("%s result=%+v err=%v", tc.user, result, err)
		}
		course := result.Categories[4]
		if course.Type != "courses" || !course.HasContent || !course.HasFree || !course.HasOpen || course.HasLocked != tc.locked {
			t.Fatalf("%s courses=%+v", tc.user, course)
		}
	}
	for _, tc := range []struct {
		name   string
		data   guideCourseContent
		access guideCourseAccess
	}{
		{"unconfigured", data, guideCourseAccess{unknown: true}},
		{"over cap", guideCourseContent{guideTestContent: data.guideTestContent, courses: content.SubjectGuideCourses{IDs: []string{"free"}, HasMore: true}}, guideCourseAccess{}},
	} {
		result, err := NewPlacementServiceWithCommerce(repo, nil, tc.data, tc.access).SubjectAccessGuide(context.Background(), identity.User{}, "path", "subject")
		if err != nil || result.Complete || len(result.Categories) != 4 || len(result.Unavailable) != 1 || result.Unavailable[0] != "courses" {
			t.Fatalf("%s result=%+v err=%v", tc.name, result, err)
		}
	}
	if _, err := NewPlacementServiceWithCommerce(repo, nil, data, guideCourseAccess{failure: true}).SubjectAccessGuide(context.Background(), identity.User{}, "path", "subject"); err == nil {
		t.Fatal("course access failure must not fabricate guide")
	}
}
func (a guideTestAccess) CheckLibraryAccess(context.Context, string, string, string) (commerce.AccessDecision, error) {
	return commerce.AccessDecision{Allowed: false}, a.err
}
func (a guideTestAccess) CheckAssessmentAccess(_ context.Context, user, _, _, _ string, _ commerce.ContentType, _ bool) (commerce.AccessDecision, error) {
	return commerce.AccessDecision{Allowed: user == "student-1", Reason: "paid_required"}, a.err
}

func TestSubjectAccessGuideMixedPoliciesAndAccountIsolation(t *testing.T) {
	contentRepo := guideTestContent{placementContentStub: placementContentStub{ok: true}, counts: content.SubjectAccessGuideCounts{FoundationFree: 52, FoundationPaid: 3, LibraryPaid: 1}}
	repo := &guideTestRepo{placementRepoStub: &placementRepoStub{}, groups: []assessment.GuidePlacementGroup{
		{Slot: assessment.PlacementTraining, PlacementAccess: assessment.PlacementAccessFree, BaseAccess: assessment.AccessFree, Kind: assessment.KindNormal},
		{Slot: assessment.PlacementTraining, PlacementAccess: assessment.PlacementAccessPackage, BaseAccess: assessment.AccessFree, Kind: assessment.KindNormal},
		{Slot: assessment.PlacementTests, PlacementAccess: assessment.PlacementAccessInherit, BaseAccess: assessment.AccessPrivate, Kind: assessment.KindNormal},
	}}
	s := NewPlacementServiceWithCommerce(repo, nil, contentRepo, guideTestAccess{})
	first := identity.User{ID: "student-1", Roles: []identity.Role{identity.RoleStudent}}
	second := identity.User{ID: "student-2", Roles: []identity.Role{identity.RoleStudent}}
	for _, tc := range []struct {
		actor                            identity.User
		foundationLocked, trainingLocked bool
	}{
		{identity.User{}, true, true}, {first, false, false}, {second, true, true},
	} {
		got, err := s.SubjectAccessGuide(context.Background(), tc.actor, "path", "subject")
		if err != nil {
			t.Fatal(err)
		}
		if got.Complete || len(got.Unavailable) != 1 || got.Unavailable[0] != "courses" || len(got.Categories) != 4 {
			t.Fatalf("incomplete contract: %+v", got)
		}
		foundation, training, tests, library := got.Categories[0], got.Categories[1], got.Categories[2], got.Categories[3]
		if !foundation.HasContent || !foundation.HasFree || !foundation.HasOpen || foundation.HasLocked != tc.foundationLocked {
			t.Fatalf("foundation: %+v", foundation)
		}
		if !training.HasContent || !training.HasFree || !training.HasOpen || training.HasLocked != tc.trainingLocked {
			t.Fatalf("training: %+v", training)
		}
		if !tests.HasContent || tests.HasFree || tests.HasOpen || tests.HasLocked || !tests.HasRestricted {
			t.Fatalf("private tests: %+v", tests)
		}
		if !library.HasContent || library.HasFree || library.HasOpen || !library.HasLocked {
			t.Fatalf("library: %+v", library)
		}
	}
	if _, err := s.SubjectAccessGuide(context.Background(), first, "path", ""); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("empty subject: %v", err)
	}
	hidden := NewPlacementServiceWithCommerce(repo, nil, guideTestContent{placementContentStub: placementContentStub{ok: true, hidden: true}}, guideTestAccess{})
	if _, err := hidden.SubjectAccessGuide(context.Background(), first, "path", "subject"); err == nil {
		t.Fatal("hidden scope exposed")
	}
	failure := NewPlacementServiceWithCommerce(repo, nil, contentRepo, guideTestAccess{err: errors.New("commerce failed")})
	if _, err := failure.SubjectAccessGuide(context.Background(), first, "path", "subject"); err == nil {
		t.Fatal("resolver failure must not become a fabricated state")
	}
}
