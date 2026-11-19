package application

import (
	"context"
	"regexp"
	"strings"
	"unicode/utf8"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type lessonDiscussionRepository interface {
	ListLessonDiscussion(context.Context, string, string, int, int) (content.LessonDiscussionPage, error)
	CreateLessonDiscussion(context.Context, string, string, string, string, string, string) (content.LessonDiscussionMessage, error)
}

var discussionRequestIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{16,128}$`)

// Learners need their exact lesson entitlement. Staff must own or be assigned
// the course and have author scope; both paths verify the exact lesson placement.
func (s *Service) discussionAccess(ctx context.Context, actor identity.User, courseID, lessonID string) error {
	if strings.TrimSpace(actor.ID) == "" {
		return ErrForbidden
	}
	if actor.HasRole(identity.RoleStudent) {
		_, err := s.LearnerCourseLesson(ctx, actor, courseID, lessonID)
		if err == nil || !isStaff(actor) {
			return err
		}
	}
	if !isStaff(actor) {
		return ErrForbidden
	}
	if _, err := s.StaffCourse(ctx, actor, courseID); err != nil {
		return err
	}
	_, err := s.repo.GetLearnerCourseLesson(ctx, strings.TrimSpace(courseID), strings.TrimSpace(lessonID))
	return err
}

func (s *Service) LessonDiscussion(ctx context.Context, actor identity.User, courseID, lessonID string, page, limit int) (content.LessonDiscussionPage, error) {
	if page == 0 {
		page = 1
	}
	if limit == 0 {
		limit = 30
	}
	if page < 1 || page > 10000 || limit < 1 || limit > 50 {
		return content.LessonDiscussionPage{}, ErrInvalidInput
	}
	if err := s.discussionAccess(ctx, actor, courseID, lessonID); err != nil {
		return content.LessonDiscussionPage{}, err
	}
	repo, ok := s.repo.(lessonDiscussionRepository)
	if !ok {
		return content.LessonDiscussionPage{}, content.ErrConflict
	}
	out, err := repo.ListLessonDiscussion(ctx, strings.TrimSpace(courseID), strings.TrimSpace(lessonID), page, limit)
	if err != nil {
		return content.LessonDiscussionPage{}, err
	}
	if out.Items == nil {
		out.Items = []content.LessonDiscussionMessage{}
	}
	return out, nil
}

func (s *Service) AddLessonDiscussion(ctx context.Context, actor identity.User, courseID, lessonID, parentID, body, requestID string) (content.LessonDiscussionMessage, error) {
	body = strings.TrimSpace(body)
	parentID = strings.TrimSpace(parentID)
	if body == "" || !utf8.ValidString(body) || utf8.RuneCountInString(body) > 2000 || !discussionRequestIDPattern.MatchString(requestID) {
		return content.LessonDiscussionMessage{}, ErrInvalidInput
	}
	if err := s.discussionAccess(ctx, actor, courseID, lessonID); err != nil {
		return content.LessonDiscussionMessage{}, err
	}
	repo, ok := s.repo.(lessonDiscussionRepository)
	if !ok {
		return content.LessonDiscussionMessage{}, content.ErrConflict
	}
	return repo.CreateLessonDiscussion(ctx, strings.TrimSpace(courseID), strings.TrimSpace(lessonID), actor.ID, parentID, body, requestID)
}
