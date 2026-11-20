package application

import (
	"context"
	"regexp"
	"strings"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

var sectionUUID = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

type questionSectionRepository interface {
	GetQuestionSection(context.Context, string) (string, error)
	SetQuestionSection(context.Context, string, string, string) error
}

func (s *Service) QuestionSection(ctx context.Context, actor identity.User, questionID string) (string, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return "", ErrForbidden
	}
	questionID = strings.TrimSpace(questionID)
	if !sectionUUID.MatchString(questionID) {
		return "", ErrInvalidInput
	}
	repo, ok := s.repo.(questionSectionRepository)
	if !ok {
		return "", ErrWorkflow
	}
	return repo.GetQuestionSection(ctx, questionID)
}

func (s *Service) SetQuestionSection(ctx context.Context, actor identity.User, questionID, sectionID string) error {
	if !actor.HasRole(identity.RoleAdmin) || strings.TrimSpace(actor.ID) == "" {
		return ErrForbidden
	}
	questionID, sectionID = strings.TrimSpace(questionID), strings.TrimSpace(sectionID)
	if !sectionUUID.MatchString(questionID) || (sectionID != "" && !sectionUUID.MatchString(sectionID)) {
		return ErrInvalidInput
	}
	repo, ok := s.repo.(questionSectionRepository)
	if !ok {
		return ErrWorkflow
	}
	return repo.SetQuestionSection(ctx, actor.ID, questionID, sectionID)
}
