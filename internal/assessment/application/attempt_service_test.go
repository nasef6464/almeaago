package application

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

type fakeAttemptRepo struct {
	a               assessment.Attempt
	r               assessment.Result
	page            assessment.ResultPage
	detail          assessment.ResultDetail
	err             error
	lastStudent     string
	lastPage        int
	lastLimit       int
	lastDetail      string
	submitCalls     int
	singleShotCalls int
	access          assessment.AccessContext
}
func (f *fakeAttemptRepo) GetPublishedAccessContext(context.Context, string) (assessment.AccessContext, error) {
	if f.access.AssessmentKind == "" {
		return assessment.AccessContext{AssessmentKind: assessment.KindNormal, BaseAccess: assessment.AccessFree, PathID: "path-1", SubjectID: "subject-1"}, f.err
	}
	return f.access, f.err
}
func (f *fakeAttemptRepo) FindDirectStart(context.Context, string, string, string) (assessment.Attempt, bool, error) {
	return assessment.Attempt{}, false, f.err
}
func (f *fakeAttemptRepo) Start(context.Context, string, string, string) (assessment.Attempt, error) {
	return f.a, f.err
}
func (f *fakeAttemptRepo) GetAttempt(context.Context, string) (assessment.Attempt, error) {
	return f.a, f.err
}
func (f *fakeAttemptRepo) SaveAnswer(context.Context, string, string, string, assessment.AnswerWrite) (assessment.Attempt, error) {
	return f.a, f.err
}
func (f *fakeAttemptRepo) Submit(context.Context, string, string, string) (assessment.Result, error) {
	f.submitCalls++
	return f.r, f.err
}
func (f *fakeAttemptRepo) GetResult(context.Context, string) (assessment.Result, error) {
	return f.r, f.err
}
func (f *fakeAttemptRepo) ListResults(_ context.Context, student string, page, limit int) (assessment.ResultPage, error) {
	f.lastStudent = student
	f.lastPage = page
	f.lastLimit = limit
	return f.page, f.err
}
func (f *fakeAttemptRepo) GetResultDetail(_ context.Context, student, id string) (assessment.ResultDetail, error) {
	f.lastStudent = student
	f.lastDetail = id
	return f.detail, f.err
}
func (f *fakeAttemptRepo) SingleShotSubmit(_ context.Context, student, assessmentID string, req assessment.SingleShotSubmissionRequest) (assessment.ResultDetail, error) {
	f.singleShotCalls++
	f.lastStudent = student
	f.lastDetail = assessmentID
	return f.detail, f.err
}

func student(id string) identity.User {
	return identity.User{ID: id, Roles: []identity.Role{identity.RoleStudent}}
}

func TestAttemptStudentOnly(t *testing.T) {
	s := NewAttemptService(&fakeAttemptRepo{})
	_, e := s.Start(context.Background(), identity.User{ID: "t", Roles: []identity.Role{identity.RoleTeacher}}, "a", "key")
	if !errors.Is(e, ErrForbidden) {
		t.Fatalf("want forbidden got %v", e)
	}
}

func TestAttemptOwnership(t *testing.T) {
	s := NewAttemptService(&fakeAttemptRepo{a: assessment.Attempt{ID: "x", StudentID: "other"}})
	_, e := s.Get(context.Background(), student("me"), "x")
	if !errors.Is(e, ErrForbidden) {
		t.Fatalf("want forbidden got %v", e)
	}
}

func TestAttemptRequiresIdempotencyKeys(t *testing.T) {
	s := NewAttemptService(&fakeAttemptRepo{})
	if _, e := s.Start(context.Background(), student("s"), "a", ""); !errors.Is(e, ErrInvalidInput) {
		t.Fatalf("start: %v", e)
	}
	if _, e := s.Submit(context.Background(), student("s"), "a", ""); !errors.Is(e, ErrInvalidInput) {
		t.Fatalf("submit: %v", e)
	}
}

func TestAttemptAnswerShape(t *testing.T) {
	s := NewAttemptService(&fakeAttemptRepo{})
	i := 1
	if _, e := s.Save(context.Background(), student("s"), "a", "q", assessment.AnswerWrite{SelectedOptionIndex: &i, TextAnswer: "both"}); !errors.Is(e, ErrInvalidInput) {
		t.Fatalf("want invalid got %v", e)
	}
	negative := -1
	if _, e := s.Save(context.Background(), student("s"), "a", "q", assessment.AnswerWrite{SelectedOptionIndex: &negative}); !errors.Is(e, ErrInvalidInput) {
		t.Fatalf("negative option: want invalid got %v", e)
	}
}

