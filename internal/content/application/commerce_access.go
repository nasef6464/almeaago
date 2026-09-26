package application

import (
	"context"
	"strings"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type CourseAccessResolver interface {
	CheckCourseAccess(ctx context.Context, userID, courseID string) (allowed bool, configured bool, reason string, productID string, err error)
}

func (s *Service) applyCourseAccess(ctx context.Context, actor identity.User, row *content.LearnerCourse) error {
	if s.courseAccess == nil {
		row.AccessAllowed = false
		row.AccessConfigured = false
		row.AccessReason = "commerce_unavailable"
		for mi := range row.Modules {
			for li := range row.Modules[mi].Lessons {
				if !row.Modules[mi].Lessons[li].IsPreview {
					row.Modules[mi].Lessons[li].CommerceLocked = true
				}
			}
		}
		return nil
	}
	allowed, configured, reason, productID, err := s.courseAccess.CheckCourseAccess(ctx, actor.ID, row.Course.ID)
	if err != nil {
		return err
	}
	row.AccessAllowed = allowed
	row.AccessConfigured = configured
	row.AccessReason = reason
	row.AccessProductID = productID
	if !allowed {
		for mi := range row.Modules {
			for li := range row.Modules[mi].Lessons {
				if !row.Modules[mi].Lessons[li].IsPreview {
					row.Modules[mi].Lessons[li].CommerceLocked = true
				}
			}
		}
	}
	return nil
}

func (s *Service) checkCourseLessonAccess(ctx context.Context, actor identity.User, courseID string, row content.LearnerLessonDetail) error {
	if row.IsPreview {
		return nil
	}
	if s.courseAccess == nil {
		return ErrForbidden
	}
	allowed, _, _, _, err := s.courseAccess.CheckCourseAccess(ctx, actor.ID, strings.TrimSpace(courseID))
	if err != nil {
		return err
	}
	if !allowed {
		return ErrForbidden
	}
	return nil
}
