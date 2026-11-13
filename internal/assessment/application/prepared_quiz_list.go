package application

import (
	"context"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type preparedQuizLister interface {
	ListPreparedQuizzes(context.Context, string) ([]assessment.PreparedQuizCard, error)
}

func (s *Service) ListPreparedQuizzes(ctx context.Context, actor identity.User) ([]assessment.PreparedQuizCard, error) {
	if requireStudent(actor) != nil {
		return nil, ErrForbidden
	}
	repo, ok := s.repo.(preparedQuizLister)
	if !ok {
		return nil, ErrWorkflow
	}
	return repo.ListPreparedQuizzes(ctx, actor.ID)
}
