package assessmenthttp

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	assessmentapp "github.com/nasef6464/almeaago/internal/assessment/application"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

// mockRealDBBehaviorCompletionRepo simulates the exact PostgreSQL table state
// as seeded in cmd/seed/main.go where paths.code = 'qudrat' and 'tahsili' (not 'p_qudrat'/'p_tahsili').
type mockRealDBBehaviorCompletionRepo struct {
	paths map[string]string // code -> id
}

func newRealDBSimulatedCompletionRepo() *mockRealDBBehaviorCompletionRepo {
	return &mockRealDBBehaviorCompletionRepo{
		paths: map[string]string{
			"qudrat":  "018f0000-0000-7000-a000-000000000001",
			"tahsili": "018f0000-0000-7000-a000-000000000002",
		},
	}
}

func (m *mockRealDBBehaviorCompletionRepo) ResolvePathID(_ context.Context, input string) (string, error) {
	// Exactly reflects completion_repository.go: WHERE (id::text = $1 OR lower(code) = lower($1) OR lower(code) = $2)
	clean := strings.TrimSpace(input)
	normalized := strings.TrimPrefix(strings.TrimPrefix(strings.ToLower(clean), "p_"), "p-")
	for code, id := range m.paths {
		if clean == id || strings.EqualFold(clean, code) || strings.EqualFold(normalized, code) {
			return id, nil
		}
	}
	return "", assessment.ErrNotFound
}

func (m *mockRealDBBehaviorCompletionRepo) ResolveSubjectID(_ context.Context, pathID, input string) (string, error) {
	if input == "" {
		return "", nil
	}
	return input, nil
}

func (m *mockRealDBBehaviorCompletionRepo) GetStudentCompletedQuizIDs(_ context.Context, _ string) ([]string, error) {
	return []string{}, nil
}

func (m *mockRealDBBehaviorCompletionRepo) GetTrainingAndTestsCompletion(_ context.Context, _, _ string, _ []string) (assessment.CompletionBucket, assessment.CompletionBucket, error) {
	return assessment.CompletionBucket{Total: 5, Completed: 0}, assessment.CompletionBucket{Total: 3, Completed: 0}, nil
}

func (m *mockRealDBBehaviorCompletionRepo) GetMockExamsCompletion(_ context.Context, _ string, _ []string) (assessment.CompletionBucket, error) {
	return assessment.CompletionBucket{Total: 1, Completed: 0}, nil
}

func (m *mockRealDBBehaviorCompletionRepo) GetFoundationCompletion(_ context.Context, _, _, _ string, _ []string) (map[string]assessment.TopicCompletionDetail, []string, error) {
	return map[string]assessment.TopicCompletionDetail{}, []string{}, nil
}

// TestChallenge_LearningCompletion_LegacyTaxonomyCodes verifies whether queries with
// legacy taxonomy codes "p_qudrat" and "p_tahsili" succeed or fail when the database
// stores codes as "qudrat" and "tahsili" (as seeded in seed data).
func TestChallenge_LearningCompletion_LegacyTaxonomyCodes(t *testing.T) {
	repo := newRealDBSimulatedCompletionRepo()
	service := assessmentapp.NewCompletionService(repo)
	student := identity.User{ID: "student-1", Roles: []identity.Role{identity.RoleStudent}}
	auth := staticAuth{user: student}
	handler := NewQuizzes(service, auth)

	for _, legacyCode := range []string{"p_qudrat", "p_tahsili"} {
		t.Run("querying with "+legacyCode, func(t *testing.T) {
			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/learning-completion?pathId="+legacyCode, nil)
			handler.ServeHTTP(rec, req)

			t.Logf("Legacy Code %s -> Status: %d, Body: %s", legacyCode, rec.Code, rec.Body.String())

			if rec.Code != http.StatusOK {
				t.Fatalf("BUG CONFIRMED: Query with legacy taxonomy code %q failed with status %d (body: %s). Expected HTTP 200.", legacyCode, rec.Code, rec.Body.String())
			}
		})
	}
}

// mockAdversarialAttemptRepo models the idempotency behavior of single_shot.go.
type mockAdversarialAttemptRepo struct {
	mu           sync.Mutex
	submissions  map[string]assessment.ResultDetail // submissionKey -> detail
	attemptCount int64
}

