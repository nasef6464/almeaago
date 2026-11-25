package application

import (
	"context"
	"strings"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

type LearnerSummaryReader interface {
	GetAchievementsSummary(context.Context, string) (learning.LearnerAchievementsSummary, error)
	ListCoursesProgressSummary(context.Context, string) ([]learning.LearnerCourseProgressSummary, error)
	IssueCourseCertificate(context.Context, string, string) (learning.CourseCertificate, error)
}

func (s *LessonProgressService) AchievementsSummary(ctx context.Context, actor identity.User) (learning.LearnerAchievementsSummary, error) {
	if requireStudent(actor) != nil {
		return learning.LearnerAchievementsSummary{}, ErrForbidden
	}
	reader, ok := s.repo.(LearnerSummaryReader)
	if !ok {
		return learning.LearnerAchievementsSummary{}, ErrForbidden
	}
	return reader.GetAchievementsSummary(ctx, actor.ID)
}

func (s *LessonProgressService) CoursesProgressSummary(ctx context.Context, actor identity.User) ([]learning.LearnerCourseProgressSummary, error) {
	if requireStudent(actor) != nil {
		return nil, ErrForbidden
	}
	reader, ok := s.repo.(LearnerSummaryReader)
	if !ok {
		return nil, ErrForbidden
	}
	return reader.ListCoursesProgressSummary(ctx, actor.ID)
}

func (s *LessonProgressService) IssueCourseCertificate(ctx context.Context, actor identity.User, courseID string) (learning.CourseCertificate, error) {
	if requireStudent(actor) != nil {
		return learning.CourseCertificate{}, ErrForbidden
	}
	courseID = strings.TrimSpace(courseID)
	if !bookingUUIDPattern.MatchString(courseID) {
		return learning.CourseCertificate{}, ErrInvalidInput
	}
	reader, ok := s.repo.(LearnerSummaryReader)
	if !ok {
		return learning.CourseCertificate{}, ErrForbidden
	}
	return reader.IssueCourseCertificate(ctx, actor.ID, courseID)
}
