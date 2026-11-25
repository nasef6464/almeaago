package application

import (
	"context"
	"regexp"
	"strings"
	"unicode/utf8"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

var (
	qaUUIDPattern      = regexp.MustCompile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")
	qaRequestIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{8,128}$`)
)

type QALiveRepository interface {
	ListQAQuestions(ctx context.Context, includeHidden bool, courseID, filter, search string, limit int) (content.QAListResult, error)
	CreateQAQuestion(ctx context.Context, authorID, courseID, pathID, subjectID, subjectName, question, requestID string) (content.QAQuestion, error)
	ListQAReplies(ctx context.Context, questionID string) ([]content.QAReply, error)
	CreateQAReply(ctx context.Context, questionID, authorID, body, requestID string, isInstructor bool) (content.QAReply, error)
	ResolveQAQuestion(ctx context.Context, actorID, questionID string) error
	ListLearnerLiveSessions(ctx context.Context, userID string, includeHidden bool) (content.LearnerLiveSessionsFeed, error)
	GetLearnerLiveLesson(ctx context.Context, userID, lessonID string, includeHidden bool) (content.LearnerLiveLesson, error)
}

func isQAStaff(actor identity.User) bool {
	return actor.HasRole(identity.RoleAdmin) ||
		actor.HasRole(identity.RoleTeacher) ||
		actor.HasRole(identity.RoleSupervisor)
}

func (s *Service) ListQAQuestions(ctx context.Context, actor identity.User, courseID, filter, search string, limit int) (content.QAListResult, error) {
	if strings.TrimSpace(actor.ID) == "" {
		return content.QAListResult{}, ErrForbidden
	}
	courseID = strings.TrimSpace(courseID)
	if courseID != "" && !qaUUIDPattern.MatchString(courseID) {
		return content.QAListResult{}, ErrInvalidInput
	}
	filter = strings.TrimSpace(filter)
	if filter == "" {
		filter = "all"
	}
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}
	repo, ok := s.repo.(QALiveRepository)
	if !ok {
		return content.QAListResult{}, content.ErrConflict
	}
	return repo.ListQAQuestions(ctx, isQAStaff(actor), courseID, filter, strings.TrimSpace(search), limit)
}

func (s *Service) CreateQAQuestion(ctx context.Context, actor identity.User, courseID, pathID, subjectID, subjectName, question, requestID string) (content.QAQuestion, error) {
	if strings.TrimSpace(actor.ID) == "" {
		return content.QAQuestion{}, ErrForbidden
	}
	courseID = strings.TrimSpace(courseID)
	pathID = strings.TrimSpace(pathID)
	subjectID = strings.TrimSpace(subjectID)
	subjectName = strings.TrimSpace(subjectName)
	question = strings.TrimSpace(question)
	requestID = strings.TrimSpace(requestID)

	if courseID != "" && !qaUUIDPattern.MatchString(courseID) {
		return content.QAQuestion{}, ErrInvalidInput
	}
	if pathID != "" && !qaUUIDPattern.MatchString(pathID) {
		return content.QAQuestion{}, ErrInvalidInput
	}
	if subjectID != "" && !qaUUIDPattern.MatchString(subjectID) {
		return content.QAQuestion{}, ErrInvalidInput
	}
	if utf8.RuneCountInString(question) < 2 || utf8.RuneCountInString(question) > 2000 || utf8.RuneCountInString(subjectName) > 160 {
		return content.QAQuestion{}, ErrInvalidInput
	}
	if !qaRequestIDPattern.MatchString(requestID) {
		return content.QAQuestion{}, ErrInvalidInput
	}
	repo, ok := s.repo.(QALiveRepository)
	if !ok {
		return content.QAQuestion{}, content.ErrConflict
	}
	return repo.CreateQAQuestion(ctx, actor.ID, courseID, pathID, subjectID, subjectName, question, requestID)
}

func (s *Service) ListQAReplies(ctx context.Context, actor identity.User, questionID string) ([]content.QAReply, error) {
	if strings.TrimSpace(actor.ID) == "" {
		return nil, ErrForbidden
	}
	questionID = strings.TrimSpace(questionID)
	if !qaUUIDPattern.MatchString(questionID) {
		return nil, ErrInvalidInput
	}
	repo, ok := s.repo.(QALiveRepository)
	if !ok {
		return nil, content.ErrConflict
	}
	return repo.ListQAReplies(ctx, questionID)
}

func (s *Service) CreateQAReply(ctx context.Context, actor identity.User, questionID, body, requestID string) (content.QAReply, error) {
	if strings.TrimSpace(actor.ID) == "" {
		return content.QAReply{}, ErrForbidden
	}
	questionID = strings.TrimSpace(questionID)
	body = strings.TrimSpace(body)
	requestID = strings.TrimSpace(requestID)
	if !qaUUIDPattern.MatchString(questionID) || utf8.RuneCountInString(body) < 1 || utf8.RuneCountInString(body) > 2000 || !qaRequestIDPattern.MatchString(requestID) {
		return content.QAReply{}, ErrInvalidInput
	}
	repo, ok := s.repo.(QALiveRepository)
	if !ok {
		return content.QAReply{}, content.ErrConflict
	}
	return repo.CreateQAReply(ctx, questionID, actor.ID, body, requestID, isQAStaff(actor))
}

func (s *Service) ResolveQAQuestion(ctx context.Context, actor identity.User, questionID string) error {
	if strings.TrimSpace(actor.ID) == "" || !isQAStaff(actor) {
		return ErrForbidden
	}
	questionID = strings.TrimSpace(questionID)
	if !qaUUIDPattern.MatchString(questionID) {
		return ErrInvalidInput
	}
	repo, ok := s.repo.(QALiveRepository)
	if !ok {
		return content.ErrConflict
	}
	return repo.ResolveQAQuestion(ctx, actor.ID, questionID)
}

func (s *Service) ListLearnerLiveSessions(ctx context.Context, actor identity.User) (content.LearnerLiveSessionsFeed, error) {
	if strings.TrimSpace(actor.ID) == "" {
		return content.LearnerLiveSessionsFeed{}, ErrForbidden
	}
	repo, ok := s.repo.(QALiveRepository)
	if !ok {
		return content.LearnerLiveSessionsFeed{}, content.ErrConflict
	}
	return repo.ListLearnerLiveSessions(ctx, actor.ID, isQAStaff(actor))
}

func (s *Service) GetLearnerLiveLesson(ctx context.Context, actor identity.User, lessonID string) (content.LearnerLiveLesson, error) {
	if strings.TrimSpace(actor.ID) == "" {
		return content.LearnerLiveLesson{}, ErrForbidden
	}
	lessonID = strings.TrimSpace(lessonID)
	if !qaUUIDPattern.MatchString(lessonID) {
		return content.LearnerLiveLesson{}, ErrInvalidInput
	}
	repo, ok := s.repo.(QALiveRepository)
	if !ok {
		return content.LearnerLiveLesson{}, content.ErrConflict
	}
	return repo.GetLearnerLiveLesson(ctx, actor.ID, lessonID, isQAStaff(actor))
}
