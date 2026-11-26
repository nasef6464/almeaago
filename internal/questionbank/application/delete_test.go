package application

import (
	"context"
	"errors"
	"testing"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

type deleteQuestionRepoStub struct {
	Repository
	questions    map[string]question.Question
	trainerAllow bool
	failID       string
	deleted      []string
}

func (r *deleteQuestionRepoStub) Get(_ context.Context, id string) (question.Question, error) {
	q, ok := r.questions[id]
	if !ok {
		return question.Question{}, question.ErrNotFound
	}
	return q, nil
}

func (r *deleteQuestionRepoStub) CanTrainerDeleteQuestion(_ context.Context, _, _, _ string) (bool, error) {
	return r.trainerAllow, nil
}

func (r *deleteQuestionRepoStub) DeleteQuestion(_ context.Context, _, id string) error {
	if id == r.failID {
		return question.ErrHasDependencies
	}
	r.deleted = append(r.deleted, id)
	return nil
}

func TestQuestionDeleteAndBulkDelete(t *testing.T) {
	repo := &deleteQuestionRepoStub{
		questions: map[string]question.Question{
			"q1": {ID: "q1", PathID: "p1", SubjectID: "s1"},
			"q2": {ID: "q2", PathID: "p1", SubjectID: "s1"},
		},
		failID: "q2",
	}
	svc := NewService(repo)
	teacher := identity.User{ID: "t1", Roles: []identity.Role{identity.RoleTeacher}}
	admin := identity.User{ID: "a1", Roles: []identity.Role{identity.RoleAdmin}}

	if err := svc.DeleteQuestion(context.Background(), teacher, "q1"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden for teacher without permission, got %v", err)
	}

	repo.trainerAllow = true
	if err := svc.DeleteQuestion(context.Background(), teacher, "q1"); err != nil {
		t.Fatalf("expected teacher delete to succeed, got %v", err)
	}

	res, err := svc.BulkDeleteQuestions(context.Background(), admin, []string{"q1", "q2", "q1"})
	if err != nil {
		t.Fatalf("bulk delete error: %v", err)
	}
	if len(res.DeletedIDs) != 1 || res.DeletedIDs[0] != "q1" {
		t.Fatalf("unexpected deletedIds: %+v", res.DeletedIDs)
	}
	if len(res.Blocked) != 1 || res.Blocked[0].ID != "q2" {
		t.Fatalf("unexpected blocked: %+v", res.Blocked)
	}
}
