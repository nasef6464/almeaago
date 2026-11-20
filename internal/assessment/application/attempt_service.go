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
	SingleShotSubmit(context.Context, string, string, assessment.SingleShotSubmissionRequest) (assessment.ResultDetail, error)
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
		// Never trust an idempotency lookup to authorize another student's attempt.
		// Validate the returned identity even when the repository scopes its query.
		if existing.StudentID != a.ID || existing.AssessmentID != assessmentID {
			return assessment.Attempt{}, ErrForbidden
		}
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
	id = strings.TrimSpace(id)
	if id == "" {
		return assessment.Attempt{}, ErrInvalidInput
	}
	x, e := s.repo.GetAttempt(ctx, id)
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
	if w.SelectedOptionIndex != nil && *w.SelectedOptionIndex < 0 {
		return assessment.Attempt{}, ErrInvalidInput
	}
	return s.repo.SaveAnswer(ctx, a.ID, strings.TrimSpace(id), strings.TrimSpace(qid), w)
}

func (s *AttemptService) Submit(ctx context.Context, a identity.User, id, submissionKey string) (assessment.Result, error) {
	if requireStudent(a) != nil {
		return assessment.Result{}, ErrForbidden
	}
	id = strings.TrimSpace(id)
	submissionKey = key(submissionKey)
	if id == "" || submissionKey == "" {
		return assessment.Result{}, ErrInvalidInput
	}
	// Fail before finalizing the attempt if learning handoff cannot possibly run.
	// A finalized attempt without a configured evidence source cannot be retried
	// safely into the student's skill analysis.
	if s.evidenceSink != nil {
		if _, ok := s.repo.(SubmissionEvidenceSource); !ok {
			return assessment.Result{}, errors.New("assessment learning evidence source is not configured")
		}
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
	id = strings.TrimSpace(id)
	if id == "" {
		return assessment.Result{}, ErrInvalidInput
	}
	x, e := s.repo.GetAttempt(ctx, id)
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

func (s *AttemptService) SingleShotSubmit(
	ctx context.Context,
	actor identity.User,
	assessmentID string,
	req assessment.SingleShotSubmissionRequest,
) (assessment.SingleShotQuizResultDTO, error) {
	if requireStudent(actor) != nil {
		return assessment.SingleShotQuizResultDTO{}, ErrForbidden
	}
	assessmentID = strings.TrimSpace(assessmentID)
	// Validate before writing an attempt: the same bounded idempotency key is
	// required for both normal and single-shot submissions.
	if assessmentID == "" || key(req.SubmissionKey) == "" || strings.TrimSpace(req.SubmissionKey) == "" {
		return assessment.SingleShotQuizResultDTO{}, ErrInvalidInput
	}
	req.SubmissionKey = key(req.SubmissionKey)
	if req.TimeSpentSeconds < 0 || req.TimeSpentSeconds > 86400 {
		return assessment.SingleShotQuizResultDTO{}, ErrInvalidInput
	}
	// Copy answers so normalization cannot mutate the caller's map.
	answers := make(map[string]int, len(req.Answers))
	seenQuestionIDs := make(map[string]struct{}, len(req.Answers))
	for questionID, option := range req.Answers {
		// Normalize IDs before persistence and reject ambiguous duplicates:
		// two caller keys must never silently overwrite the same answer row.
		questionID = strings.TrimSpace(questionID)
		if questionID == "" || option < -1 {
			return assessment.SingleShotQuizResultDTO{}, ErrInvalidInput
		}
		if _, exists := seenQuestionIDs[questionID]; exists {
			return assessment.SingleShotQuizResultDTO{}, ErrInvalidInput
		}
		seenQuestionIDs[questionID] = struct{}{}
		// Legacy sends -1 for unanswered questions. PostgreSQL represents
		// these as missing answer rows, so omit the sentinel when persisting.
		if option >= 0 {
			answers[questionID] = option
		}
	}
	req.Answers = answers

	// Validate the learning integration before the repository commits a
	// single-shot result. A missing evidence source is a configuration error,
	// not a successful assessment with silently missing skill analysis.
	if s.evidenceSink != nil {
		if _, ok := s.repo.(SubmissionEvidenceSource); !ok {
			return assessment.SingleShotQuizResultDTO{}, errors.New("assessment learning evidence source is not configured")
		}
	}
	detail, err := s.repo.SingleShotSubmit(ctx, actor.ID, assessmentID, req)
	if err != nil {
		return assessment.SingleShotQuizResultDTO{}, err
	}

	if s.evidenceSink != nil {
		source, ok := s.repo.(SubmissionEvidenceSource)
		if !ok {
			return assessment.SingleShotQuizResultDTO{}, errors.New("assessment learning evidence source is not configured")
		}
		evidence, err := source.LearningSubmissionEvidence(ctx, actor.ID, detail.Result.AttemptID)
		if err != nil {
			return assessment.SingleShotQuizResultDTO{}, err
		}
		if err := s.evidenceSink.ApplyAssessmentSubmission(ctx, evidence); err != nil {
			return assessment.SingleShotQuizResultDTO{}, err
		}
	}

	dateStr := detail.Result.FinalizedAt.Format("2006-01-02")
	timeSpentStr := assessment.FormatTimeSpent(detail.Result.TimeSpentSeconds)

	skills := []assessment.ResultSkillAnalysisItem{}
	if detail.SkillAnalysis != nil && len(detail.SkillAnalysis.Items) > 0 {
		skills = detail.SkillAnalysis.Items
	}
	review := detail.Questions
	if review == nil {
		review = []assessment.ReviewQuestion{}
	}

	return assessment.SingleShotQuizResultDTO{
		ID:               detail.Result.AttemptID,
		AttemptID:        detail.Result.AttemptID,
		QuizID:           detail.AssessmentID,
		QuizTitle:        detail.Title,
		Score:            detail.Result.Score,
		TotalQuestions:   detail.Result.TotalQuestions,
		CorrectAnswers:   detail.Result.CorrectAnswers,
		WrongAnswers:     detail.Result.WrongAnswers,
		Unanswered:       detail.Result.Unanswered,
		Passed:           detail.Result.Passed,
		TimeSpentSeconds: detail.Result.TimeSpentSeconds,
		TimeSpent:        timeSpentStr,
		Date:             dateStr,
		FinalizedAt:      detail.Result.FinalizedAt,
		SkillsAnalysis:   skills,
		QuestionReview:   review,
		Result:           detail.Result,
	}, nil
}
