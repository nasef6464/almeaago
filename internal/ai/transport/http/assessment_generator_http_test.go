package aihttp

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	aiapp "github.com/nasef6464/almeaago/internal/ai/application"
	ai "github.com/nasef6464/almeaago/internal/ai/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type mockMultimodalHTTPClient struct {
	result ai.ProviderCallResult
}

func (m *mockMultimodalHTTPClient) SecretConfigured(p ai.Provider) bool { return true }
func (m *mockMultimodalHTTPClient) Call(ctx context.Context, s ai.ProviderSetting, prompt string) (ai.ProviderCallResult, error) {
	return m.result, nil
}
func (m *mockMultimodalHTTPClient) CallMultimodal(ctx context.Context, s ai.ProviderSetting, prompt string, media *ai.ChatImageData, jsonResponse bool) (ai.ProviderCallResult, error) {
	return m.result, nil
}

func TestGenerateAssessmentEndpoint_RequiresAuth(t *testing.T) {
	h := New(nil, nil)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/generate-assessment", bytes.NewBufferString("{}"))

	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized && rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 401 or 503, got %d", rec.Code)
	}
}

func TestGenerateAssessmentEndpoint_RejectsStudent(t *testing.T) {
	authStub := staticAuthStub{
		user: identity.User{ID: "student-1", Roles: []identity.Role{identity.RoleStudent}},
	}
	repo := dummyAIRepo{}
	svc := aiapp.NewService(repo, nil, nil, &mockMultimodalHTTPClient{}, aiapp.Config{})
	h := New(svc, authStub)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/generate-assessment", bytes.NewBufferString(`{"promptText":"test"}`))
	req.Header.Set("Authorization", "Bearer valid-token")
	req.Header.Set("X-CSRF-Token", "valid-csrf")

	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for student, got %d", rec.Code)
	}
}

type repoWithGeminiStub struct {
	dummyAIRepo
}

func (r repoWithGeminiStub) ListProviderSettings(context.Context) ([]ai.ProviderSetting, error) {
	return []ai.ProviderSetting{
		{Provider: ai.ProviderGemini, Enabled: true, Model: "gemini-2.5-flash"},
	}, nil
}

func TestGenerateAssessmentEndpoint_TeacherSuccess(t *testing.T) {
	mockJson := `[
		{
			"text": "ما ناتج جمع 15 + 25؟",
			"options": ["30", "35", "40", "45"],
			"correctAnswer": 2,
			"explanation": "15 + 25 = 40",
			"difficulty": "easy",
			"skills": ["العمليات الحسابية"]
		}
	]`
	authStub := staticAuthStub{
		user: identity.User{ID: "teacher-1", Roles: []identity.Role{identity.RoleTeacher}},
	}
	client := &mockMultimodalHTTPClient{
		result: ai.ProviderCallResult{
			Text:  mockJson,
			Model: "gemini-2.5-flash",
		},
	}
	repo := repoWithGeminiStub{}
	svc := aiapp.NewService(repo, nil, nil, client, aiapp.Config{})
	h := New(svc, authStub)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/generate-assessment", bytes.NewBufferString(`{"promptText":"استخرج الأسئلة"}`))
	req.Header.Set("Authorization", "Bearer valid-token")
	req.Header.Set("X-CSRF-Token", "valid-csrf")

	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for teacher, got %d (body: %s)", rec.Code, rec.Body.String())
	}
}
