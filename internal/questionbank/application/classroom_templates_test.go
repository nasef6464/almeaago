package application

import (
	"context"
	"errors"
	"testing"
	"time"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

type templateRepoStub struct {
	repoStub
	canTeach   bool
	templates  []question.ClassroomPreparedTemplate
	lastCreate question.CreateClassroomTemplateCommand
	deletedID  string
}

func (r *templateRepoStub) CanTeachInSchool(_ context.Context, _, _ string) (bool, error) {
	return r.canTeach, nil
}

func (r *templateRepoStub) ListClassroomTemplates(_ context.Context, _, _ string) ([]question.ClassroomPreparedTemplate, error) {
	return r.templates, nil
}

func (r *templateRepoStub) CreateClassroomTemplate(_ context.Context, cmd question.CreateClassroomTemplateCommand) (question.ClassroomPreparedTemplate, error) {
	r.lastCreate = cmd
	return question.ClassroomPreparedTemplate{
		ID:           "01900000-0000-4000-8000-000000000099",
		SchoolID:     cmd.SchoolID,
		TeacherID:    cmd.TeacherID,
		Title:        cmd.Title,
		QuestionIDs:  cmd.QuestionIDs,
		ChallengeIDs: cmd.ChallengeIDs,
		CreatedAt:    time.Unix(1700000000, 0).UTC(),
		UpdatedAt:    time.Unix(1700000000, 0).UTC(),
	}, nil
}

func (r *templateRepoStub) DeleteClassroomTemplate(_ context.Context, _, templateID string) error {
	r.deletedID = templateID
	return nil
}

func TestClassroomTemplatesRBACAndValidation(t *testing.T) {
	const (
		schoolID = "01900000-0000-4000-8000-000000000010"
		q1       = "01900000-0000-4000-8000-000000000021"
		q2       = "01900000-0000-4000-8000-000000000022"
		q3       = "01900000-0000-4000-8000-000000000023"
		tplID    = "01900000-0000-4000-8000-000000000099"
	)

	repo := &templateRepoStub{canTeach: true}
	svc := NewService(repo)
	teacher := actor(identity.RoleTeacher)
	student := actor(identity.RoleStudent)
	supervisor := actor(identity.RoleSupervisor)

	if _, err := svc.ListClassroomTemplates(context.Background(), student, schoolID); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected ErrForbidden for student, got %v", err)
	}
	if _, err := svc.CreateClassroomTemplate(context.Background(), supervisor, CreateClassroomTemplateInput{
		SchoolID: schoolID, Title: "Test", QuestionIDs: []string{q1},
	}); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected ErrForbidden for supervisor, got %v", err)
	}

	repo.canTeach = false
	if _, err := svc.ListClassroomTemplates(context.Background(), teacher, schoolID); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected ErrForbidden when teacher lacks active school assignment, got %v", err)
	}
	repo.canTeach = true

	if _, err := svc.CreateClassroomTemplate(context.Background(), teacher, CreateClassroomTemplateInput{
		SchoolID:     schoolID,
		Title:        "Invalid Challenge",
		QuestionIDs:  []string{q1},
		ChallengeIDs: []string{q3},
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput when challengeIds is not subset of questionIds, got %v", err)
	}

	created, err := svc.CreateClassroomTemplate(context.Background(), teacher, CreateClassroomTemplateInput{
		SchoolID:     schoolID,
		Title:        "حزمة مراجعة سريعة",
		QuestionIDs:  []string{q1, q2, q1},
		ChallengeIDs: []string{q2, q2},
	})
	if err != nil {
		t.Fatalf("CreateClassroomTemplate failed: %v", err)
	}
	if len(created.QuestionIDs) != 2 || len(created.ChallengeIDs) != 1 {
		t.Fatalf("expected deduplicated IDs (2 questions, 1 challenge), got %+v", created)
	}

	if err := svc.DeleteClassroomTemplate(context.Background(), teacher, tplID); err != nil {
		t.Fatalf("DeleteClassroomTemplate failed: %v", err)
	}
	if repo.deletedID != tplID {
		t.Fatalf("expected deletedID %q, got %q", tplID, repo.deletedID)
	}
}
