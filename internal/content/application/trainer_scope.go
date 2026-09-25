package application

import (
	"context"
	"strings"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type TrainerScopeInput struct {
	PathIDs    []string `json:"pathIds"`
	SubjectIDs []string `json:"subjectIds"`
}

func (s *Service) TrainerScope(ctx context.Context, actor identity.User, userID string) (content.TrainerScope, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return content.TrainerScope{}, ErrForbidden
	}
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return content.TrainerScope{}, ErrInvalidInput
	}
	return s.repo.GetTrainerScope(ctx, userID)
}

func (s *Service) SetTrainerScope(ctx context.Context, actor identity.User, userID string, input TrainerScopeInput) (content.TrainerScope, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return content.TrainerScope{}, ErrForbidden
	}
	userID = strings.TrimSpace(userID)
	pathIDs := normalizeIDs(input.PathIDs)
	subjectIDs := normalizeIDs(input.SubjectIDs)
	if userID == "" || len(pathIDs) > 50 || len(subjectIDs) > 200 {
		return content.TrainerScope{}, ErrInvalidInput
	}
	return s.repo.SetTrainerScope(ctx, actor.ID, userID, pathIDs, subjectIDs)
}