func (m *mockAdversarialAttemptRepo) GetPublishedAccessContext(context.Context, string) (assessment.AccessContext, error) {
	return assessment.AccessContext{AssessmentKind: assessment.KindNormal, BaseAccess: assessment.AccessFree, PathID: "path-1", SubjectID: "subject-1"}, nil
}
func (m *mockAdversarialAttemptRepo) FindDirectStart(context.Context, string, string, string) (assessment.Attempt, bool, error) {
	return assessment.Attempt{}, false, nil
}
func (m *mockAdversarialAttemptRepo) GetAttempt(context.Context, string) (assessment.Attempt, error) {
	return assessment.Attempt{}, nil
}
func (m *mockAdversarialAttemptRepo) GetResult(context.Context, string) (assessment.Result, error) {
	return assessment.Result{}, nil
}
func (m *mockAdversarialAttemptRepo) GetResultDetail(_ context.Context, _, attemptID string) (assessment.ResultDetail, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, det := range m.submissions {
		if det.Result.AttemptID == attemptID {
			return det, nil
		}
	}
	return assessment.ResultDetail{}, assessment.ErrNotFound
}
func (m *mockAdversarialAttemptRepo) ListResults(context.Context, string, int, int) (assessment.ResultPage, error) {
	return assessment.ResultPage{}, nil
}
func (m *mockAdversarialAttemptRepo) SaveAnswer(context.Context, string, string, string, assessment.AnswerWrite) (assessment.Attempt, error) {
	return assessment.Attempt{}, nil
}
func (m *mockAdversarialAttemptRepo) Start(context.Context, string, string, string) (assessment.Attempt, error) {
	return assessment.Attempt{}, nil
}
func (m *mockAdversarialAttemptRepo) Submit(context.Context, string, string, string) (assessment.Result, error) {
	return assessment.Result{}, nil
}

func (m *mockAdversarialAttemptRepo) SingleShotSubmit(
	_ context.Context,
	studentID, assessmentID string,
	req assessment.SingleShotSubmissionRequest,
) (assessment.ResultDetail, error) {
	// Replicating single_shot.go Step 1: Idempotency Check BEFORE transaction
	if req.SubmissionKey != "" {
		m.mu.Lock()
		existing, found := m.submissions[req.SubmissionKey]
		m.mu.Unlock()
		if found {
			return existing, nil
		}
	}

	// Simulating concurrency race window between check and write
	time.Sleep(10 * time.Millisecond)

	m.mu.Lock()
	defer m.mu.Unlock()

	// In fixed single_shot.go, transaction advisory serialization and duplicate key fallback
	// return existing result on duplicate submissionKey rather than failing with ErrConflict
	if existing, exists := m.submissions[req.SubmissionKey]; exists {
		return existing, nil
	}

	attID := atomic.AddInt64(&m.attemptCount, 1)
	res := assessment.ResultDetail{
		AssessmentID: assessmentID,
		Title:        "اختبار تجريبي",
		Result: assessment.Result{
			AttemptID:        "att-" + string(rune('0'+attID)),
			Score:            80.0,
			TotalQuestions:   10,
			CorrectAnswers:   8,
			WrongAnswers:     2,
			Unanswered:       0,
			Passed:           true,
			TimeSpentSeconds: req.TimeSpentSeconds,
			FinalizedAt:      time.Now().UTC(),
		},
	}
	if req.SubmissionKey != "" {
		m.submissions[req.SubmissionKey] = res
	}
	return res, nil
}

