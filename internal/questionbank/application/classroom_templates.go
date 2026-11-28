package application

import (
	"context"
	"strings"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

type ClassroomTemplateRepository interface {
	CanTeachInSchool(ctx context.Context, teacherID, schoolID string) (bool, error)
	ListClassroomTemplates(ctx context.Context, teacherID, schoolID string) ([]question.ClassroomPreparedTemplate, error)
	CreateClassroomTemplate(ctx context.Context, cmd question.CreateClassroomTemplateCommand) (question.ClassroomPreparedTemplate, error)
	DeleteClassroomTemplate(ctx context.Context, teacherID, templateID string) error
}

type CreateClassroomTemplateInput struct {
	SchoolID     string   `json:"schoolId"`
	Title        string   `json:"title"`
	QuestionIDs  []string `json:"questionIds"`
	ChallengeIDs []string `json:"challengeIds"`
}

func (s *Service) ListClassroomTemplates(
	ctx context.Context,
	actor identity.User,
	schoolID string,
) ([]question.ClassroomPreparedTemplate, error) {
	if !actor.HasRole(identity.RoleTeacher) {
		return nil, ErrForbidden
	}
	schoolID = strings.TrimSpace(schoolID)
	if !validUUID(schoolID) {
		return nil, ErrInvalidInput
	}
	repo, ok := s.repo.(ClassroomTemplateRepository)
	if !ok {
		return nil, ErrInvalidInput
	}
	allowed, err := repo.CanTeachInSchool(ctx, actor.ID, schoolID)
	if err != nil {
		return nil, err
	}
	if !allowed {
		return nil, ErrForbidden
	}
	return repo.ListClassroomTemplates(ctx, actor.ID, schoolID)
}

func (s *Service) CreateClassroomTemplate(
	ctx context.Context,
	actor identity.User,
	input CreateClassroomTemplateInput,
) (question.ClassroomPreparedTemplate, error) {
	if !actor.HasRole(identity.RoleTeacher) {
		return question.ClassroomPreparedTemplate{}, ErrForbidden
	}
	schoolID := strings.TrimSpace(input.SchoolID)
	title := strings.TrimSpace(input.Title)
	if !validUUID(schoolID) || title == "" || len(title) > 200 {
		return question.ClassroomPreparedTemplate{}, ErrInvalidInput
	}
	if len(input.QuestionIDs) == 0 || len(input.QuestionIDs) > 20 {
		return question.ClassroomPreparedTemplate{}, ErrInvalidInput
	}
	qSet := make(map[string]struct{}, len(input.QuestionIDs))
	questionIDs := make([]string, 0, len(input.QuestionIDs))
	for _, raw := range input.QuestionIDs {
		id := strings.TrimSpace(raw)
		if !validUUID(id) {
			return question.ClassroomPreparedTemplate{}, ErrInvalidInput
		}
		if _, exists := qSet[id]; !exists {
			qSet[id] = struct{}{}
			questionIDs = append(questionIDs, id)
		}
	}
	if len(questionIDs) == 0 || len(questionIDs) > 20 {
		return question.ClassroomPreparedTemplate{}, ErrInvalidInput
	}
	cSet := make(map[string]struct{}, len(input.ChallengeIDs))
	challengeIDs := make([]string, 0, len(input.ChallengeIDs))
	for _, raw := range input.ChallengeIDs {
		id := strings.TrimSpace(raw)
		if !validUUID(id) {
			return question.ClassroomPreparedTemplate{}, ErrInvalidInput
		}
		if _, inQuestions := qSet[id]; !inQuestions {
			return question.ClassroomPreparedTemplate{}, ErrInvalidInput
		}
		if _, exists := cSet[id]; !exists {
			cSet[id] = struct{}{}
			challengeIDs = append(challengeIDs, id)
		}
	}

	repo, ok := s.repo.(ClassroomTemplateRepository)
	if !ok {
		return question.ClassroomPreparedTemplate{}, ErrInvalidInput
	}
	allowed, err := repo.CanTeachInSchool(ctx, actor.ID, schoolID)
	if err != nil {
		return question.ClassroomPreparedTemplate{}, err
	}
	if !allowed {
		return question.ClassroomPreparedTemplate{}, ErrForbidden
	}

	return repo.CreateClassroomTemplate(ctx, question.CreateClassroomTemplateCommand{
		SchoolID:     schoolID,
		TeacherID:    actor.ID,
		Title:        title,
		QuestionIDs:  questionIDs,
		ChallengeIDs: challengeIDs,
	})
}

func (s *Service) DeleteClassroomTemplate(
	ctx context.Context,
	actor identity.User,
	templateID string,
) error {
	if !actor.HasRole(identity.RoleTeacher) {
		return ErrForbidden
	}
	templateID = strings.TrimSpace(templateID)
	if !validUUID(templateID) {
		return ErrInvalidInput
	}
	repo, ok := s.repo.(ClassroomTemplateRepository)
	if !ok {
		return ErrInvalidInput
	}
	return repo.DeleteClassroomTemplate(ctx, actor.ID, templateID)
}
