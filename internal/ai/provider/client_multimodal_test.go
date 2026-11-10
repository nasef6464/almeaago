package provider_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	ai "github.com/nasef6464/almeaago/internal/ai/domain"
	"github.com/nasef6464/almeaago/internal/ai/provider"
)

func testMultimodalGeminiHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Contents []struct {
			Parts []struct {
				Text       string `json:"text"`
				InlineData *struct {
					MimeType string `json:"mimeType"`
					Data     string `json:"data"`
				} `json:"inlineData"`
			} `json:"parts"`
		} `json:"contents"`
		GenerationConfig struct {
			ResponseMimeType string `json:"responseMimeType"`
		} `json:"generationConfig"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if len(body.Contents) == 0 || len(body.Contents[0].Parts) < 2 {
		http.Error(w, "missing multimodal parts", http.StatusBadRequest)
		return
	}
	if body.GenerationConfig.ResponseMimeType != "application/json" {
		http.Error(w, "expected responseMimeType to be application/json", http.StatusBadRequest)
		return
	}
	resp := map[string]any{
		"candidates": []map[string]any{
			{"content": map[string]any{"parts": []map[string]any{{"text": `[{"text":"سؤال اختباري","options":["أ","ب","ج","د"],"correctAnswer":0}]`}}}},
		},
		"usageMetadata": map[string]int{"promptTokenCount": 150, "candidatesTokenCount": 50, "totalTokenCount": 200},
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func TestCallMultimodal_GeminiSuccess(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(testMultimodalGeminiHandler))
	defer srv.Close()

	c := provider.New(provider.Config{GeminiAPIKey: "test-key"})
	setting := ai.ProviderSetting{
		Provider:        ai.ProviderGemini,
		Model:           "gemini-2.5-flash",
		BaseURL:         srv.URL,
		MaxOutputTokens: 2048,
	}
	media := &ai.ChatImageData{
		Data:     "JVBERi0xLjQKJeLjz9MK...",
		MimeType: "application/pdf",
	}
	res, err := c.CallMultimodal(context.Background(), setting, "Extract questions", media, true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Text == "" {
		t.Fatalf("expected non-empty text")
	}
	if res.Usage.InputTokens != 150 {
		t.Fatalf("expected 150 input tokens, got %d", res.Usage.InputTokens)
	}
}
