package application

import (
	"context"
	"strings"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type learnerFoundationPager interface {
	ListLearnerFoundationPage(context.Context, string, string, int, int) (content.LearnerFoundationPage, error)
}

func (s *Service) LearnerFoundationPage(ctx context.Context, actor identity.User, pathID, subjectID string, page, limit int) (content.LearnerFoundationPage, error) {
	pathID, subjectID = strings.TrimSpace(pathID), strings.TrimSpace(subjectID)
	if page == 0 {
		page = 1
	}
	if limit == 0 {
		limit = 50
	}
	if pathID == "" || subjectID == "" || page < 1 || page > 10000 || limit < 1 || limit > 50 {
		return content.LearnerFoundationPage{}, ErrInvalidInput
	}
	repo, ok := s.repo.(learnerFoundationPager)
	if !ok {
		return content.LearnerFoundationPage{}, content.ErrConflict
	}
	out, err := repo.ListLearnerFoundationPage(ctx, pathID, subjectID, page, limit)
	if err != nil {
		return content.LearnerFoundationPage{}, err
	}
	if out.PathID != pathID || out.SubjectID != subjectID || out.Page != page {
		return content.LearnerFoundationPage{}, content.ErrConflict
	}
	if out.Items == nil {
		out.Items = []content.LearnerTopicSummary{}
	}
	locked := false
	for i := range out.Items {
		out.Items[i].IsFree = !out.Items[i].IsLocked
		locked = locked || out.Items[i].IsLocked
	}
	if locked && strings.TrimSpace(actor.ID) != "" && actor.HasRole(identity.RoleStudent) {
		if access, ok := s.courseAccess.(foundationAccessResolver); ok {
			decision, err := access.CheckFoundationAccess(ctx, actor.ID, pathID, subjectID)
			if err != nil {
				return content.LearnerFoundationPage{}, err
			}
			if decision.Allowed {
				for i := range out.Items {
					out.Items[i].IsLocked = false
				}
			}
		}
	}
	return out, nil
}
