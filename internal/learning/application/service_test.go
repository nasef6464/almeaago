package application

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

type repoStub struct {
	progress      learning.SkillProgressPage
	weakest       *learning.SkillProgress
	cards         []learning.ReviewCard
	hasMore       bool
	applied       learning.SubmissionEvidence
	lastStudent   string
	lastPath      string
	lastSubject   string
	lastPage      int
	lastLimit     int
	lastTab       learning.ReviewTab
	savedQuestion string
	savedValue    bool
	dueCards      []learning.ReviewCard
	dueMore       bool
	card          learning.ReviewCard
	submission    *learning.ReviewSubmission
	answerResult  learning.ReviewSubmission
	answerEvent   learning.ReviewAnswerEvent
	answerCalls   int
	err           error
}

func (r *repoStub) ApplyAssessmentEvidence(_ context.Context, event learning.SubmissionEvidence) (learning.ApplyResult, error) {
	r.applied = event
	return learning.ApplyResult{InsertedEvidence: len(event.Questions)}, r.err
}
func (r *repoStub) ListSkillProgress(_ context.Context, student, path, subject string, page, limit int) (learning.SkillProgressPage, error) {
	r.lastStudent, r.lastPath, r.lastSubject, r.lastPage, r.lastLimit = student, path, subject, page, limit
	return r.progress, r.err
}
func (r *repoStub) WeakestSkillProgress(_ context.Context, student, path, subject string) (*learning.SkillProgress, error) {
	r.lastStudent, r.lastPath, r.lastSubject = student, path, subject
	return r.weakest, r.err
}
func (r *repoStub) ListReviewCards(_ context.Context, student string, tab learning.ReviewTab, path, subject string, page, limit int) ([]learning.ReviewCard, bool, error) {
	r.lastStudent, r.lastTab, r.lastPath, r.lastSubject, r.lastPage, r.lastLimit = student, tab, path, subject, page, limit
	return r.cards, r.hasMore, r.err
}
func (r *repoStub) SetSavedReview(_ context.Context, student, questionID string, saved bool) error {
	r.lastStudent, r.savedQuestion, r.savedValue = student, questionID, saved
	return r.err
}
func (r *repoStub) ListDueReviewCards(_ context.Context, student string, tab learning.ReviewTab, path, subject string, page, limit int, _ time.Time) ([]learning.ReviewCard, bool, error) {
	r.lastStudent, r.lastTab, r.lastPath, r.lastSubject, r.lastPage, r.lastLimit = student, tab, path, subject, page, limit
	return r.dueCards, r.dueMore, r.err
}
func (r *repoStub) GetReviewCard(_ context.Context, student, cardID string) (learning.ReviewCard, error) {
	r.lastStudent = student
	if r.card.ID != "" && r.card.ID != cardID {
		return learning.ReviewCard{}, learning.ErrNotFound
	}
	return r.card, r.err
}
func (r *repoStub) GetReviewSubmissionByKey(_ context.Context, student, _ string) (*learning.ReviewSubmission, error) {
	r.lastStudent = student
	return r.submission, r.err
}
func (r *repoStub) ApplyReviewAnswer(_ context.Context, event learning.ReviewAnswerEvent) (learning.ReviewSubmission, error) {
	r.answerCalls++
	r.answerEvent = event
	return r.answerResult, r.err
}

type questionReaderStub struct {
	refs []question.ReviewRef
	rows []question.ReviewProjection
	err  error
}

func (q *questionReaderStub) ReviewBatch(_ context.Context, refs []question.ReviewRef) ([]question.ReviewProjection, error) {
	q.refs = append([]question.ReviewRef(nil), refs...)
	return q.rows, q.err
}

func learner(id string) identity.User {
	return identity.User{ID: id, Roles: []identity.Role{identity.RoleStudent}}
}

func TestApplyAssessmentSubmissionValidatesAndForwardsCanonicalEvent(t *testing.T) {
	repo := &repoStub{}
	service := NewService(repo, &questionReaderStub{})
	event := learning.SubmissionEvidence{
		StudentID: "student-1", AttemptID: "attempt-1", AssessmentID: "assessment-1",
		AssessmentVersion: 2, PathID: "path-1", SubjectID: "subject-1",
		OccurredAt: time.Now(), Questions: []learning.QuestionEvidence{{
			QuestionID: "question-1", QuestionVersion: 3, Correct: false, SkillIDs: []string{"skill-1"},
		}},
	}
	if err := service.ApplyAssessmentSubmission(context.Background(), event); err != nil {
		t.Fatal(err)
	}
	if repo.applied.AttemptID != "attempt-1" || len(repo.applied.Questions) != 1 {
		t.Fatalf("canonical evidence not forwarded: %#v", repo.applied)
	}
	event.Questions = nil
	if err := service.ApplyAssessmentSubmission(context.Background(), event); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid empty evidence, got %v", err)
	}
}

