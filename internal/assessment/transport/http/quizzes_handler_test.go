package assessmenthttp

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	assessmentapp "github.com/nasef6464/almeaago/internal/assessment/application"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type mockCompletionRepo struct {
	pathID           string
	subjectID        string
	completedQuizIDs []string
	training         assessment.CompletionBucket
	tests            assessment.CompletionBucket
	mock             assessment.CompletionBucket
	foundation       map[string]assessment.TopicCompletionDetail
	foundationLocked []string
}

func (m *mockCompletionRepo) ResolvePathID(ctx context.Context, input string) (string, error) {
	if input == "p_qudrat" || input == "path-123" {
		return "path-123", nil
	}
	return "", assessment.ErrNotFound
}

func (m *mockCompletionRepo) ResolveSubjectID(ctx context.Context, pathID, input string) (string, error) {
	if input == "sub_quant" || input == "sub-456" {
		return "sub-456", nil
	}
	return "", nil
}

func (m *mockCompletionRepo) GetStudentCompletedQuizIDs(ctx context.Context, studentID string) ([]string, error) {
	return m.completedQuizIDs, nil
}

func (m *mockCompletionRepo) GetTrainingAndTestsCompletion(ctx context.Context, pathID, subjectID string, completedQuizIDs []string) (assessment.CompletionBucket, assessment.CompletionBucket, error) {
	return m.training, m.tests, nil
}

func (m *mockCompletionRepo) GetMockExamsCompletion(ctx context.Context, pathID string, completedQuizIDs []string) (assessment.CompletionBucket, error) {
	return m.mock, nil
}

func (m *mockCompletionRepo) GetFoundationCompletion(ctx context.Context, studentID, pathID, subjectID string, completedQuizIDs []string) (map[string]assessment.TopicCompletionDetail, []string, error) {
	return m.foundation, m.foundationLocked, nil
}

type staticAuth struct {
	user identity.User
	err  error
}

func (a staticAuth) Authenticate(ctx context.Context, rawToken string) (identityapp.Authenticated, error) {
	if a.err != nil {
		return identityapp.Authenticated{}, a.err
	}
	return identityapp.Authenticated{User: a.user}, nil
}

func (a staticAuth) VerifyCSRF(auth identityapp.Authenticated, rawToken string) error {
	return nil
}

func TestLearningCompletionEndpoint(t *testing.T) {
	repo := &mockCompletionRepo{
		completedQuizIDs: []string{"quiz-uuid-1"},
		training:         assessment.CompletionBucket{Total: 10, Completed: 7, Percentage: 70},
		tests:            assessment.CompletionBucket{Total: 5, Completed: 2, Percentage: 40},
		mock:             assessment.CompletionBucket{Total: 2, Completed: 1, Percentage: 50},
		foundation:       map[string]assessment.TopicCompletionDetail{},
		foundationLocked: []string{},
	}
	service := assessmentapp.NewCompletionService(repo)

	student := identity.User{
		ID:    "student-uuid-1",
		Roles: []identity.Role{identity.RoleStudent},
	}
	auth := staticAuth{user: student}

	handler := NewQuizzes(service, auth)

	t.Run("missing pathId returns 400", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/learning-completion", nil)
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("valid pathId returns 200 with completion contract", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/learning-completion?pathId=p_qudrat&subjectId=sub_quant", nil)
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
		}

		var resp assessment.LearningCompletionResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to decode json: %v", err)
		}

		if resp.Training.Total != 10 || resp.Training.Completed != 7 || resp.Training.Percentage != 70 {
			t.Errorf("unexpected training bucket: %+v", resp.Training)
		}
		if resp.Tests.Total != 5 || resp.Tests.Completed != 2 || resp.Tests.Percentage != 40 {
			t.Errorf("unexpected tests bucket: %+v", resp.Tests)
		}
		if resp.Mock.Total != 2 || resp.Mock.Completed != 1 || resp.Mock.Percentage != 50 {
			t.Errorf("unexpected mock bucket: %+v", resp.Mock)
		}
		if len(resp.CompletedQuizIDs) != 1 || resp.CompletedQuizIDs[0] != "quiz-uuid-1" {
			t.Errorf("unexpected completed quiz IDs: %+v", resp.CompletedQuizIDs)
		}
	})
}

type mockAttemptRepo struct {
	detail assessment.ResultDetail
	err    error
}

func (m *mockAttemptRepo) GetSingleShotAccessContext(context.Context, string) (assessment.AccessContext, bool, error) {
	return assessment.AccessContext{AssessmentKind: assessment.KindNormal, BaseAccess: assessment.AccessFree}, false, nil
}
func (m *mockAttemptRepo) FindSingleShotResult(context.Context, string, string, string) (assessment.ResultDetail, bool, error) {
	return assessment.ResultDetail{}, false, nil
}

