package provider

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	ai "github.com/nasef6464/almeaago/internal/ai/domain"
)

func TestOpenAIRejectsUnapprovedAdminBaseURL(t *testing.T) {
	client := New(Config{OpenAIAPIKey: "secret"})
	_, err := client.Call(context.Background(), ai.ProviderSetting{
		Provider: ai.ProviderOpenAI, Model: "gpt-test", BaseURL: "https://evil.example/v1", MaxOutputTokens: 200,
	}, "hello")
	if err == nil || !strings.Contains(err.Error(), "host_not_allowed") {
		t.Fatalf("expected base URL guard, got %v", err)
	}
}

func TestOllamaAdapterUsesServerConfiguredLocalRuntime(t *testing.T) {
	var gotModel string
	var gotPrompt string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload map[string]any
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		gotModel, _ = payload["model"].(string)
		gotPrompt, _ = payload["prompt"].(string)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"response":"مساعدة قصيرة","prompt_eval_count":10,"eval_count":4}`))
	}))
	defer server.Close()

	client := New(Config{OllamaBaseURL: server.URL, OllamaModel: "fallback-model"})
	out, err := client.Call(context.Background(), ai.ProviderSetting{
		Provider: ai.ProviderOllama, Model: "gemma-test", MaxOutputTokens: 180,
	}, "سياق السؤال")
	if err != nil {
		t.Fatal(err)
	}
	if gotModel != "gemma-test" || gotPrompt != "سياق السؤال" {
		t.Fatalf("unexpected request model=%q prompt=%q", gotModel, gotPrompt)
	}
	if out.Text != "مساعدة قصيرة" || out.Usage.TotalTokens != 14 || out.Usage.Estimated {
		t.Fatalf("unexpected provider response %#v", out)
	}
}

func TestMissingProviderConfigurationFailsClosed(t *testing.T) {
	client := New(Config{})
	if client.SecretConfigured(ai.ProviderGemini) {
		t.Fatal("empty Gemini key reported configured")
	}
	_, err := client.Call(context.Background(), ai.ProviderSetting{
		Provider: ai.ProviderGemini, Model: "gemini-test", MaxOutputTokens: 100,
	}, "hello")
	if err == nil || err.Error() != "provider_not_configured" {
		t.Fatalf("expected fail-closed provider configuration, got %v", err)
	}
}

func TestUsageIsEstimatedWhenProviderOmitsTokenCounts(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"جواب"}}],"usage":{}}`))
	}))
	defer server.Close()

	client := New(Config{LMStudioBaseURL: server.URL, LMStudioModel: "local"})
	out, err := client.Call(context.Background(), ai.ProviderSetting{
		Provider: ai.ProviderLMStudio, Model: "local", MaxOutputTokens: 100,
	}, "سؤال")
	if err != nil {
		t.Fatal(err)
	}
	if !out.Usage.Estimated || out.Usage.TotalTokens <= 0 {
		t.Fatalf("expected estimated usage %#v", out.Usage)
	}
}
