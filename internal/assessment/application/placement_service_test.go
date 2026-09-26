package application

import (
	"context"
	"errors"
	"testing"
	"time"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type placementRepoStub struct {
	placement   assessment.Placement
	page        assessment.PlacementPage
	learner     assessment.LearnerPlacementPage
	attempt     assessment.Attempt
	lastLearner assessment.LearnerPlacementQuery
	access      assessment.AccessContext
}

func (r *placementRepoStub) CreatePlacement(context.Context, string, string, assessment.PlacementWrite) (assessment.Placement, error) {
	return r.placement, nil
}
func (r *placementRepoStub) GetPlacement(context.Context, string) (assessment.Placement, error) {
	return r.placement, nil
}
func (r *placementRepoStub) ListPlacements(context.Context, string, int, int) (assessment.PlacementPage, error) {
	return r.page, nil
}
func (r *placementRepoStub) PatchPlacement(context.Context, string, string, time.Time, assessment.PlacementAccessType, bool, int) (assessment.Placement, error) {
	return r.placement, nil
}
func (r *placementRepoStub) ListLearnerPlacements(_ context.Context, _ string, q assessment.LearnerPlacementQuery) (assessment.LearnerPlacementPage, error) {
	r.lastLearner = q
	return r.learner, nil
}
func (r *placementRepoStub) GetPlacementAccessContext(context.Context, string) (assessment.AccessContext, error) {
	if r.access.AssessmentKind != "" {
		return r.access, nil
	}
	placementAccess := r.placement.AccessType
	if placementAccess == "" {
		placementAccess = assessment.PlacementAccessInherit
	}
	return assessment.AccessContext{
		AssessmentID: "assessment-1", AssessmentKind: assessment.KindNormal, BaseAccess: assessment.AccessFree,
		PlacementID: r.placement.ID, PlacementSlot: r.placement.Slot, PlacementAccess: placementAccess,
		PathID: r.placement.PathID, SubjectID: r.placement.SubjectID, CourseID: r.placement.CourseID,
	}, nil
}
func (r *placementRepoStub) StartPlacement(context.Context, string, string, string) (assessment.Attempt, error) {
	return r.attempt, nil
}

type placementContentStub struct{ ok bool }

func (c placementContentStub) ValidateAssessmentPlacementTarget(context.Context, string, string, string, string, string, string) (bool, error) {
	return c.ok, nil
}

type definitionRepoStub struct{ a assessment.Assessment }

func (r *definitionRepoStub) List(context.Context, assessment.ListQuery) (assessment.Page, error) {
	return assessment.Page{}, nil
}
func (r *definitionRepoStub) Get(context.Context, string) (assessment.Assessment, error) {
	return r.a, nil
}
func (r *definitionRepoStub) Create(context.Context, string, assessment.Write) (assessment.Assessment, error) {
	return assessment.Assessment{}, nil
}
func (r *definitionRepoStub) Update(context.Context, string, string, int, assessment.Write) (assessment.Assessment, error) {
	return assessment.Assessment{}, nil
}
func (r *definitionRepoStub) SetWorkflow(context.Context, string, string, int, assessment.WorkflowStatus, string) (assessment.Assessment, error) {
	return assessment.Assessment{}, nil
}
func (r *definitionRepoStub) SetPublication(context.Context, string, string, int, bool) (assessment.Assessment, error) {
	return assessment.Assessment{}, nil
}
func (r *definitionRepoStub) CanAuthor(context.Context, string, string, string) (bool, error) {
	return true, nil
}

func placementDefinition(owner string) assessment.Assessment {
	v := 1
	return assessment.Assessment{
		ID: "assessment-1", OwnerType: assessment.OwnerTeacher, OwnerUserID: owner, AssignedTeacherID: owner,
		WorkflowStatus: assessment.WorkflowApproved, PublishedVersion: &v, IsPublished: true, IsVisible: true,
		Version: assessment.Version{Version: 1, PathID: "path-1", SubjectID: "subject-1"},
	}
}
func placementTeacher(id string) identity.User {
	return identity.User{ID: id, Roles: []identity.Role{identity.RoleTeacher}}
}

func TestPlacementCreateRequiresOwnedPublishedDefinitionAndValidContentTarget(t *testing.T) {
	repo := &placementRepoStub{placement: assessment.Placement{ID: "p-1"}}
	defs := NewService(&definitionRepoStub{a: placementDefinition("teacher-1")})
	s := NewPlacementService(repo, defs, placementContentStub{ok: true})
	out, err := s.Create(context.Background(), placementTeacher("teacher-1"), "assessment-1", assessment.PlacementWrite{
		Slot: assessment.PlacementCourse, PathID: "path-1", SubjectID: "subject-1", CourseID: "course-1", IsVisible: true,
	})
	if err != nil || out.ID != "p-1" {
		t.Fatalf("create failed: %#v %v", out, err)
	}
}

func TestPlacementRejectsCrossScopeOrInvalidShape(t *testing.T) {
	repo := &placementRepoStub{}
	defs := NewService(&definitionRepoStub{a: placementDefinition("teacher-1")})
	s := NewPlacementService(repo, defs, placementContentStub{ok: true})
	_, err := s.Create(context.Background(), placementTeacher("teacher-1"), "assessment-1", assessment.PlacementWrite{
		Slot: assessment.PlacementFoundation, PathID: "path-X", SubjectID: "subject-1", TopicID: "topic-1",
	})
	if !errors.Is(err, assessment.ErrConflict) {
		t.Fatalf("want scope conflict got %v", err)
	}
	_, err = s.Create(context.Background(), placementTeacher("teacher-1"), "assessment-1", assessment.PlacementWrite{
		Slot: assessment.PlacementFoundation, PathID: "path-1", SubjectID: "subject-1",
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("want invalid target got %v", err)
	}
}

func TestLearnerPlacementRequiresExactBoundedContext(t *testing.T) {
	repo := &placementRepoStub{}
	defs := NewService(&definitionRepoStub{a: placementDefinition("teacher-1")})
	s := NewPlacementService(repo, defs, placementContentStub{ok: true})
	student := identity.User{ID: "student-1", Roles: []identity.Role{identity.RoleStudent}}
	_, err := s.Learner(context.Background(), student, assessment.LearnerPlacementQuery{Slot: assessment.PlacementCourse, PathID: "path-1", SubjectID: "subject-1", Limit: 500})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("course without courseId must fail, got %v", err)
	}
	out, err := s.Learner(context.Background(), student, assessment.LearnerPlacementQuery{Slot: assessment.PlacementTests, PathID: "path-1", SubjectID: "subject-1", Limit: 500})
	if err != nil {
		t.Fatal(err)
	}
	if repo.lastLearner.Limit != 100 || repo.lastLearner.Page != 1 {
		t.Fatalf("query not bounded: page=%d limit=%d", repo.lastLearner.Page, repo.lastLearner.Limit)
	}
	if out.Limit != 0 && out.Limit > 100 {
		t.Fatalf("unexpected result limit: %d", out.Limit)
	}
}

func TestPlacementStartRevalidatesVisibleContent(t *testing.T) {
	repo := &placementRepoStub{placement: assessment.Placement{ID: "p-1", Slot: assessment.PlacementCourse, PathID: "path-1", SubjectID: "subject-1", CourseID: "course-1", IsVisible: true}}
	defs := NewService(&definitionRepoStub{a: placementDefinition("teacher-1")})
	s := NewPlacementService(repo, defs, placementContentStub{ok: false})
	student := identity.User{ID: "student-1", Roles: []identity.Role{identity.RoleStudent}}
	_, err := s.Start(context.Background(), student, "p-1", "key-1")
	if !errors.Is(err, assessment.ErrConflict) {
		t.Fatalf("want content conflict got %v", err)
	}
}

func TestLearnerPaidPlacementIsLockedWithoutCommerceEntitlement(t *testing.T) {
	repo := &placementRepoStub{learner: assessment.LearnerPlacementPage{
		Items: []assessment.LearnerPlacement{{
			PlacementID: "p-paid", AssessmentID: "assessment-paid", AssessmentVersion: 1,
			AssessmentKind: assessment.KindNormal, Slot: assessment.PlacementTests,
			PathID: "path-1", SubjectID: "subject-1", AttemptCount: 0, MaxAttempts: 2,
			AccessType: assessment.PlacementAccessPaid, BaseAccessType: assessment.AccessFree,
		}},
		Page: 1, Limit: 30,
	}}
	defs := NewService(&definitionRepoStub{a: placementDefinition("teacher-1")})
	commerce := &recordingCommerceAccess{commerceAccessStub: commerceAccessStub{allowed: false, reason: "paid_required"}}
	s := NewPlacementServiceWithCommerce(repo, defs, placementContentStub{ok: true}, commerce)
	student := identity.User{ID: "student-1", Roles: []identity.Role{identity.RoleStudent}}
	out, err := s.Learner(context.Background(), student, assessment.LearnerPlacementQuery{
		Slot: assessment.PlacementTests, PathID: "path-1", SubjectID: "subject-1",
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Items) != 1 || out.Items[0].AccessAllowed || out.Items[0].CanStart || out.Items[0].AccessReason != "paid_required" {
		t.Fatalf("unexpected locked placement: %#v", out.Items)
	}
}

func TestPlacementStartRechecksCommerceEntitlement(t *testing.T) {
	repo := &placementRepoStub{
		placement: assessment.Placement{
			ID: "p-paid", Slot: assessment.PlacementTests, AccessType: assessment.PlacementAccessPaid,
			PathID: "path-1", SubjectID: "subject-1", IsVisible: true,
		},
		access: assessment.AccessContext{
			AssessmentID: "assessment-1", AssessmentKind: assessment.KindNormal, BaseAccess: assessment.AccessFree,
			PlacementID: "p-paid", PlacementSlot: assessment.PlacementTests, PlacementAccess: assessment.PlacementAccessPaid,
			PathID: "path-1", SubjectID: "subject-1",
		},
	}
	defs := NewService(&definitionRepoStub{a: placementDefinition("teacher-1")})
	commerce := &recordingCommerceAccess{commerceAccessStub: commerceAccessStub{allowed: false, reason: "paid_required"}}
	s := NewPlacementServiceWithCommerce(repo, defs, placementContentStub{ok: true}, commerce)
	student := identity.User{ID: "student-1", Roles: []identity.Role{identity.RoleStudent}}
	if _, err := s.Start(context.Background(), student, "p-paid", "start-key"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected fresh paid start forbidden, got %v", err)
	}
	if commerce.calls != 1 {
		t.Fatalf("expected fresh commerce check, got %d", commerce.calls)
	}
}
