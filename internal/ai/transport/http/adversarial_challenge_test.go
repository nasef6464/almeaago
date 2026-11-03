package aihttp

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	aiapp "github.com/nasef6464/almeaago/internal/ai/application"
	ai "github.com/nasef6464/almeaago/internal/ai/domain"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

type mockAdvLearningReader struct {
	mu    sync.Mutex
	cards map[string]map[string]learning.ReviewCard // studentID -> cardID -> ReviewCard
	err   error
}

func (m *mockAdvLearningReader) GetReviewCard(_ context.Context, studentID, cardID string) (learning.ReviewCard, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.err != nil {
		return learning.ReviewCard{}, m.err
	}
	studentCards, ok := m.cards[studentID]
	if !ok {
		return learning.ReviewCard{}, learning.ErrNotFound
	}
	card, ok := studentCards[cardID]
	if !ok {
		return learning.ReviewCard{}, learning.ErrNotFound
	}
	return card, nil
}

type mockAdvQuestionReader struct {
	questions map[string]question.ReviewProjection
}

func (m *mockAdvQuestionReader) ReviewBatch(_ context.Context, refs []question.ReviewRef) ([]question.ReviewProjection, error) {
	res := make([]question.ReviewProjection, 0, len(refs))
	for _, ref := range refs {
		if q, ok := m.questions[ref.QuestionID]; ok {
			res = append(res, q)
		}
	}
	return res, nil
}

type mockAdvProviderClient struct {
	mu         sync.Mutex
	configured bool
	calls      int
	shouldFail bool
	failErr    error
}

func (m *mockAdvProviderClient) SecretConfigured(ai.Provider) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.configured
}

func (m *mockAdvProviderClient) Call(_ context.Context, _ ai.ProviderSetting, _ string) (ai.ProviderCallResult, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.calls++
	if m.shouldFail {
		if m.failErr != nil {
			return ai.ProviderCallResult{}, m.failErr
		}
		return ai.ProviderCallResult{}, errors.New("upstream provider timeout (504)")
	}
	return ai.ProviderCallResult{
		Text:  "إجابة المعلم الذكي الخارجية",
		Model: "gpt-4o-mini",
		Usage: ai.ProviderUsage{TotalTokens: 25},
	}, nil
}

type advAuthStub struct {
	users map[string]identity.User
}

func (a advAuthStub) Authenticate(_ context.Context, token string) (identityapp.Authenticated, error) {
	if token == "" {
		return identityapp.Authenticated{}, errors.New("missing auth token")
	}
	u, ok := a.users[token]
	if !ok {
		return identityapp.Authenticated{}, errors.New("invalid token")
	}
	return identityapp.Authenticated{User: u}, nil
}

func (a advAuthStub) VerifyCSRF(_ identityapp.Authenticated, _ string) error {
	return nil
}

// -----------------------------------------------------------------------------
// CHALLENGE FOCUS 1: Legacy Codax Payloads
// -----------------------------------------------------------------------------

