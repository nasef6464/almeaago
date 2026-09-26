package application

import (
	"context"
	"strings"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

var ErrAttemptExpired = assessment.ErrAttemptExpired
var ErrAttemptSubmitted = assessment.ErrAttemptSubmitted
var ErrResultUnavailable = assessment.ErrResultUnavailable

type AttemptRepository interface {
	Start(context.Context, string, string, string) (assessment.Attempt, error)
	GetAttempt(context.Context, string) (assessment.Attempt, error)
	SaveAnswer(context.Context, string, string, string, assessment.AnswerWrite) (assessment.Attempt, error)
	Submit(context.Context, string, string, string) (assessment.Result, error)
	GetResult(context.Context, string) (assessment.Result, error)
	ListResults(context.Context, string, int, int) (assessment.ResultPage, error)
	GetResultDetail(context.Context, string, string) (assessment.ResultDetail, error)
}

type AttemptService struct{ repo AttemptRepository }

func NewAttemptService(r AttemptRepository) *AttemptService { return &AttemptService{repo: r} }

func requireStudent(a identity.User) error {
	if strings.TrimSpace(a.ID) == "" || !a.HasRole(identity.RoleStudent) {
		return ErrForbidden
	}
	return nil
}

func key(v string) string {
	v = strings.TrimSpace(v)
	if len(v) > 160 {
		return ""
	}
	return v
}

func (s *AttemptService) Start(ctx context.Context, a identity.User, assessmentID, startKey string) (assessment.Attempt, error) {
	if requireStudent(a) != nil {
		return assessment.Attempt{}, ErrForbidden
	}
	assessmentID = strings.TrimSpace(assessmentID)
	startKey = key(startKey)
	if assessmentID == "" || startKey == "" {
		return assessment.Attempt{}, ErrInvalidInput
	}
	return s.repo.Start(ctx, a.ID, assessmentID, startKey)
}

func (s *AttemptService) Get(ctx context.Context, a identity.User, id string) (assessment.Attempt, error) {
	if requireStudent(a) != nil {
		return assessment.Attempt{}, ErrForbidden
	}
	x, e := s.repo.GetAttempt(ctx, strings.TrimSpace(id))
	if e != nil {
		return x, e
	}
	if x.StudentID != a.ID {
		return assessment.Attempt{}, ErrForbidden
	}
	return x, nil
}

func (s *AttemptService) Save(ctx context.Context, a identity.User, id, qid string, w assessment.AnswerWrite) (assessment.Attempt, error) {
	if requireStudent(a) != nil {
		return assessment.Attempt{}, ErrForbidden
	}
	if strings.TrimSpace(id) == "" || strings.TrimSpace(qid) == "" || w.TimeSpentSeconds < 0 || w.TimeSpentSeconds > 86400 {
		return assessment.Attempt{}, ErrInvalidInput
	}
	if w.SelectedOptionIndex == nil && strings.TrimSpace(w.TextAnswer) == "" {
		return assessment.Attempt{}, ErrInvalidInput
	}
	if w.SelectedOptionIndex != nil && strings.TrimSpace(w.TextAnswer) != "" {
		return assessment.Attempt{}, ErrInvalidInput
	}
	return s.repo.SaveAnswer(ctx, a.ID, id, qid, w)
}

func (s *AttemptService) Submit(ctx context.Context, a identity.User, id, submissionKey string) (assessment.Result, error) {
	if requireStudent(a) != nil {
		return assessment.Result{}, ErrForbidden
	}
	submissionKey = key(submissionKey)
	if strings.TrimSpace(id) == "" || submissionKey == "" {
		return assessment.Result{}, ErrInvalidInput
	}
	return s.repo.Submit(ctx, a.ID, id, submissionKey)
}

func (s *AttemptService) Result(ctx context.Context, a identity.User, id string) (assessment.Result, error) {
	if requireStudent(a) != nil {
		return assessment.Result{}, ErrForbidden
	}
	x, e := s.repo.GetAttempt(ctx, strings.TrimSpace(id))
	if e != nil {
		return assessment.Result{}, e
	}
	if x.StudentID != a.ID {
		return assessment.Result{}, ErrForbidden
	}
	return s.repo.GetResult(ctx, id)
}

func (s *AttemptService) Results(ctx context.Context, a identity.User, page, limit int) (assessment.ResultPage, error) {
	if requireStudent(a) != nil {
		return assessment.ResultPage{}, ErrForbidden
	}
	if page < 1 {
		page = 1
	}
	if page > 10000 {
		return assessment.ResultPage{}, ErrInvalidInput
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	return s.repo.ListResults(ctx, a.ID, page, limit)
}

func (s *AttemptService) ResultDetail(ctx context.Context, a identity.User, id string) (assessment.ResultDetail, error) {
	if requireStudent(a) != nil {
		return assessment.ResultDetail{}, ErrForbidden
	}
	id = strings.TrimSpace(id)
	if id == "" {
		return assessment.ResultDetail{}, ErrInvalidInput
	}
	return s.repo.GetResultDetail(ctx, a.ID, id)
}
