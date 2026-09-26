package application

import (
	"context"
	"errors"
	"strings"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

type LessonProgressRepository interface {
	GetLessonProgress(context.Context, string, string, learning.LessonProgressContext, string, string) (learning.LessonProgress, error)
	SaveVideoProgress(context.Context, string, string, learning.LessonProgressContext, string, string, int) (learning.LessonProgress, error)
	CompleteLesson(context.Context, string, string, learning.LessonProgressContext, string, string) (learning.LessonProgress, error)
}

type LessonProgressContentResolver interface {
	ResolveLessonProgressTarget(context.Context, string, string, string) (bool, string, int, error)
}

type LessonProgressService struct {
	repo    LessonProgressRepository
	content LessonProgressContentResolver
}

func NewLessonProgressService(repo LessonProgressRepository, content LessonProgressContentResolver) *LessonProgressService {
	return &LessonProgressService{repo: repo, content: content}
}

func normalizeLessonContext(in learning.LessonProgressContextInput) (learning.LessonProgressContextInput, error) {
	in.CourseID = strings.TrimSpace(in.CourseID)
	in.TopicID = strings.TrimSpace(in.TopicID)
	switch in.ContextType {
	case learning.LessonProgressCourse:
		if in.CourseID == "" || in.TopicID != "" {
			return in, ErrInvalidInput
		}
	case learning.LessonProgressFoundation:
		if in.TopicID == "" || in.CourseID != "" {
			return in, ErrInvalidInput
		}
	default:
		return in, ErrInvalidInput
	}
	return in, nil
}

func (s *LessonProgressService) validateTarget(ctx context.Context, lessonID string, in learning.LessonProgressContextInput) (string, int, error) {
	if s.content == nil {
		return "", 0, ErrForbidden
	}
	contextID := in.CourseID
	if in.ContextType == learning.LessonProgressFoundation {
		contextID = in.TopicID
	}
	ok, lessonType, duration, err := s.content.ResolveLessonProgressTarget(ctx, string(in.ContextType), contextID, lessonID)
	if err != nil {
		return "", 0, err
	}
	if !ok {
		return "", 0, ErrNotFound
	}
	return lessonType, duration, nil
}

func emptyLessonProgress(lessonID string, in learning.LessonProgressContextInput) learning.LessonProgress {
	return learning.LessonProgress{
		LessonID: lessonID, ContextType: in.ContextType, CourseID: in.CourseID, TopicID: in.TopicID,
		Status: learning.LessonNotStarted,
	}
}

func (s *LessonProgressService) Get(ctx context.Context, actor identity.User, lessonID string, in learning.LessonProgressContextInput) (learning.LessonProgress, error) {
	if requireStudent(actor) != nil {
		return learning.LessonProgress{}, ErrForbidden
	}
	lessonID = strings.TrimSpace(lessonID)
	if lessonID == "" {
		return learning.LessonProgress{}, ErrInvalidInput
	}
	var err error
	in, err = normalizeLessonContext(in)
	if err != nil {
		return learning.LessonProgress{}, err
	}
	if _, _, err = s.validateTarget(ctx, lessonID, in); err != nil {
		return learning.LessonProgress{}, err
	}
	out, err := s.repo.GetLessonProgress(ctx, actor.ID, lessonID, in.ContextType, in.CourseID, in.TopicID)
	if errors.Is(err, learning.ErrNotFound) {
		return emptyLessonProgress(lessonID, in), nil
	}
	return out, err
}

func (s *LessonProgressService) SaveVideo(ctx context.Context, actor identity.User, lessonID string, in learning.VideoProgressWrite) (learning.LessonProgress, error) {
	if requireStudent(actor) != nil {
		return learning.LessonProgress{}, ErrForbidden
	}
	lessonID = strings.TrimSpace(lessonID)
	if lessonID == "" || in.PositionSeconds < 0 || in.PositionSeconds > 86400 {
		return learning.LessonProgress{}, ErrInvalidInput
	}
	ctxInput, err := normalizeLessonContext(in.LessonProgressContextInput)
	if err != nil {
		return learning.LessonProgress{}, err
	}
	lessonType, duration, err := s.validateTarget(ctx, lessonID, ctxInput)
	if err != nil {
		return learning.LessonProgress{}, err
	}
	if lessonType != "video" {
		return learning.LessonProgress{}, ErrInvalidInput
	}
	if duration > 0 && in.PositionSeconds > duration {
		in.PositionSeconds = duration
	}
	return s.repo.SaveVideoProgress(ctx, actor.ID, lessonID, ctxInput.ContextType, ctxInput.CourseID, ctxInput.TopicID, in.PositionSeconds)
}

func (s *LessonProgressService) Complete(ctx context.Context, actor identity.User, lessonID string, in learning.LessonProgressContextInput) (learning.LessonProgress, error) {
	if requireStudent(actor) != nil {
		return learning.LessonProgress{}, ErrForbidden
	}
	lessonID = strings.TrimSpace(lessonID)
	if lessonID == "" {
		return learning.LessonProgress{}, ErrInvalidInput
	}
	var err error
	in, err = normalizeLessonContext(in)
	if err != nil {
		return learning.LessonProgress{}, err
	}
	if _, _, err = s.validateTarget(ctx, lessonID, in); err != nil {
		return learning.LessonProgress{}, err
	}
	return s.repo.CompleteLesson(ctx, actor.ID, lessonID, in.ContextType, in.CourseID, in.TopicID)
}