func TestResultHistoryIsStudentOwnedAndBounded(t *testing.T) {
	repo := &fakeAttemptRepo{}
	s := NewAttemptService(repo)

	if _, err := s.Results(context.Background(), student("student-1"), 0, 500); err != nil {
		t.Fatal(err)
	}
	if repo.lastStudent != "student-1" || repo.lastPage != 1 || repo.lastLimit != 100 {
		t.Fatalf("unexpected bounded query: student=%q page=%d limit=%d", repo.lastStudent, repo.lastPage, repo.lastLimit)
	}
	if _, err := s.Results(context.Background(), student("student-1"), 10001, 20); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected bounded page error, got %v", err)
	}
}

func TestResultDetailUsesAuthenticatedStudent(t *testing.T) {
	repo := &fakeAttemptRepo{}
	s := NewAttemptService(repo)

	if _, err := s.ResultDetail(context.Background(), student("student-1"), " attempt-1 "); err != nil {
		t.Fatal(err)
	}
	if repo.lastStudent != "student-1" || repo.lastDetail != "attempt-1" {
		t.Fatalf("unexpected detail scope student=%q id=%q", repo.lastStudent, repo.lastDetail)
	}
}

func TestResultViewsRejectNonStudent(t *testing.T) {
	repo := &fakeAttemptRepo{}
	s := NewAttemptService(repo)
	teacher := identity.User{ID: "teacher-1", Roles: []identity.Role{identity.RoleTeacher}}

	if _, err := s.Results(context.Background(), teacher, 1, 20); !errors.Is(err, ErrForbidden) {
		t.Fatalf("history: expected forbidden, got %v", err)
	}
	if _, err := s.ResultDetail(context.Background(), teacher, "attempt-1"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("detail: expected forbidden, got %v", err)
	}
}

type fakeAttemptEvidenceRepo struct {
	*fakeAttemptRepo
	event       learning.SubmissionEvidence
	sourceCalls int
}

func (f *fakeAttemptEvidenceRepo) LearningSubmissionEvidence(_ context.Context, student, attemptID string) (learning.SubmissionEvidence, error) {
	f.sourceCalls++
	event := f.event
	event.StudentID = student
	event.AttemptID = attemptID
	return event, nil
}

type fakeEvidenceSink struct {
	calls     int
	failFirst bool
}

func (s *fakeEvidenceSink) ApplyAssessmentSubmission(_ context.Context, event learning.SubmissionEvidence) error {
	s.calls++
	if s.failFirst && s.calls == 1 {
		return errors.New("temporary learning failure")
	}
	if event.StudentID == "" || event.AttemptID == "" {
		return errors.New("missing evidence identity")
	}
	return nil
}

func TestAttemptSubmitRetriesLearningHandoffWithSameAssessmentResult(t *testing.T) {
	base := &fakeAttemptRepo{r: assessment.Result{AttemptID: "attempt-1", Score: 75}}
	repo := &fakeAttemptEvidenceRepo{
		fakeAttemptRepo: base,
		event: learning.SubmissionEvidence{
			AssessmentID: "assessment-1", AssessmentVersion: 1,
			PathID: "path-1", SubjectID: "subject-1", OccurredAt: time.Now(),
			Questions: []learning.QuestionEvidence{{QuestionID: "q-1", QuestionVersion: 1}},
		},
	}
	sink := &fakeEvidenceSink{failFirst: true}
	service := NewAttemptServiceWithLearning(repo, sink)

	if _, err := service.Submit(context.Background(), student("student-1"), "attempt-1", "submission-key"); err == nil {
		t.Fatal("first learning handoff should surface retryable failure")
	}
	result, err := service.Submit(context.Background(), student("student-1"), "attempt-1", "submission-key")
	if err != nil {
		t.Fatal(err)
	}
	if result.AttemptID != "attempt-1" || sink.calls != 2 || repo.sourceCalls != 2 {
		t.Fatalf("retry handoff mismatch result=%#v sink=%d source=%d", result, sink.calls, repo.sourceCalls)
	}
}

