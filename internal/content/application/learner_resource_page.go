package application

import (
	"context"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	"strings"
)

type learnerResourcePager interface {
	ListLearnerResourcePage(context.Context, string, string, string, int, int) (content.LearnerResourcePage, error)
}

func (s *Service) LearnerResourcePage(ctx context.Context, actor identity.User, pathID, subjectID, kind string, page, limit int) (content.LearnerResourcePage, error) {
	pathID, subjectID = strings.TrimSpace(pathID), strings.TrimSpace(subjectID)
	if page == 0 {
		page = 1
	}
	if limit == 0 {
		limit = 50
	}
	if pathID == "" || subjectID == "" || (kind != "courses" && kind != "library") || page < 1 || page > 10000 || limit < 1 || limit > 50 {
		return content.LearnerResourcePage{}, ErrInvalidInput
	}
	repo, ok := s.repo.(learnerResourcePager)
	if !ok {
		return content.LearnerResourcePage{}, content.ErrConflict
	}
	out, err := repo.ListLearnerResourcePage(ctx, pathID, subjectID, kind, page, limit)
	if err != nil {
		return content.LearnerResourcePage{}, err
	}
	if out.PathID != pathID || out.SubjectID != subjectID || out.Page != page {
		return content.LearnerResourcePage{}, content.ErrConflict
	}
	if kind == "library" {
		if err := s.applyLibraryAccess(ctx, actor, pathID, subjectID, out.Library); err != nil {
			return content.LearnerResourcePage{}, err
		}
	}
	return out, nil
}