func TestProgressAndReviewReadsAreStudentOwnedAndBounded(t *testing.T) {
	repo := &repoStub{
		cards: []learning.ReviewCard{{
			ID: "card-1", QuestionID: "question-1", QuestionVersion: 2,
			PathID: "path-1", SubjectID: "subject-1", HasMistake: true,
		}},
		hasMore: true,
	}
	reader := &questionReaderStub{rows: []question.ReviewProjection{{
		ID: "question-1", Version: 2, QuestionType: question.QuestionMCQ,
		TextContent: "سؤال", Options: []question.Option{{Index: 0, Text: "أ"}},
	}}}
	service := NewService(repo, reader)

	if _, err := service.Progress(context.Background(), learner("student-1"), " path-1 ", "", 0, 500); err != nil {
		t.Fatal(err)
	}
	if repo.lastStudent != "student-1" || repo.lastPath != "path-1" || repo.lastPage != 1 || repo.lastLimit != 100 {
		t.Fatalf("progress query not bounded/scoped: %#v", repo)
	}

	page, err := service.ReviewLibrary(context.Background(), learner("student-1"), learning.ReviewMistakes, "path-1", "subject-1", 0, 100)
	if err != nil {
		t.Fatal(err)
	}
	if repo.lastLimit != 50 || repo.lastPage != 1 || repo.lastTab != learning.ReviewMistakes {
		t.Fatalf("review query not bounded: page=%d limit=%d tab=%s", repo.lastPage, repo.lastLimit, repo.lastTab)
	}
	if len(reader.refs) != 1 || reader.refs[0].Version != 2 || len(page.Items) != 1 || !page.HasMore {
		t.Fatalf("review composition mismatch: refs=%#v page=%#v", reader.refs, page)
	}
}

func TestLearningViewsRejectNonStudentAndRequirePathScope(t *testing.T) {
	service := NewService(&repoStub{}, &questionReaderStub{})
	teacher := identity.User{ID: "teacher-1", Roles: []identity.Role{identity.RoleTeacher}}
	if _, err := service.Progress(context.Background(), teacher, "path-1", "", 1, 20); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
	if _, err := service.ReviewLibrary(context.Background(), learner("student-1"), learning.ReviewAll, "", "", 1, 20); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected exact path requirement, got %v", err)
	}
}

func TestSetSavedUsesAuthenticatedStudentOnly(t *testing.T) {
	repo := &repoStub{}
	service := NewService(repo, &questionReaderStub{})
	if err := service.SetSaved(context.Background(), learner("student-1"), " question-1 ", true); err != nil {
		t.Fatal(err)
	}
	if repo.lastStudent != "student-1" || repo.savedQuestion != "question-1" || !repo.savedValue {
		t.Fatalf("unexpected saved mutation: %#v", repo)
	}
}


func TestReviewPracticeIsBoundedAndDoesNotLeakAnswerKey(t *testing.T) {
	now := time.Now().UTC()
	repo := &repoStub{
		dueCards: []learning.ReviewCard{{
			ID: "card-1", QuestionID: "question-1", QuestionVersion: 2,
			PathID: "path-1", SubjectID: "subject-1", ReviewType: "error_recovery",
			NextReviewAt: now.Add(-time.Minute), UpdatedAt: now,
		}},
		dueMore: true,
	}
	correct := 1
	reader := &questionReaderStub{rows: []question.ReviewProjection{{
		ID: "question-1", Version: 2, QuestionType: question.QuestionMCQ,
		TextContent: "٢ + ٢ = ؟", CorrectOptionIndex: &correct,
		Explanation: "الإجابة أربعة", Hint: "اجمع", SolvingStrategy: "جمع مباشر",
		Options: []question.Option{{Index: 0, Text: "٣"}, {Index: 1, Text: "٤"}},
	}}}
	service := NewService(repo, reader)

	page, err := service.ReviewPractice(
		context.Background(), learner("student-1"), learning.ReviewMistakes,
		"path-1", "subject-1", 0, 100,
	)
	if err != nil {
		t.Fatal(err)
	}
	if repo.lastStudent != "student-1" || repo.lastPage != 1 || repo.lastLimit != 50 || repo.lastTab != learning.ReviewMistakes {
		t.Fatalf("practice query not bounded/scoped: %#v", repo)
	}
	if len(page.Items) != 1 || !page.HasMore || page.Items[0].Question.Text != "٢ + ٢ = ؟" {
		t.Fatalf("unexpected practice page: %#v", page)
	}
	raw, err := json.Marshal(page)
	if err != nil {
		t.Fatal(err)
	}
	payload := string(raw)
	for _, secret := range []string{"correctOptionIndex", "الإجابة أربعة", "اجمع", "جمع مباشر"} {
		if strings.Contains(payload, secret) {
			t.Fatalf("practice payload leaked %q: %s", secret, payload)
		}
	}
}