func TestAdversarial_QuestionAssistant_LegacyCodaxPayloads(t *testing.T) {
	cfg := aiapp.Config{
		PerMinuteLimit: 20,
		CacheTTL:       10 * time.Minute,
	}

	studentID := "student-alice"
	studentUser := identity.User{
		ID:    studentID,
		Roles: []identity.Role{identity.RoleStudent},
	}
	auth := advAuthStub{
		users: map[string]identity.User{
			"tok-alice": studentUser,
		},
	}

	learningReader := &mockAdvLearningReader{
		cards: map[string]map[string]learning.ReviewCard{
			studentID: {
				"card-100": {
					ID:              "card-100",
					QuestionID:      "q-math-1",
					QuestionVersion: 1,
					SubjectID:       "sub_quant",
					PathID:          "p_qudrat",
				},
			},
		},
	}

	questionReader := &mockAdvQuestionReader{
		questions: map[string]question.ReviewProjection{
			"q-math-1": {
				ID:              "q-math-1",
				Version:         1,
				TextContent:     "إذا كان س + ص = 10 وكان س - ص = 4، فما قيمة س؟",
				SolvingStrategy: "اجمع المعادلتين للتخلص من المتغير ص، فينتج 2س = 14.",
				Explanation:     "بقسمة الطرفين على 2، نجد أن س = 7.",
				Hint:            "استخدم طريقة الحذف والتعويض.",
			},
		},
	}

	providers := &mockAdvProviderClient{configured: false} // Offline environment
	service := aiapp.NewService(dummyAIRepo{}, learningReader, questionReader, providers, cfg)
	handler := New(service, auth)

	t.Run("full legacy Codax payload with boardMode storyboard_v1 returns dual envelope with storyboard", func(t *testing.T) {
		selected := 2
		correct := 1
		payload := map[string]any{
			"questionId":         "q-math-1",
			"reviewCardId":       "card-100",
			"attemptId":          "att-legacy-777",
			"resultId":           "res-legacy-888",
			"context":            "post_exam_review",
			"helpLevel":          "steps",
			"message":            "أريد توضيح الخطوات بالتفصيل يا معلم",
			"boardMode":          "storyboard_v1",
			"boardContext":       "dark_canvas",
			"imageVersion":       "v1.4",
			"tutorSessionId":     "sess-legacy-999",
			"userSelectedAnswer": selected,
			"correctAnswer":      correct,
			"questionText":       "إذا كان س + ص = 10 وكان س - ص = 4، فما قيمة س؟",
		}
		raw, _ := json.Marshal(payload)

		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/question-assistant", bytes.NewReader(raw))
		req.Header.Set("Authorization", "Bearer tok-alice")
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected HTTP 200, got %d: %s", rec.Code, rec.Body.String())
		}

		var resp map[string]any
		if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		// 1. Verify top-level Codax compatibility fields
		if resp["text"] == nil || resp["text"] == "" {
			t.Errorf("missing top-level 'text'")
		}
		if resp["helpLevel"] != "steps" {
			t.Errorf("expected helpLevel 'steps', got %v", resp["helpLevel"])
		}
		if resp["usedFallback"] != true {
			t.Errorf("expected usedFallback true in offline mode")
		}
		if resp["hasImage"] != false || resp["imageSentToProvider"] != false {
			t.Errorf("unexpected image flags: %v, %v", resp["hasImage"], resp["imageSentToProvider"])
		}

		// 2. Verify storyboard construction
		sbRaw, ok := resp["storyboard"].(map[string]any)
		if !ok || sbRaw == nil {
			t.Fatalf("expected storyboard object in response")
		}
		if sbRaw["language"] != "ar-SA" {
			t.Errorf("expected storyboard language 'ar-SA', got %v", sbRaw["language"])
		}
		scenes, ok := sbRaw["scenes"].([]any)
		if !ok || len(scenes) < 3 {
			t.Fatalf("expected at least 3 storyboard scenes, got %d", len(scenes))
		}
		for i, sc := range scenes {
			sceneMap := sc.(map[string]any)
			if sceneMap["narration"] == "" || sceneMap["narration"] == nil {
				t.Errorf("scene %d missing narration", i)
			}
			actions, ok := sceneMap["actions"].([]any)
			if !ok || len(actions) == 0 {
				t.Errorf("scene %d has no actions", i)
			}
		}

		// 3. Verify nested result envelope parity
		nested, ok := resp["result"].(map[string]any)
		if !ok || nested == nil {
			t.Fatalf("missing nested result map")
		}
		if nested["text"] != resp["text"] {
			t.Errorf("mismatched nested text vs top-level text")
		}
		if nested["storyboard"] == nil {
			t.Errorf("expected storyboard inside nested result as well")
		}
	})

	t.Run("legacy payload with boardMode storyboard_v2 also returns storyboard", func(t *testing.T) {
		payload := map[string]any{
			"questionId": "q-math-1",
			"boardMode":  "storyboard_v2",
			"helpLevel":  "hint",
		}
		raw, _ := json.Marshal(payload)
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/question-assistant", bytes.NewReader(raw))
		req.Header.Set("Authorization", "Bearer tok-alice")
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
		var resp map[string]any
		_ = json.Unmarshal(rec.Body.Bytes(), &resp)
		if resp["storyboard"] == nil {
			t.Errorf("expected storyboard for storyboard_v2")
		}
	})

	t.Run("unknown boardMode does not return storyboard and does not crash", func(t *testing.T) {
		payload := map[string]any{
			"questionId": "q-math-1",
			"boardMode":  "unknown_legacy_mode_999",
			"helpLevel":  "hint",
		}
		raw, _ := json.Marshal(payload)
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/question-assistant", bytes.NewReader(raw))
		req.Header.Set("Authorization", "Bearer tok-alice")
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
		var resp map[string]any
		_ = json.Unmarshal(rec.Body.Bytes(), &resp)
		if resp["storyboard"] != nil {
			t.Errorf("expected null storyboard for unrecognized boardMode")
		}
	})

	t.Run("invalid helpLevel defaults gracefully to hint without 500 error", func(t *testing.T) {
		payload := map[string]any{
			"questionId": "q-math-1",
			"helpLevel":  "invalid_super_hint_level",
		}
		raw, _ := json.Marshal(payload)
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/question-assistant", bytes.NewReader(raw))
		req.Header.Set("Authorization", "Bearer tok-alice")
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
		var resp map[string]any
		_ = json.Unmarshal(rec.Body.Bytes(), &resp)
		if resp["helpLevel"] != "hint" {
			t.Errorf("expected default helpLevel 'hint', got %v", resp["helpLevel"])
		}
	})

	t.Run("questionText only without reviewCardId or questionId", func(t *testing.T) {
		payload := map[string]any{
			"questionText": "ما مساحة دائرة طول نصف قطرها 7 سم؟",
			"helpLevel":    "steps",
		}
		raw, _ := json.Marshal(payload)
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/question-assistant", bytes.NewReader(raw))
		req.Header.Set("Authorization", "Bearer tok-alice")
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
		}
		var resp map[string]any
		_ = json.Unmarshal(rec.Body.Bytes(), &resp)
		if resp["text"] == "" || resp["text"] == nil {
			t.Errorf("expected non-empty assistance text")
		}
	})

	t.Run("extremely oversized message (10000 runes) is truncated safely without panic", func(t *testing.T) {
		longMsg := strings.Repeat("أحتاج شرح هذا السؤال بدقة ", 500)
		payload := map[string]any{
			"questionId": "q-math-1",
			"message":    longMsg,
		}
		raw, _ := json.Marshal(payload)
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/question-assistant", bytes.NewReader(raw))
		req.Header.Set("Authorization", "Bearer tok-alice")
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("empty payload with no identifiers returns 400 Bad Request", func(t *testing.T) {
		payload := map[string]any{}
		raw, _ := json.Marshal(payload)
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/question-assistant", bytes.NewReader(raw))
		req.Header.Set("Authorization", "Bearer tok-alice")
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 Bad Request, got %d: %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("malformed json returns 400 Bad Request", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/question-assistant", strings.NewReader("{not a valid json"))
		req.Header.Set("Authorization", "Bearer tok-alice")
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 Bad Request, got %d: %s", rec.Code, rec.Body.String())
		}
	})
}

// -----------------------------------------------------------------------------
// CHALLENGE FOCUS 2: Foreign/Invalid reviewCardId Lookup Security & 404
// -----------------------------------------------------------------------------

func TestAdversarial_QuestionAssistant_ForeignAndInvalidReviewCard(t *testing.T) {
	cfg := aiapp.Config{
		PerMinuteLimit: 20,
		CacheTTL:       10 * time.Minute,
	}

	aliceUser := identity.User{ID: "student-alice", Roles: []identity.Role{identity.RoleStudent}}
	bobUser := identity.User{ID: "student-bob", Roles: []identity.Role{identity.RoleStudent}}
	teacherUser := identity.User{ID: "teacher-charlie", Roles: []identity.Role{identity.RoleTeacher}}

	auth := advAuthStub{
		users: map[string]identity.User{
			"tok-alice":   aliceUser,
			"tok-bob":     bobUser,
			"tok-teacher": teacherUser,
		},
	}

	learningReader := &mockAdvLearningReader{
		cards: map[string]map[string]learning.ReviewCard{
			"student-bob": {
				"bob-card-private-99": {
					ID:              "bob-card-private-99",
					QuestionID:      "q-bob-secret",
					QuestionVersion: 1,
				},
			},
		},
	}

	providers := &mockAdvProviderClient{configured: true}
	service := aiapp.NewService(dummyAIRepo{}, learningReader, nil, providers, cfg)
	handler := New(service, auth)

	t.Run("student Alice requesting Bob's reviewCardId returns 404 without leaking info", func(t *testing.T) {
		payload := map[string]any{
			"reviewCardId": "bob-card-private-99",
			"helpLevel":    "hint",
		}
		raw, _ := json.Marshal(payload)

		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/question-assistant", bytes.NewReader(raw))
		req.Header.Set("Authorization", "Bearer tok-alice")
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusNotFound {
			t.Fatalf("expected HTTP 404 Not Found, got %d: %s", rec.Code, rec.Body.String())
		}

		var errResp map[string]string
		if err := json.Unmarshal(rec.Body.Bytes(), &errResp); err != nil {
			t.Fatalf("failed to decode error body: %v", err)
		}
		if errResp["message"] != "AI context not found" {
			t.Errorf("expected clean message 'AI context not found', got %q", errResp["message"])
		}

		// Verify external provider was NOT called
		if providers.calls != 0 {
			t.Errorf("provider must NOT be called for foreign card, calls=%d", providers.calls)
		}
	})

	t.Run("non-existent reviewCardId returns 404", func(t *testing.T) {
		payload := map[string]any{
			"reviewCardId": "non-existent-card-00000000",
			"helpLevel":    "hint",
		}
		raw, _ := json.Marshal(payload)

		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/question-assistant", bytes.NewReader(raw))
		req.Header.Set("Authorization", "Bearer tok-alice")
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusNotFound {
			t.Fatalf("expected HTTP 404 Not Found, got %d: %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("SQL injection string in reviewCardId returns 404 safely", func(t *testing.T) {
		payload := map[string]any{
			"reviewCardId": "' OR 1=1; DROP TABLE review_cards; --",
			"helpLevel":    "hint",
		}
		raw, _ := json.Marshal(payload)

		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/question-assistant", bytes.NewReader(raw))
		req.Header.Set("Authorization", "Bearer tok-alice")
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusNotFound {
			t.Fatalf("expected HTTP 404 Not Found, got %d: %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("unauthenticated request returns 401 Unauthorized", func(t *testing.T) {
		payload := map[string]any{
			"questionId": "q-123",
		}
		raw, _ := json.Marshal(payload)

		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/question-assistant", bytes.NewReader(raw))
		// No auth token
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("expected HTTP 401 Unauthorized, got %d: %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("non-student role returns 403 Forbidden", func(t *testing.T) {
		payload := map[string]any{
			"questionId": "q-123",
		}
		raw, _ := json.Marshal(payload)

		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/question-assistant", bytes.NewReader(raw))
		req.Header.Set("Authorization", "Bearer tok-teacher")
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusForbidden {
			t.Fatalf("expected HTTP 403 Forbidden, got %d: %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("internal database error maps to 500 without leaking stack trace or SQL details", func(t *testing.T) {
		failingLearning := &mockAdvLearningReader{
			err: errors.New("pq: connection closed unexpectedly by remote host Neon [FATAL: password authentication failed for user 'neondb']"),
		}
		brokenService := aiapp.NewService(dummyAIRepo{}, failingLearning, nil, providers, cfg)
		brokenHandler := New(brokenService, auth)

		payload := map[string]any{
			"reviewCardId": "card-will-fail-db",
			"helpLevel":    "hint",
		}
		raw, _ := json.Marshal(payload)

		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/question-assistant", bytes.NewReader(raw))
		req.Header.Set("Authorization", "Bearer tok-alice")
		brokenHandler.ServeHTTP(rec, req)

		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("expected HTTP 500 Internal Server Error, got %d: %s", rec.Code, rec.Body.String())
		}

		var errResp map[string]string
		_ = json.Unmarshal(rec.Body.Bytes(), &errResp)
		if strings.Contains(errResp["message"], "Neon") || strings.Contains(errResp["message"], "password") {
			t.Fatalf("security violation: internal db credentials or error details leaked to client: %s", errResp["message"])
		}
		if errResp["message"] != "Internal server error" {
			t.Errorf("expected generic 'Internal server error', got %q", errResp["message"])
		}
	})
}

// -----------------------------------------------------------------------------
// CHALLENGE FOCUS 3: Student Chat with Arabic Quantitative/Verbal Offline Mentoring
// -----------------------------------------------------------------------------

func TestAdversarial_StudentChat_OfflineMentoring(t *testing.T) {
	cfg := aiapp.Config{
		PerMinuteLimit: 20,
		CacheTTL:       10 * time.Minute,
	}

	aliceUser := identity.User{ID: "student-alice", Roles: []identity.Role{identity.RoleStudent}}
	auth := advAuthStub{
		users: map[string]identity.User{
			"tok-alice": aliceUser,
		},
	}

	// Offline provider (unconfigured)
	offlineService := aiapp.NewService(dummyAIRepo{}, nil, nil, nil, cfg)
	offlineHandler := New(offlineService, auth)

	// Quantitative Test Matrix
	quantPrompts := []string{
		"عندي صعوبة كبيرة في القسم الكمي في اختبار القدرات",
		"كيف أحل مسائل الرياضيات السريعة بدون آلة حاسبة؟",
		"اشرح لي فكرة الكسور والنسبة المئوية",
		"مسائل الهندسة وحساب مساحة المثلث والدائرة",
		"عندي مشكلة في المعادلات والأسس والجذور",
	}

	for i, prompt := range quantPrompts {
		t.Run(fmt.Sprintf("quantitative prompt %d", i+1), func(t *testing.T) {
			payload := map[string]any{
				"message": prompt,
			}
			raw, _ := json.Marshal(payload)

			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, "/chat", bytes.NewReader(raw))
			req.Header.Set("Authorization", "Bearer tok-alice")
			offlineHandler.ServeHTTP(rec, req)

			if rec.Code != http.StatusOK {
				t.Fatalf("expected HTTP 200, got %d: %s", rec.Code, rec.Body.String())
			}

			var resp ai.StudentChatResult
			if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
				t.Fatalf("failed to decode response: %v", err)
			}

			if !resp.UsedFallback {
				t.Errorf("expected usedFallback true in offline mode")
			}
			if resp.Provider != ai.ProviderNone {
				t.Errorf("expected provider 'none', got %v", resp.Provider)
			}
			if resp.Text == "" || resp.Reply == "" {
				t.Errorf("expected non-empty Arabic response text")
			}
			if !strings.Contains(resp.Text, "الكمي") && !strings.Contains(resp.Text, "رياضي") {
				t.Errorf("expected quantitative advice in response text: %s", resp.Text)
			}
			if len(resp.Suggestions) < 2 {
				t.Errorf("expected at least 2 suggestions, got %d", len(resp.Suggestions))
			}
			if len(resp.RecommendedLinks) == 0 || resp.RecommendedLinks[0].Href != "/category/p_qudrat" {
				t.Errorf("expected recommended link to /category/p_qudrat, got %+v", resp.RecommendedLinks)
			}
			if !resp.Personalized {
				t.Errorf("expected personalized true for authenticated student")
			}
		})
	}

	// Verbal Test Matrix
	verbalPrompts := []string{
		"كيف أتدرب على القسم اللفظي في القدرات؟",
		"عندي مشكلة في استيعاب المقروء وتلخيص القطع",
		"أريد استراتيجية حل التناظر اللفظي خطوة بخطوة",
		"كيف أكتشف الخطأ السياقي في الجمل الطويلة؟",
		"طريقة إكمال الجمل والمفردة الشاذة",
	}

	for i, prompt := range verbalPrompts {
		t.Run(fmt.Sprintf("verbal prompt %d", i+1), func(t *testing.T) {
			payload := map[string]any{
				"message": prompt,
			}
			raw, _ := json.Marshal(payload)

			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, "/chat", bytes.NewReader(raw))
			req.Header.Set("Authorization", "Bearer tok-alice")
			offlineHandler.ServeHTTP(rec, req)

			if rec.Code != http.StatusOK {
				t.Fatalf("expected HTTP 200, got %d: %s", rec.Code, rec.Body.String())
			}

			var resp ai.StudentChatResult
			if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
				t.Fatalf("failed to decode response: %v", err)
			}

			if !resp.UsedFallback {
				t.Errorf("expected usedFallback true in offline mode")
			}
			if resp.Text == "" || resp.Reply == "" {
				t.Errorf("expected non-empty Arabic response text")
			}
			if !strings.Contains(resp.Text, "اللفظي") && !strings.Contains(resp.Text, "التناظر") && !strings.Contains(resp.Text, "السياقي") {
				t.Errorf("expected verbal advice in response text: %s", resp.Text)
			}
		})
	}

	// Study Planning Matrix
	studyPrompts := []string{
		"أنا ضعيف في القدرات ومش عارف أذاكر إزاي؟",
		"اعمل لي خطة مذاكرة وجدول لتنظيم الوقت",
		"إزاي أراجع أخطائي بعد الاختبار التجريبي؟",
	}

	for i, prompt := range studyPrompts {
		t.Run(fmt.Sprintf("study prompt %d", i+1), func(t *testing.T) {
			payload := map[string]any{
				"message": prompt,
			}
			raw, _ := json.Marshal(payload)

			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, "/chat", bytes.NewReader(raw))
			req.Header.Set("Authorization", "Bearer tok-alice")
			offlineHandler.ServeHTTP(rec, req)

			if rec.Code != http.StatusOK {
				t.Fatalf("expected HTTP 200, got %d: %s", rec.Code, rec.Body.String())
			}

			var resp ai.StudentChatResult
			if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
				t.Fatalf("failed to decode response: %v", err)
			}

			if !strings.Contains(resp.Text, "خطة") && !strings.Contains(resp.Text, "بومودورو") && !strings.Contains(resp.Text, "مذاكرة") {
				t.Errorf("expected study advice in response text: %s", resp.Text)
			}
		})
	}

	t.Run("unauthenticated student guest gets valid guidance with personalized=false", func(t *testing.T) {
		payload := map[string]any{
			"message": "مرحبا، كيف استعد للقدرات؟",
		}
		raw, _ := json.Marshal(payload)

		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/chat", bytes.NewReader(raw))
		// No auth token
		offlineHandler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected HTTP 200, got %d: %s", rec.Code, rec.Body.String())
		}

		var resp ai.StudentChatResult
		_ = json.Unmarshal(rec.Body.Bytes(), &resp)
		if resp.Personalized != false {
			t.Errorf("expected personalized=false for unauthenticated guest, got true")
		}
		if resp.Text == "" {
			t.Errorf("expected non-empty guidance text")
		}
	})

	t.Run("empty message returns 400 Bad Request", func(t *testing.T) {
		payload := map[string]any{
			"message": "    ",
		}
		raw, _ := json.Marshal(payload)

		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/chat", bytes.NewReader(raw))
		offlineHandler.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected HTTP 400 Bad Request, got %d: %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("provider runtime failure fails open to offline Arabic tutor without 500 error", func(t *testing.T) {
		failingProvider := &mockAdvProviderClient{
			configured: true,
			shouldFail: true,
			failErr:    errors.New("HTTP 503 service unavailable from OpenAI"),
		}
		resilientService := aiapp.NewService(dummyAIRepo{}, nil, nil, failingProvider, cfg)
		resilientHandler := New(resilientService, auth)

		payload := map[string]any{
			"message": "اشرح لي مسائل الكسور في القسم الكمي",
		}
		raw, _ := json.Marshal(payload)

		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/chat", bytes.NewReader(raw))
		req.Header.Set("Authorization", "Bearer tok-alice")
		resilientHandler.ServeHTTP(rec, req)

		// Must NOT return 500 or 503
		if rec.Code != http.StatusOK {
			t.Fatalf("expected HTTP 200 fallback, got %d: %s", rec.Code, rec.Body.String())
		}

		var resp ai.StudentChatResult
		_ = json.Unmarshal(rec.Body.Bytes(), &resp)
		if !resp.UsedFallback {
			t.Errorf("expected usedFallback true on upstream failure")
		}
		if resp.Text == "" || !strings.Contains(resp.Text, "الكمي") {
			t.Errorf("expected valid fallback guidance: %s", resp.Text)
		}
	})
}

// -----------------------------------------------------------------------------
// CHALLENGE FOCUS 4: Concurrency and Race Condition Resistance
// -----------------------------------------------------------------------------

func TestAdversarial_ConcurrentChatAndAssistantStress(t *testing.T) {
	cfg := aiapp.Config{
		PerMinuteLimit: 100,
		CacheTTL:       10 * time.Minute,
	}

	studentUser := identity.User{ID: "student-stress", Roles: []identity.Role{identity.RoleStudent}}
	auth := advAuthStub{
		users: map[string]identity.User{
			"tok-stress": studentUser,
		},
	}

	service := aiapp.NewService(dummyAIRepo{}, nil, nil, nil, cfg)
	handler := New(service, auth)

	var wg sync.WaitGroup
	errCount := 0
	var mu sync.Mutex

	for i := 0; i < 30; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			var rec *httptest.ResponseRecorder
			var req *http.Request

			if idx%2 == 0 {
				payload := map[string]any{
					"questionId": "q-stress-direct",
					"helpLevel":  "hint",
					"message":    fmt.Sprintf("سؤال سريع رقم %d", idx),
				}
				raw, _ := json.Marshal(payload)
				rec = httptest.NewRecorder()
				req = httptest.NewRequest(http.MethodPost, "/question-assistant", bytes.NewReader(raw))
				req.Header.Set("Authorization", "Bearer tok-stress")
				handler.ServeHTTP(rec, req)
			} else {
				payload := map[string]any{
					"message": fmt.Sprintf("عندي سؤال كمي رقم %d في القدرات", idx),
				}
				raw, _ := json.Marshal(payload)
				rec = httptest.NewRecorder()
				req = httptest.NewRequest(http.MethodPost, "/chat", bytes.NewReader(raw))
				req.Header.Set("Authorization", "Bearer tok-stress")
				handler.ServeHTTP(rec, req)
			}

			if rec.Code != http.StatusOK {
				mu.Lock()
				errCount++
				mu.Unlock()
			}
		}(i)
	}

	wg.Wait()

	if errCount > 0 {
		t.Fatalf("%d out of 30 concurrent requests failed", errCount)
	}
}
