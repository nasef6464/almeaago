package application

import (
	"context"
	"errors"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	"testing"
)

type fakeAttemptRepo struct {
	a   assessment.Attempt
	r   assessment.Result
	err error
}

func (f *fakeAttemptRepo) Start(context.Context, string, string, string) (assessment.Attempt, error) {
	return f.a, f.err
}
func (f *fakeAttemptRepo) GetAttempt(context.Context, string) (assessment.Attempt, error) {
	return f.a, f.err
}
func (f *fakeAttemptRepo) SaveAnswer(context.Context, string, string, string, assessment.AnswerWrite) (assessment.Attempt, error) {
	return f.a, f.err
}
func (f *fakeAttemptRepo) Submit(context.Context, string, string, string) (assessment.Result, error) {
	return f.r, f.err
}
func (f *fakeAttemptRepo) GetResult(context.Context, string) (assessment.Result, error) {
	return f.r, f.err
}
func student(id string) identity.User {
	return identity.User{ID: id, Roles: []identity.Role{identity.RoleStudent}}
}
func TestAttemptStudentOnly(t *testing.T) {
	s := NewAttemptService(&fakeAttemptRepo{})
	_, e := s.Start(context.Background(), identity.User{ID: "t", Roles: []identity.Role{identity.RoleTeacher}}, "a", "key")
	if !errors.Is(e, ErrForbidden) {
		t.Fatalf("want forbidden got %v", e)
	}
}
func TestAttemptOwnership(t *testing.T) {
	s := NewAttemptService(&fakeAttemptRepo{a: assessment.Attempt{ID: "x", StudentID: "other"}})
	_, e := s.Get(context.Background(), student("me"), "x")
	if !errors.Is(e, ErrForbidden) {
		t.Fatalf("want forbidden got %v", e)
	}
}
func TestAttemptRequiresIdempotencyKeys(t *testing.T) {
	s := NewAttemptService(&fakeAttemptRepo{})
	if _, e := s.Start(context.Background(), student("s"), "a", ""); !errors.Is(e, ErrInvalidInput) {
		t.Fatalf("start: %v", e)
	}
	if _, e := s.Submit(context.Background(), student("s"), "a", ""); !errors.Is(e, ErrInvalidInput) {
		t.Fatalf("submit: %v", e)
	}
}
func TestAttemptAnswerShape(t *testing.T) {
	s := NewAttemptService(&fakeAttemptRepo{})
	i := 1
	if _, e := s.Save(context.Background(), student("s"), "a", "q", assessment.AnswerWrite{SelectedOptionIndex: &i, TextAnswer: "both"}); !errors.Is(e, ErrInvalidInput) {
		t.Fatalf("want invalid got %v", e)
	}
}