func (m *mockAttemptRepo) GetPublishedAccessContext(context.Context, string) (assessment.AccessContext, error) {
	return assessment.AccessContext{}, nil
}
func (m *mockAttemptRepo) DirectPlacementAccessContexts(context.Context, string) (bool, []assessment.AccessContext, error) {
	return false, nil, nil
}
func (m *mockAttemptRepo) FindDirectStart(context.Context, string, string, string) (assessment.Attempt, bool, error) {
	return assessment.Attempt{}, false, nil
}
func (m *mockAttemptRepo) Start(context.Context, string, string, string) (assessment.Attempt, error) {
	return assessment.Attempt{}, nil
}
func (m *mockAttemptRepo) GetAttempt(context.Context, string) (assessment.Attempt, error) {
	return assessment.Attempt{}, nil
}
func (m *mockAttemptRepo) SaveAnswer(context.Context, string, string, string, assessment.AnswerWrite) (assessment.Attempt, error) {
	return assessment.Attempt{}, nil
}
func (m *mockAttemptRepo) Submit(context.Context, string, string, string) (assessment.Result, error) {
	return assessment.Result{}, nil
}
func (m *mockAttemptRepo) GetResult(context.Context, string) (assessment.Result, error) {
	return assessment.Result{}, nil
}
func (m *mockAttemptRepo) ListResults(context.Context, string, int, int) (assessment.ResultPage, error) {
	return assessment.ResultPage{}, nil
}
func (m *mockAttemptRepo) GetResultDetail(context.Context, string, string) (assessment.ResultDetail, error) {
	return m.detail, m.err
}
func (m *mockAttemptRepo) SingleShotSubmit(context.Context, string, string, assessment.SingleShotSubmissionRequest) (assessment.ResultDetail, error) {
	return m.detail, m.err
}

func TestQuizzesSingleShotSubmit(t *testing.T) {
	now := time.Now().UTC()
	attemptRepo := &mockAttemptRepo{
		detail: assessment.ResultDetail{
			AssessmentID: "quiz-uuid-1",
			Title:        "اختبار تجريبي",
			Result: assessment.Result{
				AttemptID:        "attempt-uuid-1",
				Score:            90.0,
				TotalQuestions:   10,
				CorrectAnswers:   9,
				WrongAnswers:     1,
				Unanswered:       0,
				Passed:           true,
				TimeSpentSeconds: 180,
				FinalizedAt:      now,
			},
		},
	}
	attemptService := assessmentapp.NewAttemptService(attemptRepo)
	student := identity.User{
		ID:    "student-uuid-1",
		Roles: []identity.Role{identity.RoleStudent},
	}
	auth := staticAuth{user: student}
	handler := NewQuizzes(nil, auth, attemptService)

	body := assessment.SingleShotSubmissionRequest{
		Answers:          map[string]int{"q-1": 1},
		TimeSpentSeconds: 180,
		SubmissionKey:    "sub-key-1",
	}
	raw, _ := json.Marshal(body)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/quiz-uuid-1/submit", bytes.NewReader(raw))
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", rec.Code, rec.Body.String())
	}

	var res assessment.SingleShotQuizResultDTO
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode json: %v", err)
	}

	if res.QuizID != "quiz-uuid-1" || res.Score != 90.0 || !res.Passed {
		t.Errorf("unexpected result: %+v", res)
	}
	if res.TimeSpent != "3 دقيقة" {
		t.Errorf("expected '3 دقيقة', got %q", res.TimeSpent)
	}
}

func TestQuizzesSingleShotRejectsInvalidCSRF(t *testing.T) {
	student := identity.User{ID: "student-1", Roles: []identity.Role{identity.RoleStudent}}
	repo := &mockAttemptRepo{}
	h := NewQuizzes(nil, rejectedVisibilityCSRF{staticAuth{user: student}}, assessmentapp.NewAttemptService(repo))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/quiz-1/submit", strings.NewReader(`{"answers":{},"submissionKey":"csrf-test"}`)))
	if w.Code != http.StatusForbidden {
		t.Fatalf("invalid CSRF submission: status=%d body=%s", w.Code, w.Body.String())
	}
}

func TestAssessmentsSingleShotRejectsInvalidCSRF(t *testing.T) {
	student := identity.User{ID: "student-1", Roles: []identity.Role{identity.RoleStudent}}
	h := New(nil, rejectedVisibilityCSRF{staticAuth{user: student}}, assessmentapp.NewAttemptService(&mockAttemptRepo{}))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/quiz-1/submit", strings.NewReader(`{"answers":{},"submissionKey":"csrf-test"}`)))
	if w.Code != http.StatusForbidden {
		t.Fatalf("invalid CSRF submission: status=%d body=%s", w.Code, w.Body.String())
	}
}
