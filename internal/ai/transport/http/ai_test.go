package aihttp

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	aiapp "github.com/nasef6464/almeaago/internal/ai/application"
	ai "github.com/nasef6464/almeaago/internal/ai/domain"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type dummyAIRepo struct{}

func (d dummyAIRepo) ListProviderSettings(context.Context) ([]ai.ProviderSetting, error) {
	return []ai.ProviderSetting{}, nil
}
func (d dummyAIRepo) ProviderSetting(context.Context, ai.Provider) (ai.ProviderSetting, error) {
	return ai.ProviderSetting{}, nil
}
func (d dummyAIRepo) UpdateProviderSetting(context.Context, string, ai.Provider, ai.ProviderSettingWrite) (ai.ProviderSetting, error) {
	return ai.ProviderSetting{}, nil
}
func (d dummyAIRepo) RecordProviderSuccess(context.Context, ai.Provider, time.Time) error {
	return nil
}
func (d dummyAIRepo) RecordProviderFailure(context.Context, ai.Provider, string, *time.Time, time.Time) error {
	return nil
}
func (d dummyAIRepo) CacheEntry(context.Context, string, time.Time) (ai.CacheEntry, error) {
	return ai.CacheEntry{}, ai.ErrNotFound
}
func (d dummyAIRepo) PutCacheEntry(context.Context, ai.CacheEntry) error { return nil }
func (d dummyAIRepo) InsertInteraction(context.Context, ai.Interaction) error {
	return nil
}
func (d dummyAIRepo) ListInteractions(context.Context, int, int) (ai.InteractionPage, error) {
	return ai.InteractionPage{}, nil
}
func (d dummyAIRepo) CountQuestionAssistSince(context.Context, string, time.Time) (int, error) {
	return 0, nil
}
func (d dummyAIRepo) DailyUsage(context.Context, time.Time, string, string) (ai.DailyUsage, error) {
	return ai.DailyUsage{}, nil
}
func (d dummyAIRepo) UsageSummary(context.Context, time.Time) (ai.UsageSummary, error) {
	return ai.UsageSummary{}, nil
}

type staticAuthStub struct {
	user identity.User
}

func (s staticAuthStub) Authenticate(ctx context.Context, token string) (identityapp.Authenticated, error) {
	return identityapp.Authenticated{User: s.user}, nil
}
func (s staticAuthStub) VerifyCSRF(auth identityapp.Authenticated, token string) error {
	return nil
}

func TestQuestionAssistantAdapter(t *testing.T) {
	cfg := aiapp.Config{
		PerMinuteLimit: 10,
		CacheTTL:       10 * time.Minute,
	}
	service := aiapp.NewService(dummyAIRepo{}, nil, nil, nil, cfg)
	auth := staticAuthStub{
		user: identity.User{
			ID:    "student-123",
			Roles: []identity.Role{identity.RoleStudent},
		},
	}
	handler := New(service, auth)

	// Test 1: Direct questionId + storyboard boardMode (Codax shape)
	reqBody := map[string]any{
		"questionId": "q-456",
		"helpLevel":  "steps",
		"boardMode":  "storyboard_v1",
		"message":    "اشرح لي خطوة بخطوة",
	}
	raw, _ := json.Marshal(reqBody)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/question-assistant", bytes.NewReader(raw))
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	// Verify top-level envelope
	if resp["text"] == "" || resp["text"] == nil {
		t.Errorf("missing top-level text in response")
	}
	if resp["usedFallback"] != true {
		t.Errorf("expected usedFallback=true, got %v", resp["usedFallback"])
	}
	if resp["storyboard"] == nil {
		t.Errorf("expected storyboard object in response")
	}

	// Verify nested result envelope
	nested, ok := resp["result"].(map[string]any)
	if !ok || nested == nil {
		t.Fatalf("missing nested result object")
	}
	if nested["text"] != resp["text"] {
		t.Errorf("mismatched nested text vs top-level text")
	}
}

func TestStudentChatEndpoint(t *testing.T) {
	cfg := aiapp.Config{
		PerMinuteLimit: 10,
		CacheTTL:       10 * time.Minute,
	}
	service := aiapp.NewService(dummyAIRepo{}, nil, nil, nil, cfg)
	auth := staticAuthStub{
		user: identity.User{
			ID:    "student-123",
			Roles: []identity.Role{identity.RoleStudent},
		},
	}
	handler := New(service, auth)

	t.Run("quantitative message triggers math advice", func(t *testing.T) {
		reqBody := map[string]any{
			"message": "عندي مشكلة في مسائل الكسور والنسبة المئوية في القدرات",
		}
		raw, _ := json.Marshal(reqBody)
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/chat", bytes.NewReader(raw))
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
		}

		var resp ai.StudentChatResult
		if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if resp.Text == "" || resp.Reply == "" {
			t.Errorf("expected non-empty reply")
		}
		if len(resp.Suggestions) == 0 {
			t.Errorf("expected suggestions array")
		}
		if !resp.UsedFallback {
			t.Errorf("expected usedFallback=true when LLM unconfigured")
		}
	})

	t.Run("verbal message triggers verbal advice", func(t *testing.T) {
		reqBody := map[string]any{
			"message": "كيف أتعامل مع التناظر اللفظي واستيعاب المقروء؟",
		}
		raw, _ := json.Marshal(reqBody)
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/chat", bytes.NewReader(raw))
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
		}

		var resp ai.StudentChatResult
		if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if resp.Text == "" {
			t.Errorf("expected non-empty reply")
		}
	})
}