func TestDirectPaidAttemptRequiresCommerceEntitlement(t *testing.T) {
	repo := &fakeAttemptRepo{
		a: assessment.Attempt{ID: "attempt-1"},
		access: assessment.AccessContext{
			AssessmentID: "assessment-1", AssessmentKind: assessment.KindNormal,
			BaseAccess: assessment.AccessPaid, PathID: "path-1", SubjectID: "subject-1",
		},
	}
	denied := &recordingCommerceAccess{commerceAccessStub: commerceAccessStub{allowed: false, reason: "paid_required"}}
	service := NewAttemptServiceWithLearningAndCommerce(repo, nil, denied)
	if _, err := service.Start(context.Background(), student("student-1"), "assessment-1", "start-key"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected paid direct attempt forbidden, got %v", err)
	}
	if denied.calls != 1 {
		t.Fatalf("expected one commerce check, got %d", denied.calls)
	}

	allowed := &recordingCommerceAccess{commerceAccessStub: commerceAccessStub{allowed: true, reason: "user_entitlement"}}
	service = NewAttemptServiceWithLearningAndCommerce(repo, nil, allowed)
	out, err := service.Start(context.Background(), student("student-1"), "assessment-1", "start-key-2")
	if err != nil || out.ID != "attempt-1" {
		t.Fatalf("entitled direct attempt failed: %#v %v", out, err)
	}
}

func TestSingleShotSubmit(t *testing.T) {
	now := time.Now().UTC()
	repo := &fakeAttemptRepo{
		detail: assessment.ResultDetail{
			AssessmentID: "quiz-123",
			Title:        "اختبار تجريبي في القدرات",
			Result: assessment.Result{
				AttemptID:        "attempt-999",
				Score:            85.0,
				TotalQuestions:   10,
				CorrectAnswers:   8,
				WrongAnswers:     1,
				Unanswered:       1,
				Passed:           true,
				TimeSpentSeconds: 150,
				FinalizedAt:      now,
			},
		},
	}
	service := NewAttemptService(repo)

	req := assessment.SingleShotSubmissionRequest{
		Answers:          map[string]int{"q-1": 0, "q-2": 2},
		TimeSpentSeconds: 150,
		Source:           "exam_runner",
		SubmissionKey:    "sub-key-123",
	}

	res, err := service.SingleShotSubmit(context.Background(), student("student-1"), "quiz-123", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if res.QuizID != "quiz-123" {
		t.Errorf("expected QuizID='quiz-123', got %s", res.QuizID)
	}
	if res.Score != 85.0 {
		t.Errorf("expected Score=85.0, got %f", res.Score)
	}
	if res.TotalQuestions != 10 || res.CorrectAnswers != 8 || res.WrongAnswers != 1 || res.Unanswered != 1 {
		t.Errorf("unexpected question counts in result: %+v", res)
	}
	if !res.Passed {
		t.Errorf("expected passed=true")
	}
	if res.TimeSpent != "2 دقيقة و 30 ثانية" {
		t.Errorf("expected TimeSpent='2 دقيقة و 30 ثانية', got %q", res.TimeSpent)
	}
}

func TestSingleShotLearningHandoffFailureIsRetryable(t *testing.T) {
	repo := &fakeAttemptEvidenceRepo{
		fakeAttemptRepo: &fakeAttemptRepo{detail: assessment.ResultDetail{
			AssessmentID: "quiz-1",
			Result: assessment.Result{
				AttemptID: "attempt-1", FinalizedAt: time.Now().UTC(),
			},
		}},
		event: learning.SubmissionEvidence{
			AssessmentID: "quiz-1", AssessmentVersion: 1,
			PathID: "path-1", SubjectID: "subject-1", OccurredAt: time.Now(),
			Questions: []learning.QuestionEvidence{{QuestionID: "q-1", QuestionVersion: 1}},
		},
	}
	sink := &fakeEvidenceSink{failFirst: true}
	service := NewAttemptServiceWithLearning(repo, sink)
	request := assessment.SingleShotSubmissionRequest{
		SubmissionKey: "same-submission-key",
		Answers:       map[string]int{"q-1": 1},
	}
	if _, err := service.SingleShotSubmit(context.Background(), student("student-1"), "quiz-1", request); err == nil {
		t.Fatal("learning handoff failure must not be reported as a successful result")
	}
	result, err := service.SingleShotSubmit(context.Background(), student("student-1"), "quiz-1", request)
	if err != nil {
		t.Fatalf("idempotent retry must complete learning handoff: %v", err)
	}
	if result.AttemptID != "attempt-1" || sink.calls != 2 || repo.sourceCalls != 2 {
		t.Fatalf("retry mismatch result=%#v sink=%d source=%d", result, sink.calls, repo.sourceCalls)
	}
}

func TestSingleShotLearningHandoffRequiresEvidenceSource(t *testing.T) {
	repo := &fakeAttemptRepo{detail: assessment.ResultDetail{
		Result: assessment.Result{AttemptID: "attempt-1", FinalizedAt: time.Now().UTC()},
	}}
	service := NewAttemptServiceWithLearning(repo, &fakeEvidenceSink{})
	_, err := service.SingleShotSubmit(context.Background(), student("student-1"), "quiz-1",
		assessment.SingleShotSubmissionRequest{SubmissionKey: "submission-key"})
	if err == nil {
		t.Fatal("missing evidence source must not silently drop skill analysis")
	}
	if repo.singleShotCalls != 0 {
		t.Fatal("missing evidence source must fail before single-shot persistence")
	}
}

func TestSingleShotRejectsInvalidSubmissionBeforeRepository(t *testing.T) {
	tests := []struct {
		name    string
		request assessment.SingleShotSubmissionRequest
	}{
		{"missing idempotency key", assessment.SingleShotSubmissionRequest{Answers: map[string]int{"q-1": 0}}},
		{"oversized idempotency key", assessment.SingleShotSubmissionRequest{SubmissionKey: strings.Repeat("x", 161)}},
		{"invalid answer index below unanswered sentinel", assessment.SingleShotSubmissionRequest{SubmissionKey: "key", Answers: map[string]int{"q-1": -2}}},
		{"empty question id", assessment.SingleShotSubmissionRequest{SubmissionKey: "key", Answers: map[string]int{" ": 0}}},
		{"negative duration", assessment.SingleShotSubmissionRequest{SubmissionKey: "key", TimeSpentSeconds: -1}},
		{"excessive duration", assessment.SingleShotSubmissionRequest{SubmissionKey: "key", TimeSpentSeconds: 86401}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			repo := &fakeAttemptRepo{}
			service := NewAttemptService(repo)
			_, err := service.SingleShotSubmit(context.Background(), student("student-1"), "quiz-1", tc.request)
			if !errors.Is(err, ErrInvalidInput) {
				t.Fatalf("expected invalid input before persistence, got %v", err)
			}
			if repo.lastStudent != "" {
				t.Fatal("invalid submission reached repository")
			}
		})
	}
}

