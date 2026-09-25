package application

import (
	"context"
	"testing"
	"time"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type assignmentFake struct {
	created assessment.AssignmentWrite
	page    assessment.AssignmentPage
	learner []assessment.LearnerAssignment
	more    bool
}

func (f *assignmentFake) CreateAssignment(_ context.Context, _ string, _ []identity.Role, _ string, w assessment.AssignmentWrite) (assessment.Assignment, error) {
	f.created = w
	return assessment.Assignment{ID: "x"}, nil
}
func (f *assignmentFake) ListAssignments(context.Context, string, []identity.Role, string, int, int) (assessment.AssignmentPage, error) {
	return f.page, nil
}
func (f *assignmentFake) SetAssignmentStatus(context.Context, string, []identity.Role, string, assessment.AssignmentStatus) (assessment.Assignment, error) {
	return assessment.Assignment{ID: "x"}, nil
}
func (f *assignmentFake) ListLearnerAssignments(context.Context, string, int, int) ([]assessment.LearnerAssignment, bool, error) {
	return f.learner, f.more, nil
}
func (f *assignmentFake) StartAssigned(context.Context, string, string, string) (assessment.Attempt, error) {
	return assessment.Attempt{ID: "a"}, nil
}
func TestAssignmentCreateRejectsEmptyAudience(t *testing.T) {
	s := NewAssignmentService(&assignmentFake{})
	_, e := s.Create(context.Background(), identity.User{ID: "u", Roles: []identity.Role{identity.RoleAdmin}}, "a", assessment.AssignmentWrite{SchoolID: "s"})
	if e != ErrInvalidInput {
		t.Fatalf("got %v", e)
	}
}
func TestAssignmentCreateRejectsInvalidWindow(t *testing.T) {
	s := NewAssignmentService(&assignmentFake{})
	now := time.Now()
	before := now.Add(-time.Minute)
	_, e := s.Create(context.Background(), identity.User{ID: "u", Roles: []identity.Role{identity.RoleAdmin}}, "a", assessment.AssignmentWrite{SchoolID: "s", UserIDs: []string{"x"}, OpensAt: &now, ClosesAt: &before})
	if e != ErrInvalidInput {
		t.Fatalf("got %v", e)
	}
}
func TestAssignmentListBounds(t *testing.T) {
	f := &assignmentFake{}
	s := NewAssignmentService(f)
	_, e := s.List(context.Background(), identity.User{ID: "u", Roles: []identity.Role{identity.RoleTeacher}}, "a", 0, 1000)
	if e != nil {
		t.Fatal(e)
	}
}
func TestAssignmentStudentCannotManage(t *testing.T) {
	s := NewAssignmentService(&assignmentFake{})
	_, e := s.Status(context.Background(), identity.User{ID: "u", Roles: []identity.Role{identity.RoleStudent}}, "x", assessment.AssignmentClosed)
	if e != ErrForbidden {
		t.Fatalf("got %v", e)
	}
}
