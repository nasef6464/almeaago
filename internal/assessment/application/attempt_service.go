package application

import (
	"context"
	"errors"
	"strings"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

var ErrAttemptExpired = assessment.ErrAttemptExpired
var ErrAttemptSubmitted = assessment.ErrAttemptSubmitted
var ErrResultUnavailable = assessment.ErrResultUnavailable

type AttemptRepository interface {
	GetPublishedAccessContext(context.Context, string) (assessment.AccessContext, error)
	FindDirectStart(context.Context, string, string, string) (assessment.Attempt, bool, error)
	Start(context.Context, string, string, string) (assessment.Attempt, error)
	GetAttempt(context.Context, string) (assessment.Attempt, error)
	SaveAnswer(context.Context, string, string, string, assessment.AnswerWrite) (assessment.Attempt, error)
	Submit(context.Context, string, string, string) (assessment.Result, error)
	GetResult(context.Context, string) (assessment.Result, error)
	ListResults(context.Context, string, int, int) (assessment.ResultPage, error)
	GetResultDetail(context.Context, string, string) (assessment.ResultDetail, error)
}

type SubmissionEvidenceSource interface {
	LearningSubmissionEvidence(context.Context, string, string) (learning.SubmissionEvidence, error)
}

type LearningEvidenceSink interface {
	ApplyAssessmentSubmission(context.Context, learning.SubmissionEvidence) error
}

type AttemptService struct {
	repo         AttemptRepository
	evidenceSink LearningEvidenceSink
	access       CommerceAccessResolver
}

func NewAttemptService(r AttemptRepository) *AttemptService { return &AttemptService{repo: r} }

func NewAttemptServiceWithLearning(r AttemptRepository, sink LearningEvidenceSink) *AttemptService {
	return &AttemptService{repo: r, evidenceSink: sink}
}

func NewAttemptServiceWithLearningAndCommerce(r AttemptRepository, sink LearningEvidenceSink, access CommerceAccessResolver) *AttemptService {
	return &AttemptService{repo: r, evidenceSink: sink, access: access}
}

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
	existing, found, err := s.repo.FindDirectStart(ctx, a.ID, assessmentID, startKey)
	if err != nil {
		return assessment.Attempt{}, err
	}
	if found {
		return existing, nil
	}
	scope, err := s.repo.GetPublishedAccessContext(ctx, assessmentID)
	if err != nil {
		return assessment.Attempt{}, err
	}
	allowed, _, err := resolveDirectAssessmentAccess(ctx, s.access, a.ID, scope)
	if err != nil {
		return assessment.Attempt{}, err
	}
	if !allowed {
		return assessment.Attempt{}, ErrForbidden
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
	result, err := s.repo.Submit(ctx, a.ID, id, submissionKey)
	if err != nil {
		return result, err
	}
	if s.evidenceSink == nil {
		return result, nil
	}
	source, ok := s.repo.(SubmissionEvidenceSource)
	if !ok {
		return result, errors.New("assessment learning evidence source is not configured")
	}
	event, err := source.LearningSubmissionEvidence(ctx, a.ID, id)
	if err != nil {
		return result, err
	}
	if err = s.evidenceSink.ApplyAssessmentSubmission(ctx, event); err != nil {
		return result, err
	}
	return result, nil
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
