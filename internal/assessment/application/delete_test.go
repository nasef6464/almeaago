package application

import (
	"context"
	"errors"
	"testing"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type deleteAssessmentRepoStub struct {
	Repository
	items        map[string]assessment.Assessment
	trainerAllow bool
	failID       string
	deleted      []string
}

func (r *deleteAssessmentRepoStub) Get(_ context.Context, id string) (assessment.Assessment, error) {
	a, ok := r.items[id]
	if !ok {
		return assessment.Assessment{}, assessment.ErrNotFound
	}
	return a, nil
}

func (r *deleteAssessmentRepoStub) CanTrainerDeleteAssessment(_ context.Context, _, _, _ string) (bool, error) {
	return r.trainerAllow, nil
}

func (r *deleteAssessmentRepoStub) DeleteAssessment(_ context.Context, _, id string) error {
	if id == r.failID {
		return assessment.ErrHasDependencies
	}
	r.deleted = append(r.deleted, id)
	return nil
}

func TestAssessmentDeleteAndBulkDelete(t *testing.T) {
	repo := &deleteAssessmentRepoStub{
		items: map[string]assessment.Assessment{
			"a1": {ID: "a1", Version: assessment.Version{PathID: "p1", SubjectID: "s1"}},
			"a2": {ID: "a2", Version: assessment.Version{PathID: "p1", SubjectID: "s1"}},
		},
		failID: "a2",
	}
	svc := NewService(repo)
	teacher := identity.User{ID: "t1", Roles: []identity.Role{identity.RoleTeacher}}
	admin := identity.User{ID: "a1", Roles: []identity.Role{identity.RoleAdmin}}

	if err := svc.DeleteAssessment(context.Background(), teacher, "a1"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden without permission, got %v", err)
	}

	repo.trainerAllow = true
	if err := svc.DeleteAssessment(context.Background(), teacher, "a1"); err != nil {
		t.Fatalf("expected teacher delete to succeed, got %v", err)
	}

	res, err := svc.BulkDeleteAssessments(context.Background(), admin, []string{"a1", "a2"})
	if err != nil {
		t.Fatalf("bulk delete error: %v", err)
	}
	if len(res.DeletedIDs) != 1 || res.DeletedIDs[0] != "a1" {
		t.Fatalf("unexpected deletedIds: %+v", res.DeletedIDs)
	}
	if len(res.Blocked) != 1 || res.Blocked[0].ID != "a2" {
		t.Fatalf("unexpected blocked: %+v", res.Blocked)
	}
}
