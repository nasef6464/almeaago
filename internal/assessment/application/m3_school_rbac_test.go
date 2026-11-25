package application

import (
	"context"
	"errors"
	"testing"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type schoolRepoStub struct {
	assessment.Assessment
	canManageSchool bool
}

func (s *schoolRepoStub) Create(_ context.Context, _ string, w assessment.Write) (assessment.Assessment, error) {
	return assessment.Assessment{
		ID:             "assess-1",
		Code:           w.Code,
		OwnerType:      w.OwnerType,
		OwnerSchoolID:  w.OwnerSchoolID,
		WorkflowStatus: assessment.WorkflowPendingReview,
		Revision:       1,
		Version:        w.Version,
		Questions:      w.Questions,
	}, nil
}
func (s *schoolRepoStub) Update(context.Context, string, string, int, assessment.Write) (assessment.Assessment, error) {
	return s.Assessment, nil
}
func (s *schoolRepoStub) Get(context.Context, string) (assessment.Assessment, error) {
	return s.Assessment, nil
}
func (s *schoolRepoStub) List(context.Context, assessment.ListQuery) (assessment.Page, error) {
	return assessment.Page{}, nil
}
func (s *schoolRepoStub) SetWorkflow(_ context.Context, _, id string, rev int, status assessment.WorkflowStatus, _ string) (assessment.Assessment, error) {
	out := s.Assessment
	out.ID = id
	out.Revision = rev + 1
	out.WorkflowStatus = status
	return out, nil
}
func (s *schoolRepoStub) SetPublication(_ context.Context, _, id string, rev int, published bool) (assessment.Assessment, error) {
	out := s.Assessment
	out.ID = id
	out.Revision = rev + 1
	out.IsPublished = published
	return out, nil
}
func (s *schoolRepoStub) SetVisibility(_ context.Context, _, id string, rev int, visible bool) (assessment.Assessment, error) {
	out := s.Assessment
	out.ID = id
	out.Revision = rev + 1
	out.IsVisible = visible
	return out, nil
}
func (s *schoolRepoStub) CanAuthor(context.Context, string, string, string) (bool, error) {
	return false, nil
}
func (s *schoolRepoStub) CanManageSchool(context.Context, string, string) (bool, error) {
	return s.canManageSchool, nil
}

func TestSchoolAdminAndSupervisorSchoolAssessmentRBAC(t *testing.T) {
	schoolAdmin := identity.User{ID: "dir-1", Roles: []identity.Role{identity.RoleSchoolAdmin}}
	supervisor := identity.User{ID: "sup-1", Roles: []identity.Role{identity.RoleSupervisor}}
	teacher := identity.User{ID: "tch-1", Roles: []identity.Role{identity.RoleTeacher}}

	repo := &schoolRepoStub{
		canManageSchool: true,
		Assessment: assessment.Assessment{
			ID:             "assess-1",
			OwnerType:      assessment.OwnerSchool,
			OwnerSchoolID:  "school-1",
			WorkflowStatus: assessment.WorkflowPendingReview,
			Revision:       1,
			Questions:      []assessment.QuestionPlacement{{QuestionID: "q-1", QuestionVersion: 1, Points: 1}},
		},
	}
	svc := NewService(repo)

	created, err := svc.Create(context.Background(), schoolAdmin, assessment.Write{
		Code:          "SCH-1",
		OwnerType:     assessment.OwnerSchool,
		OwnerSchoolID: "school-1",
		Version: assessment.Version{
			Title:        "School Mock",
			PathID:       "path-1",
			Kind:         assessment.KindNormal,
			MaxAttempts:  1,
			PassingScore: 60,
		},
	})
	if err != nil || created.OwnerSchoolID != "school-1" {
		t.Fatalf("expected school_admin create to succeed, got err=%v", err)
	}

	if _, err := svc.SetWorkflow(context.Background(), supervisor, "assess-1", 1, assessment.WorkflowApproved, "ok"); err != nil {
		t.Fatalf("expected supervisor approve for school assessment to succeed, got %v", err)
	}

	repo.Assessment.WorkflowStatus = assessment.WorkflowApproved
	if _, err := svc.SetPublication(context.Background(), schoolAdmin, "assess-1", 1, true); err != nil {
		t.Fatalf("expected school_admin publish to succeed, got %v", err)
	}

	if _, err := svc.SetVisibility(context.Background(), supervisor, "assess-1", 1, true); err != nil {
		t.Fatalf("expected supervisor visibility to succeed, got %v", err)
	}

	// Teacher must still be forbidden from approving or publishing
	if _, err := svc.SetWorkflow(context.Background(), teacher, "assess-1", 1, assessment.WorkflowApproved, "nope"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected teacher approve to be forbidden, got %v", err)
	}

	// Cross-school denial
	repo.canManageSchool = false
	if _, err := svc.SetPublication(context.Background(), schoolAdmin, "assess-1", 1, true); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected cross-school publish to be forbidden, got %v", err)
	}
}
