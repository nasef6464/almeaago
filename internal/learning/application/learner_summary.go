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

type CertificateReader interface {
	ListMyCertificates(context.Context, string) ([]learning.CourseCertificate, error)
	GetCertificateByCode(context.Context, string) (learning.CertificateVerification, error)
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

func (s *LessonProgressService) MyCertificates(ctx context.Context, actor identity.User) ([]learning.CourseCertificate, error) {
	if requireStudent(actor) != nil {
		return nil, ErrForbidden
	}
	reader, ok := s.repo.(CertificateReader)
	if !ok {
		return nil, ErrForbidden
	}
	return reader.ListMyCertificates(ctx, actor.ID)
}

func (s *LessonProgressService) CertificateByCode(ctx context.Context, verificationCode string) (learning.CertificateVerification, error) {
	code := strings.TrimSpace(verificationCode)
	if code == "" || len(code) > 80 {
		return learning.CertificateVerification{}, ErrInvalidInput
	}
	reader, ok := s.repo.(CertificateReader)
	if !ok {
		return learning.CertificateVerification{}, ErrNotFound
	}
	return reader.GetCertificateByCode(ctx, code)
}
