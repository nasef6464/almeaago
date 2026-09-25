package application

import (
	"context"
	"testing"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type stubRepo struct {
	page assessment.Page
	item assessment.Assessment
	can  bool
}

func (s *stubRepo) Create(context.Context, string, assessment.Write) (assessment.Assessment, error) {
	return s.item, nil
}
func (s *stubRepo) Update(context.Context, string, string, int, assessment.Write) (assessment.Assessment, error) {
	return s.item, nil
}
func (s *stubRepo) Get(context.Context, string) (assessment.Assessment, error) { return s.item, nil }
func (s *stubRepo) List(_ context.Context, q assessment.ListQuery) (assessment.Page, error) {
	s.page.Page = q.Page
	s.page.Limit = q.Limit
	return s.page, nil
}
func (s *stubRepo) SetWorkflow(context.Context, string, string, int, assessment.WorkflowStatus, string) (assessment.Assessment, error) {
	return s.item, nil
}
func (s *stubRepo) SetPublication(context.Context, string, string, int, bool) (assessment.Assessment, error) {
	return s.item, nil
}
func (s *stubRepo) CanAuthor(context.Context, string, string, string) (bool, error) {
	return s.can, nil
}

func admin() identity.User { return identity.User{ID: "a", Roles: []identity.Role{identity.RoleAdmin}} }
func teacher() identity.User {
	return identity.User{ID: "t", Roles: []identity.Role{identity.RoleTeacher}}
}

func TestListBounds(t *testing.T) {
	s := NewService(&stubRepo{})
	if _, err := s.List(context.Background(), admin(), assessment.ListQuery{Limit: 101}); err != ErrInvalidInput {
		t.Fatalf("expected invalid input, got %v", err)
	}
	p, err := s.List(context.Background(), admin(), assessment.ListQuery{})
	if err != nil || p.Page != 1 || p.Limit != 50 {
		t.Fatalf("defaults not applied: %#v %v", p, err)
	}
}
func TestTeacherCreateNormalizesOwnershipAndRequiresScope(t *testing.T) {
	r := &stubRepo{can: true}
	s := NewService(r)
	w := assessment.Write{Code: "A-1", OwnerType: assessment.OwnerPlatform, Version: assessment.Version{Title: "Quiz", PathID: "p", SubjectID: "s", MaxAttempts: 3, PassingScore: 60}}
	if _, err := s.Create(context.Background(), teacher(), w); err != nil {
		t.Fatal(err)
	}
	r.can = false
	if _, err := s.Create(context.Background(), teacher(), w); err != ErrForbidden {
		t.Fatalf("expected forbidden, got %v", err)
	}
}
func TestTeacherCannotApprove(t *testing.T) {
	r := &stubRepo{item: assessment.Assessment{ID: "x", OwnerType: assessment.OwnerTeacher, OwnerUserID: "t", WorkflowStatus: assessment.WorkflowPendingReview, Revision: 1}}
	s := NewService(r)
	if _, err := s.SetWorkflow(context.Background(), teacher(), "x", 1, assessment.WorkflowApproved, ""); err == nil {
		t.Fatal("teacher approval must fail")
	}
}
func TestPublicationRequiresAdminApprovedAndQuestions(t *testing.T) {
	r := &stubRepo{item: assessment.Assessment{ID: "x", WorkflowStatus: assessment.WorkflowApproved, Revision: 1}}
	s := NewService(r)
	if _, err := s.SetPublication(context.Background(), admin(), "x", 1, true); err != ErrWorkflow {
		t.Fatalf("expected workflow failure, got %v", err)
	}
	r.item.Questions = []assessment.QuestionPlacement{{QuestionID: "q", QuestionVersion: 1, Points: 1}}
	if _, err := s.SetPublication(context.Background(), admin(), "x", 1, true); err != nil {
		t.Fatal(err)
	}
}
