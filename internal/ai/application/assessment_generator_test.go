package application

import (
	"context"
	"testing"

	ai "github.com/nasef6464/almeaago/internal/ai/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type mockMultimodalClient struct {
	result ai.ProviderCallResult
	err    error
}

func (m *mockMultimodalClient) SecretConfigured(p ai.Provider) bool { return true }
func (m *mockMultimodalClient) Call(ctx context.Context, s ai.ProviderSetting, prompt string) (ai.ProviderCallResult, error) {
	return m.result, m.err
}
func (m *mockMultimodalClient) CallMultimodal(ctx context.Context, s ai.ProviderSetting, prompt string, media *ai.ChatImageData, jsonResponse bool) (ai.ProviderCallResult, error) {
	return m.result, m.err
}

func TestGenerateAssessment_ParsesValidJsonQuestions(t *testing.T) {
	mockJson := `[
		{
			"text": "إذا كانت س + ص = 10 و س - ص = 4، فما قيمة س؟",
			"options": ["7", "6", "5", "3"],
			"correctAnswer": 0,
			"explanation": "بجمع المعادلتين: 2س = 14 => س = 7",
			"difficulty": "medium",
			"skills": ["معادلات الدرجة الأولى", "الجبر"]
		}
	]`
	client := &mockMultimodalClient{
		result: ai.ProviderCallResult{
			Text:  mockJson,
			Model: "gemini-2.5-flash",
		},
	}
	repo := &repoStub{
		settings: []ai.ProviderSetting{
			{Provider: ai.ProviderGemini, Enabled: true, Model: "gemini-2.5-flash"},
		},
	}
	svc := NewService(repo, nil, nil, client, Config{})

	u := identity.User{ID: "teacher-1", Roles: []identity.Role{identity.RoleTeacher}}
	res, err := svc.GenerateAssessment(context.Background(), u, ai.GenerateAssessmentInput{
		PromptText: "استخرج الأسئلة من الورقة",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(res.Questions) != 1 {
		t.Fatalf("expected 1 question, got %d", len(res.Questions))
	}
	if res.Questions[0].CorrectAnswer != 0 {
		t.Fatalf("expected correct answer index 0, got %d", res.Questions[0].CorrectAnswer)
	}
	if res.Questions[0].Text != "إذا كانت س + ص = 10 و س - ص = 4، فما قيمة س؟" {
		t.Fatalf("unexpected question text: %s", res.Questions[0].Text)
	}
}
