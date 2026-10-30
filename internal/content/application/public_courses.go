package application

import (
	"context"
	"errors"

	content "github.com/nasef6464/almeaago/internal/content/domain"
)

type publicCourseReader interface {
	ListPublicCourses(context.Context, int) ([]content.PublicCourse, error)
}

// PublicCourses deliberately uses a distinct anonymous read model, not the
// staff ListCourses API. The repository enforces publication and taxonomy scope.
func (s *Service) PublicCourses(ctx context.Context, limit int) ([]content.PublicCourse, error) {
	if limit < 1 || limit > 100 {
		return nil, ErrInvalidInput
	}
	if s == nil || s.repo == nil {
		return nil, errors.New("public course reader unavailable")
	}
	reader, ok := s.repo.(publicCourseReader)
	if !ok {
		return nil, errors.New("public course reader unavailable")
	}
	return reader.ListPublicCourses(ctx, limit)
}
