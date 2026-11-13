package application

import (
	"context"
	"regexp"
	"strings"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type preparedQuizStager interface {
	StagePreparedQuiz(context.Context, string, string, assessment.PreparedQuizStage) error
}
type preparedQuizStageReader interface {
	GetPreparedQuizStage(context.Context, string) (assessment.PreparedQuizStage, error)
}
type preparedQuizActivator interface {
	SetPreparedQuizEnabled(context.Context, string, string, bool) (bool, bool, error)
}

func (s *Service) SetPreparedQuizEnabled(ctx context.Context, actor identity.User, id string, enabled bool) (bool, bool, error) {
	if !actor.HasRole(identity.RoleAdmin) || strings.TrimSpace(actor.ID) == "" {
		return false, false, ErrForbidden
	}
	if !preparedUUID.MatchString(id) {
		return false, false, ErrInvalidInput
	}
	repo, ok := s.repo.(preparedQuizActivator)
	if !ok {
		return false, false, ErrWorkflow
	}
	return repo.SetPreparedQuizEnabled(ctx, actor.ID, id, enabled)
}

func (s *Service) GetPreparedQuizStage(ctx context.Context, actor identity.User, id string) (assessment.PreparedQuizStage, error) {
	if !actor.HasRole(identity.RoleAdmin) || strings.TrimSpace(actor.ID) == "" {
		return assessment.PreparedQuizStage{}, ErrForbidden
	}
	if !preparedUUID.MatchString(id) {
		return assessment.PreparedQuizStage{}, ErrInvalidInput
	}
	repo, ok := s.repo.(preparedQuizStageReader)
	if !ok {
		return assessment.PreparedQuizStage{}, ErrWorkflow
	}
	return repo.GetPreparedQuizStage(ctx, id)
}

var preparedUUID = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

// StagePreparedQuiz saves a disabled administrative draft, not a public quiz.
func (s *Service) StagePreparedQuiz(ctx context.Context, actor identity.User, id string, in assessment.PreparedQuizStage) error {
	if !actor.HasRole(identity.RoleAdmin) || strings.TrimSpace(actor.ID) == "" {
		return ErrForbidden
	}
	if !preparedUUID.MatchString(id) || (in.Mode != "saher" && in.Mode != "central") || (in.AudienceType != "public" && in.AudienceType != "targeted") || len(in.UserIDs)+len(in.GroupIDs) > 1000 {
		return ErrInvalidInput
	}
	count := len(in.UserIDs) + len(in.GroupIDs)
	if (in.AudienceType == "public" && count != 0) || (in.AudienceType == "targeted" && count == 0) {
		return ErrInvalidInput
	}
	for _, ids := range [][]string{in.UserIDs, in.GroupIDs} {
		seen := make(map[string]bool, len(ids))
		for _, target := range ids {
			canonical := strings.ToLower(target)
			if !preparedUUID.MatchString(target) || seen[canonical] {
				return ErrInvalidInput
			}
			seen[canonical] = true
		}
	}
	repo, ok := s.repo.(preparedQuizStager)
	if !ok {
		return ErrWorkflow
	}
	return repo.StagePreparedQuiz(ctx, actor.ID, id, in)
}
