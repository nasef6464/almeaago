package application

import (
	"context"
	"errors"
	"strings"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

var ErrAttemptExpired = assessment.ErrAttemptExpired
var ErrAttemptSubmitted = assessment.ErrAttemptSubmitted
var ErrResultUnavailable = assessment.ErrResultUnavailable

type AttemptRepository interface {
	GetPublishedAccessContext(context.Context, string) (assessment.AccessContext, error)
	DirectPlacementAccessContexts(context.Context, string) (bool, []assessment.AccessContext, error)
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

type StrictSectionAdvancer interface {
	AdvanceStrictSection(context.Context, string, string, string) (assessment.Attempt, error)
}

type QuestionTimeRecorder interface {
	RecordQuestionTime(context.Context, string, string, string, int) (int, error)
}

func (s *AttemptService) RecordTime(ctx context.Context, actor identity.User, id, questionID string, seconds int) (int, error) {
	if requireStudent(actor) != nil {
		return 0, ErrForbidden
	}
	id, questionID = strings.TrimSpace(id), strings.TrimSpace(questionID)
	if id == "" || questionID == "" || seconds < 0 || seconds > 86400 {
		return 0, ErrInvalidInput
	}
	recorder, ok := s.repo.(QuestionTimeRecorder)
	if !ok {
		return 0, ErrWorkflow
	}
	return recorder.RecordQuestionTime(ctx, actor.ID, id, questionID, seconds)
}

// Single-shot submissions must use the same direct entitlement policy as an
// ordinary attempt, while allowing an owned completed submission to be retried.
type singleShotAccessRepository interface {
	GetSingleShotAccessContext(context.Context, string) (assessment.AccessContext, bool, error)
	FindSingleShotResult(context.Context, string, string, string) (assessment.ResultDetail, bool, error)
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

func (s *AttemptService) AdvanceSection(ctx context.Context, actor identity.User, id, expectedSectionID string) (assessment.Attempt, error) {
	if err := requireStudent(actor); err != nil {
		return assessment.Attempt{}, err
	}
	id, expectedSectionID = strings.TrimSpace(id), strings.TrimSpace(expectedSectionID)
	if id == "" || expectedSectionID == "" {
		return assessment.Attempt{}, ErrInvalidInput
	}
	advancer, ok := s.repo.(StrictSectionAdvancer)
	if !ok {
		return assessment.Attempt{}, ErrWorkflow
	}
	return advancer.AdvanceStrictSection(ctx, actor.ID, id, expectedSectionID)
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
	allowed, _, err := s.canAccessDirectAssessment(ctx, a.ID, scope)
	if err != nil {
		return assessment.Attempt{}, err
	}
	if !allowed {
		return assessment.Attempt{}, ErrForbidden
	}
	return s.repo.Start(ctx, a.ID, assessmentID, startKey)
}

func (s *AttemptService) canAccessDirectAssessment(ctx context.Context, studentID string, scope assessment.AccessContext) (bool, string, error) {
	hasPlacements, scopes, err := s.repo.DirectPlacementAccessContexts(ctx, scope.AssessmentID)
	if err != nil {
		return false, "", err
	}
	if !hasPlacements {
		return resolveDirectAssessmentAccess(ctx, s.access, studentID, scope)
	}
	var accessErr error
	reason := "unavailable"
	for _, placement := range scopes {
		allowed, placementReason, err := resolvePlacementAssessmentAccess(ctx, s.access, studentID, placement)
		if err != nil {
			accessErr = err
			continue
		}
		if allowed {
			return true, placementReason, nil
		}
		if placementReason == "package_required" || placementReason == "paid_required" || reason == "unavailable" {
			reason = placementReason
		}
	}
	return false, reason, accessErr
}

// PreviewDirectAccess reports the same access policy as a new direct start,
// without creating an attempt. An empty student ID represents a guest.
func (s *AttemptService) PreviewDirectAccess(ctx context.Context, studentID, assessmentID string) (bool, string, error) {
	assessmentID = strings.TrimSpace(assessmentID)
	if assessmentID == "" {
		return false, "", ErrInvalidInput
	}
	scope, err := s.repo.GetPublishedAccessContext(ctx, assessmentID)
	if err != nil {
		return false, "", err
	}
	return s.canAccessDirectAssessment(ctx, strings.TrimSpace(studentID), scope)
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
		attempt, err := s.repo.GetAttempt(ctx, strings.TrimSpace(id))
		if err != nil {
			return assessment.Attempt{}, err
		}
		if attempt.StudentID != a.ID {
			return assessment.Attempt{}, ErrForbidden
		}
	}
	if w.SelectedOptionIndex != nil && strings.TrimSpace(w.TextAnswer) != "" {
		return assessment.Attempt{}, ErrInvalidInput
	}
	if w.SelectedOptionIndex != nil && *w.SelectedOptionIndex < 0 {
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
	detail, err := s.repo.GetResultDetail(ctx, a.ID, id)
	if err != nil || detail.SkillAnalysis == nil || s.access == nil {
		return detail, err
	}
	// The stored topic flag describes package gating, not this student's
	// entitlement. Resolve it once per subject before displaying a lock.
	type scope struct{ path, subject string }
	decisions := make(map[scope]bool)
	for i := range detail.SkillAnalysis.Items {
		skill := &detail.SkillAnalysis.Items[i]
		for j := range skill.FoundationTopics {
			topic := &skill.FoundationTopics[j]
			if !topic.IsLocked {
				continue
			}
			key := scope{skill.PathID, skill.SubjectID}
			allowed, checked := decisions[key]
			if !checked {
				decision, accessErr := s.access.CheckAssessmentAccess(ctx, a.ID, key.path, key.subject, "", commerce.ContentFoundation, true)
				allowed = accessErr == nil && decision.Allowed
				decisions[key] = allowed
			}
			if allowed {
				topic.IsLocked = false
			}
		}
	}
	return detail, nil
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
	if assessmentID == "" {
		return assessment.SingleShotQuizResultDTO{}, ErrInvalidInput
	}
	if req.Answers == nil {
		req.Answers = map[string]int{}
	}

	accessRepo, ok := s.repo.(singleShotAccessRepository)
	if !ok {
		return assessment.SingleShotQuizResultDTO{}, ErrWorkflow
	}
	var detail assessment.ResultDetail
	var found bool
	var err error
	if req.SubmissionKey != "" {
		detail, found, err = accessRepo.FindSingleShotResult(ctx, actor.ID, assessmentID, req.SubmissionKey)
		if err != nil {
			return assessment.SingleShotQuizResultDTO{}, err
		}
	}
	if !found {
		var scope assessment.AccessContext
		var strict bool
		scope, strict, err = accessRepo.GetSingleShotAccessContext(ctx, assessmentID)
		if err != nil {
			return assessment.SingleShotQuizResultDTO{}, err
		}
		if strict {
			return assessment.SingleShotQuizResultDTO{}, ErrForbidden
		}
		var allowed bool
		allowed, _, err = s.canAccessDirectAssessment(ctx, actor.ID, scope)
		if err != nil {
			return assessment.SingleShotQuizResultDTO{}, err
		}
		if !allowed {
			return assessment.SingleShotQuizResultDTO{}, ErrForbidden
		}
		detail, err = s.repo.SingleShotSubmit(ctx, actor.ID, assessmentID, req)
		if err != nil {
			return assessment.SingleShotQuizResultDTO{}, err
		}
	}

	if s.evidenceSink != nil {
		if source, ok := s.repo.(SubmissionEvidenceSource); ok {
			evidence, err := source.LearningSubmissionEvidence(ctx, actor.ID, detail.Result.AttemptID)
			if err == nil {
				_ = s.evidenceSink.ApplyAssessmentSubmission(ctx, evidence)
			}
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
