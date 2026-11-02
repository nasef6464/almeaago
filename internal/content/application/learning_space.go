package application

import (
	"context"
	"errors"
	"strings"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type foundationLessonRepository interface {
	GetLearnerFoundationLesson(context.Context, string, string) (content.FoundationLessonDetail, error)
}
type foundationAccessResolver interface {
	CheckFoundationAccess(context.Context, string, string, string) (commerce.AccessDecision, error)
}

// LearnerFoundationLesson resolves an exact topic-to-lesson placement before
// exposing lesson content. A locked topic or lesson requires an entitlement.
func (s *Service) LearnerFoundationLesson(ctx context.Context, actor identity.User, topicID, lessonID string) (content.LearnerLessonDetail, error) {
	topicID, lessonID = strings.TrimSpace(topicID), strings.TrimSpace(lessonID)
	if topicID == "" || lessonID == "" {
		return content.LearnerLessonDetail{}, ErrInvalidInput
	}
	repo, ok := s.repo.(foundationLessonRepository)
	if !ok {
		return content.LearnerLessonDetail{}, ErrForbidden
	}
	row, err := repo.GetLearnerFoundationLesson(ctx, topicID, lessonID)
	if err != nil {
		return content.LearnerLessonDetail{}, err
	}
	if !strings.EqualFold(row.TopicID, topicID) || !strings.EqualFold(row.Lesson.ID, lessonID) || strings.TrimSpace(row.PathID) == "" || strings.TrimSpace(row.SubjectID) == "" {
		return content.LearnerLessonDetail{}, ErrForbidden
	}
	// Admins and teachers bypass lock
	if actor.HasRole(identity.RoleAdmin) || actor.HasRole(identity.RoleTeacher) {
		return row.Lesson, nil
	}
	// If the topic or lesson is locked, student must be authenticated and entitled
	if row.TopicLocked || row.Lesson.IsLocked {
		if strings.TrimSpace(actor.ID) == "" || !actor.HasRole(identity.RoleStudent) {
			return content.LearnerLessonDetail{}, ErrForbidden
		}
		access, ok := s.courseAccess.(foundationAccessResolver)
		if !ok {
			return content.LearnerLessonDetail{}, ErrForbidden
		}
		decision, err := access.CheckFoundationAccess(ctx, actor.ID, row.PathID, row.SubjectID)
		if err != nil {
			return content.LearnerLessonDetail{}, err
		}
		if !decision.Allowed {
			return content.LearnerLessonDetail{}, ErrForbidden
		}
	}
	return row.Lesson, nil
}

// ResolveFoundationLessonProgressTarget shares the reader's entitlement check.
func (s *Service) ResolveFoundationLessonProgressTarget(ctx context.Context, actor identity.User, topicID, lessonID string) (bool, string, int, error) {
	row, err := s.LearnerFoundationLesson(ctx, actor, topicID, lessonID)
	if errors.Is(err, content.ErrNotFound) || errors.Is(err, ErrForbidden) {
		return false, "", 0, nil
	}
	if err != nil {
		return false, "", 0, err
	}
	return true, string(row.LessonType), row.DurationSeconds, nil
}

func (s *Service) LearningSpace(ctx context.Context, actor identity.User, pathID, subjectID string, limit int) (content.LearningSpace, error) {
	if strings.TrimSpace(actor.ID) == "" {
		return content.LearningSpace{}, ErrForbidden
	}
	pathID = strings.TrimSpace(pathID)
	subjectID = strings.TrimSpace(subjectID)
	if limit == 0 {
		limit = 24
	}
	if pathID == "" || subjectID == "" || limit < 1 || limit > 50 {
		return content.LearningSpace{}, ErrInvalidInput
	}
	row, err := s.repo.GetLearningSpace(ctx, pathID, subjectID, limit)
	if err != nil {
		return content.LearningSpace{}, err
	}
	// A learner may switch subjects while a request is in flight. Never return
	// another path/subject's catalog as a successful response for this scope.
	if row.PathID != pathID || row.SubjectID != subjectID {
		return content.LearningSpace{}, content.ErrConflict
	}
	return row, nil
}

func (s *Service) LearnerCourse(ctx context.Context, actor identity.User, courseID string) (content.LearnerCourse, error) {
	if strings.TrimSpace(actor.ID) == "" {
		return content.LearnerCourse{}, ErrForbidden
	}
	courseID = strings.TrimSpace(courseID)
	if courseID == "" {
		return content.LearnerCourse{}, ErrInvalidInput
	}
	row, err := s.repo.GetLearnerCourse(ctx, courseID)
	if err != nil {
		return content.LearnerCourse{}, err
	}
	if err := s.applyCourseAccess(ctx, actor, &row); err != nil {
		return content.LearnerCourse{}, err
	}
	return row, nil
}

func (s *Service) LearnerTopic(ctx context.Context, actor identity.User, topicID string) (content.LearnerTopic, error) {
	topicID = strings.TrimSpace(topicID)
	if topicID == "" {
		return content.LearnerTopic{}, ErrInvalidInput
	}
	return s.repo.GetLearnerTopic(ctx, topicID)
}

func (s *Service) LearnerCourseLesson(ctx context.Context, actor identity.User, courseID, lessonID string) (content.LearnerLessonDetail, error) {
	if strings.TrimSpace(actor.ID) == "" {
		return content.LearnerLessonDetail{}, ErrForbidden
	}
	courseID = strings.TrimSpace(courseID)
	lessonID = strings.TrimSpace(lessonID)
	if courseID == "" || lessonID == "" {
		return content.LearnerLessonDetail{}, ErrInvalidInput
	}
	row, err := s.repo.GetLearnerCourseLesson(ctx, courseID, lessonID)
	if err != nil {
		return content.LearnerLessonDetail{}, err
	}
	if err := s.checkCourseLessonAccess(ctx, actor, courseID, row); err != nil {
		return content.LearnerLessonDetail{}, err
	}
	return row, nil
}
