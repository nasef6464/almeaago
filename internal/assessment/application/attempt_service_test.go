package application

import (
	"context"
	"errors"
	"testing"
	"time"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

type fakeAttemptRepo struct {
	a           assessment.Attempt
	r           assessment.Result
	page        assessment.ResultPage
	detail      assessment.ResultDetail
	err         error
	lastStudent string
	lastPage    int
	lastLimit   int
	lastDetail  string
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
	event learning.SubmissionEvidence
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
	calls int
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
