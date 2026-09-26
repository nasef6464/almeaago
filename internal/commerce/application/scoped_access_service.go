package application

import (
	"context"
	"strings"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
)

type ScopedAccessRepository interface {
	ResolveScopedAccess(context.Context, string, []string, string, string, string, commerce.ContentType, bool) (commerce.AccessDecision, error)
}

func (s *Service) CheckAssessmentAccess(
	ctx context.Context,
	userID, pathID, subjectID, courseID string,
	contentType commerce.ContentType,
	packageOnly bool,
) (commerce.AccessDecision, error) {
	userID = strings.TrimSpace(userID)
	pathID = strings.TrimSpace(pathID)
	subjectID = strings.TrimSpace(subjectID)
	courseID = strings.TrimSpace(courseID)
	if userID == "" || pathID == "" ||
		(contentType != commerce.ContentTests && contentType != commerce.ContentMockExams) {
		return commerce.AccessDecision{}, ErrInvalidInput
	}
	repo, ok := s.repo.(ScopedAccessRepository)
	if !ok {
		return commerce.AccessDecision{}, commerce.ErrConflict
	}
	var schoolIDs []string
	var err error
	if s.schools != nil {
		schoolIDs, err = s.schools.ActiveSchoolIDsForUser(ctx, userID)
		if err != nil {
			return commerce.AccessDecision{}, err
		}
	}
	return repo.ResolveScopedAccess(ctx, userID, schoolIDs, pathID, subjectID, courseID, contentType, packageOnly)
}
