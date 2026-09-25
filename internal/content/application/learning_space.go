package application

import (
	"context"
	"strings"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

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
	return s.repo.GetLearningSpace(ctx, pathID, subjectID, limit)
}

func (s *Service) LearnerCourse(ctx context.Context, actor identity.User, courseID string) (content.LearnerCourse, error) {
	if strings.TrimSpace(actor.ID) == "" {
		return content.LearnerCourse{}, ErrForbidden
	}
	courseID = strings.TrimSpace(courseID)
	if courseID == "" {
		return content.LearnerCourse{}, ErrInvalidInput
	}
	return s.repo.GetLearnerCourse(ctx, courseID)
}

func (s *Service) LearnerTopic(ctx context.Context, actor identity.User, topicID string) (content.LearnerTopic, error) {
	if strings.TrimSpace(actor.ID) == "" {
		return content.LearnerTopic{}, ErrForbidden
	}
	topicID = strings.TrimSpace(topicID)
	if topicID == "" {
		return content.LearnerTopic{}, ErrInvalidInput
	}
	return s.repo.GetLearnerTopic(ctx, topicID)
}