// TestChallenge_SingleShotSubmit_DuplicateKeyIdempotency tests sequential duplicate submission.
func TestChallenge_SingleShotSubmit_DuplicateKeyIdempotency(t *testing.T) {
	repo := &mockAdversarialAttemptRepo{submissions: make(map[string]assessment.ResultDetail)}
	service := assessmentapp.NewAttemptService(repo)
	student := identity.User{ID: "student-1", Roles: []identity.Role{identity.RoleStudent}}
	auth := staticAuth{user: student}
	handler := NewQuizzes(nil, auth, service)

	payload := assessment.SingleShotSubmissionRequest{
		Answers:          map[string]int{"q-1": 1, "q-2": 0},
		TimeSpentSeconds: 120,
		SubmissionKey:    "sub-key-identical-123",
	}
	raw, _ := json.Marshal(payload)

	// Call 1
	rec1 := httptest.NewRecorder()
	req1 := httptest.NewRequest(http.MethodPost, "/quiz-1/submit", bytes.NewReader(raw))
	handler.ServeHTTP(rec1, req1)

	if rec1.Code != http.StatusCreated {
		t.Fatalf("Call 1 failed with status %d: %s", rec1.Code, rec1.Body.String())
	}

	var res1 assessment.SingleShotQuizResultDTO
	_ = json.Unmarshal(rec1.Body.Bytes(), &res1)

	// Call 2 with exact same submissionKey
	rec2 := httptest.NewRecorder()
	req2 := httptest.NewRequest(http.MethodPost, "/quiz-1/submit", bytes.NewReader(raw))
	handler.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusCreated {
		t.Fatalf("Call 2 failed with status %d: %s (idempotency broken)", rec2.Code, rec2.Body.String())
	}

	var res2 assessment.SingleShotQuizResultDTO
	_ = json.Unmarshal(rec2.Body.Bytes(), &res2)

	if res1.AttemptID != res2.AttemptID {
		t.Fatalf("Idempotency violation: Call 1 AttemptID=%s, Call 2 AttemptID=%s", res1.AttemptID, res2.AttemptID)
	}
}

// TestChallenge_SingleShotSubmit_UnansweredQuestions verifies handling of -1.
func TestChallenge_SingleShotSubmit_UnansweredQuestions(t *testing.T) {
	repo := &mockAdversarialAttemptRepo{submissions: make(map[string]assessment.ResultDetail)}
	service := assessmentapp.NewAttemptService(repo)
	student := identity.User{ID: "student-1", Roles: []identity.Role{identity.RoleStudent}}
	auth := staticAuth{user: student}
	handler := NewQuizzes(nil, auth, service)

	payload := assessment.SingleShotSubmissionRequest{
		Answers:          map[string]int{"q-1": -1, "q-2": -1, "q-3": 2},
		TimeSpentSeconds: 90,
		SubmissionKey:    "sub-unanswered-123",
	}
	raw, _ := json.Marshal(payload)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/quiz-1/submit", bytes.NewReader(raw))
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("Failed to process submission with -1 answers: status %d, body: %s", rec.Code, rec.Body.String())
	}
}

// TestChallenge_SingleShotSubmit_ConcurrentDuplicateKeyIdempotency tests that when multiple
// concurrent requests arrive simultaneously with the same submissionKey (e.g. user double-clicks
// or network retry), all concurrent callers receive HTTP 201 Created and the same result.
func TestChallenge_SingleShotSubmit_ConcurrentDuplicateKeyIdempotency(t *testing.T) {
	repo := &mockAdversarialAttemptRepo{submissions: make(map[string]assessment.ResultDetail)}
	service := assessmentapp.NewAttemptService(repo)
	student := identity.User{ID: "student-1", Roles: []identity.Role{identity.RoleStudent}}
	auth := staticAuth{user: student}
	handler := NewQuizzes(nil, auth, service)

	payload := assessment.SingleShotSubmissionRequest{
		Answers:          map[string]int{"q-1": 1, "q-2": 0},
		TimeSpentSeconds: 120,
		SubmissionKey:    "concurrent-sub-key-999",
	}
	raw, _ := json.Marshal(payload)

	const concurrency = 5
	var wg sync.WaitGroup
	statusCodes := make([]int, concurrency)
	attemptIDs := make([]string, concurrency)

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, "/quiz-1/submit", bytes.NewReader(raw))
			handler.ServeHTTP(rec, req)

			statusCodes[idx] = rec.Code
			if rec.Code == http.StatusCreated {
				var res assessment.SingleShotQuizResultDTO
				if err := json.Unmarshal(rec.Body.Bytes(), &res); err == nil {
					attemptIDs[idx] = res.AttemptID
				}
			}
		}(i)
	}

	wg.Wait()

	t.Logf("Concurrent Status Codes: %v", statusCodes)

	for i, code := range statusCodes {
		if code != http.StatusCreated {
			t.Fatalf("BUG CONFIRMED: Concurrent submission %d failed with status %d (idempotency race condition). Expected all to succeed with 201.", i, code)
		}
	}

	for i := 1; i < concurrency; i++ {
		if attemptIDs[i] != attemptIDs[0] {
			t.Fatalf("BUG CONFIRMED: Inconsistent attempt IDs returned across concurrent submissions: %v", attemptIDs)
		}
	}
}

