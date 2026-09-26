package application

import (
	"context"

	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

type reviewRepository interface {
	ReviewBatch(context.Context, []question.ReviewRef) ([]question.ReviewProjection, error)
}

func (s *Service) ReviewBatch(ctx context.Context, refs []question.ReviewRef) ([]question.ReviewProjection, error) {
	if len(refs) == 0 {
		return []question.ReviewProjection{}, nil
	}
	if len(refs) > 50 {
		return nil, ErrInvalidInput
	}
	repo, ok := s.repo.(reviewRepository)
	if !ok {
		return nil, ErrInvalidInput
	}
	return repo.ReviewBatch(ctx, refs)
}