func TestSubmitReviewAnswerScoresOnServerAndCreatesRemediationEvidence(t *testing.T) {
	now := time.Now().UTC()
	repo := &repoStub{
		card: learning.ReviewCard{
			ID: "card-1", QuestionID: "question-1", QuestionVersion: 2,
			PathID: "path-1", SubjectID: "subject-1", ReviewType: "error_recovery",
			NextReviewAt: now.Add(-time.Minute), UpdatedAt: now,
		},
		answerResult: learning.ReviewSubmission{
			ID: "submission-1", StudentID: "student-1", CardID: "card-1",
			QuestionID: "question-1", QuestionVersion: 2, SelectedOptionIndex: 0,
			Correct: false, EvidenceType: learning.EvidenceRemediation, Quality: 2,
			ReviewTypeAfter: "error_recovery", NextReviewAt: now.Add(24 * time.Hour),
		},
	}
	correct := 1
	reader := &questionReaderStub{rows: []question.ReviewProjection{{
		ID: "question-1", Version: 2, QuestionType: question.QuestionMCQ,
		TextContent: "٢ + ٢ = ؟", CorrectOptionIndex: &correct, Explanation: "أربعة",
		Options: []question.Option{{Index: 0, Text: "٣"}, {Index: 1, Text: "٤"}},
	}}}
	service := NewService(repo, reader)
	result, err := service.SubmitReviewAnswer(
		context.Background(),
		learner("student-1"),
		"card-1",
		learning.ReviewAnswerWrite{
			SubmissionKey: "review-key-123",
			ExpectedCardUpdated: now,
			SelectedOptionIndex: 0,
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	if repo.answerCalls != 1 || repo.answerEvent.StudentID != "student-1" ||
		repo.answerEvent.Correct || repo.answerEvent.EvidenceType != learning.EvidenceRemediation ||
		repo.answerEvent.Quality != 2 {
		t.Fatalf("server scoring/evidence mismatch: %#v", repo.answerEvent)
	}
	if result.Correct || result.CorrectOptionIndex == nil || *result.CorrectOptionIndex != 1 ||
		result.Explanation != "أربعة" {
		t.Fatalf("unexpected post-answer feedback: %#v", result)
	}
}

func TestReviewAnswerIdempotentRetryDoesNotApplyEvidenceAgain(t *testing.T) {
	correct := 1
	repo := &repoStub{submission: &learning.ReviewSubmission{
		ID: "submission-1", StudentID: "student-1", CardID: "card-1",
		QuestionID: "question-1", QuestionVersion: 2, SelectedOptionIndex: 1,
		Correct: true, EvidenceType: learning.EvidenceMasteryReview, Quality: 4,
		ReviewTypeAfter: "mastery_review", NextReviewAt: time.Now().Add(24 * time.Hour),
	}}
	reader := &questionReaderStub{rows: []question.ReviewProjection{{
		ID: "question-1", Version: 2, CorrectOptionIndex: &correct,
		Options: []question.Option{{Index: 0}, {Index: 1}},
	}}}
	service := NewService(repo, reader)
	_, err := service.SubmitReviewAnswer(
		context.Background(), learner("student-1"), "card-1",
		learning.ReviewAnswerWrite{
			SubmissionKey: "same-key-123", ExpectedCardUpdated: time.Now(),
			SelectedOptionIndex: 1,
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	if repo.answerCalls != 0 {
		t.Fatalf("idempotent retry applied evidence again: %d", repo.answerCalls)
	}
}
