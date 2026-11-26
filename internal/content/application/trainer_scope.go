package application

import (
	"context"
	"strings"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type TrainerScopeInput struct {
	PathIDs     []string                    `json:"pathIds"`
	SubjectIDs  []string                    `json:"subjectIds"`
	Permissions *content.TrainerPermissions `json:"permissions,omitempty"`
}

type trainerPermissionsStore interface {
	SetTrainerPermissions(ctx context.Context, actorUserID, userID string, perms content.TrainerPermissions) error
}

func (s *Service) TrainerScope(ctx context.Context, actor identity.User, userID string) (content.TrainerScope, error) {
	userID = strings.TrimSpace(userID)
	if userID == "me" {
		userID = actor.ID
	}
	if !actor.HasRole(identity.RoleAdmin) && (!actor.HasRole(identity.RoleTeacher) || actor.ID != userID) {
		return content.TrainerScope{}, ErrForbidden
	}
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
	scope, err := s.repo.SetTrainerScope(ctx, actor.ID, userID, pathIDs, subjectIDs)
	if err != nil {
		return content.TrainerScope{}, err
	}
	if input.Permissions != nil {
		if store, ok := s.repo.(trainerPermissionsStore); ok {
			if err := store.SetTrainerPermissions(ctx, actor.ID, userID, *input.Permissions); err != nil {
				return content.TrainerScope{}, err
			}
			scope.Permissions = *input.Permissions
		}
	}
	return scope, nil
}