func TestSingleShotUnansweredLegacySentinelIsOmittedWithoutMutatingCaller(t *testing.T) {
	repo := &fakeAttemptRepo{}
	service := NewAttemptService(repo)
	answers := map[string]int{"q-unanswered": -1, "q-answered": 2}
	request := assessment.SingleShotSubmissionRequest{
		SubmissionKey: "legacy-unanswered",
		Answers: answers,
	}
	if _, err := service.SingleShotSubmit(context.Background(), student("student-1"), "quiz-1", request); err != nil {
		t.Fatalf("legacy unanswered sentinel should be accepted: %v", err)
	}
	if got := answers["q-unanswered"]; got != -1 {
		t.Fatalf("caller answers map was mutated: %d", got)
	}
}

func TestSingleShotRejectsTeacherBeforeRepository(t *testing.T) {
	repo := &fakeAttemptRepo{}
	service := NewAttemptService(repo)
	_, err := service.SingleShotSubmit(context.Background(), identity.User{ID: "teacher-1", Roles: []identity.Role{identity.RoleTeacher}}, "quiz-1",
		assessment.SingleShotSubmissionRequest{SubmissionKey: "key"})
	if !errors.Is(err, ErrForbidden) || repo.lastStudent != "" {
		t.Fatalf("teacher submission should be denied before persistence: err=%v student=%q", err, repo.lastStudent)
	}
}

func TestAttemptSubmitMissingLearningSourceDoesNotFinalize(t *testing.T) {
	repo := &fakeAttemptRepo{r: assessment.Result{AttemptID: "attempt-1"}}
	service := NewAttemptServiceWithLearning(repo, &fakeEvidenceSink{})
	_, err := service.Submit(context.Background(), student("student-1"), "attempt-1", "submission-key")
	if err == nil {
		t.Fatal("missing evidence source must fail closed")
	}
	if repo.submitCalls != 0 {
		t.Fatalf("submission finalized before evidence integration was validated: %d", repo.submitCalls)
	}
}
