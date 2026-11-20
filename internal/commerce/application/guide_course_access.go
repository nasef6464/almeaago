package application

import (
	"context"
	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	"strings"
)

type guestGuideCourseRepository interface {
	ResolveGuestGuideCourseAccess(context.Context, string) (commerce.AccessDecision, error)
}

// CheckGuideCourseAccess reports catalog access; it never grants a session or
// exposes lesson contents. Signed-in checks reuse the normal course policy.
func (s *Service) CheckGuideCourseAccess(ctx context.Context, userID, courseID string) (commerce.AccessDecision, error) {
	userID, courseID = strings.TrimSpace(userID), strings.TrimSpace(courseID)
	if courseID == "" {
		return commerce.AccessDecision{}, ErrInvalidInput
	}
	if userID != "" {
		allowed, configured, reason, err := s.CheckCourseAccess(ctx, userID, courseID)
		return commerce.AccessDecision{Allowed: allowed, Configured: configured, Reason: reason}, err
	}
	if s.catalog == nil {
		return commerce.AccessDecision{}, commerce.ErrConflict
	}
	_, _, eligible, err := s.catalog.CourseCommerceScope(ctx, courseID)
	if err != nil {
		return commerce.AccessDecision{}, err
	}
	if !eligible {
		return commerce.AccessDecision{Configured: false, Reason: "course_unavailable"}, nil
	}
	repo, ok := s.repo.(guestGuideCourseRepository)
	if !ok {
		return commerce.AccessDecision{}, commerce.ErrConflict
	}
	return repo.ResolveGuestGuideCourseAccess(ctx, courseID)
}
