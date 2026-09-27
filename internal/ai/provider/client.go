package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	ai "github.com/nasef6464/almeaago/internal/ai/domain"
)

type Config struct {
	Timeout time.Duration

	GeminiAPIKey     string
	OpenRouterAPIKey string
	QwenAPIKey       string
	DeepSeekAPIKey   string
	OpenAIAPIKey     string

	OllamaBaseURL   string
	OllamaModel     string
	LMStudioBaseURL string
	LMStudioModel   string
}

type Client struct {
	cfg    Config
	client *http.Client
}

func New(cfg Config) *Client {
	if cfg.Timeout <= 0 {
		cfg.Timeout = 15 * time.Second
	}
	return &Client{
		cfg: cfg,
		client: &http.Client{Timeout: cfg.Timeout},
	}
}

func (c *Client) SecretConfigured(provider ai.Provider) bool {
	switch provider {
	case ai.ProviderGemini:
		return strings.TrimSpace(c.cfg.GeminiAPIKey) != ""
	case ai.ProviderOpenRouter:
		return strings.TrimSpace(c.cfg.OpenRouterAPIKey) != ""
	case ai.ProviderQwen:
		return strings.TrimSpace(c.cfg.QwenAPIKey) != ""
	case ai.ProviderDeepSeek:
		return strings.TrimSpace(c.cfg.DeepSeekAPIKey) != ""
	case ai.ProviderOpenAI:
		return strings.TrimSpace(c.cfg.OpenAIAPIKey) != ""
	case ai.ProviderOllama:
		return strings.TrimSpace(c.cfg.OllamaBaseURL) != ""
	case ai.ProviderLMStudio:
		return strings.TrimSpace(c.cfg.LMStudioBaseURL) != ""
	default:
		return false
	}
}

func (c *Client) Call(
	ctx context.Context,
	setting ai.ProviderSetting,
	prompt string,
) (ai.ProviderCallResult, error) {
	if strings.TrimSpace(prompt) == "" {
		return ai.ProviderCallResult{}, errors.New("provider_empty_prompt")
	}
	if !c.SecretConfigured(setting.Provider) {
		return ai.ProviderCallResult{}, errors.New("provider_not_configured")
	}
	switch setting.Provider {
	case ai.ProviderGemini:
		return c.callGemini(ctx, setting, prompt)
	case ai.ProviderOpenRouter, ai.ProviderQwen, ai.ProviderDeepSeek, ai.ProviderOpenAI:
		return c.callOpenAICompatible(ctx, setting, prompt)
	case ai.ProviderOllama:
		return c.callOllama(ctx, setting, prompt)
	case ai.ProviderLMStudio:
		return c.callLMStudio(ctx, setting, prompt)
	default:
		return ai.ProviderCallResult{}, errors.New("provider_unsupported")
	}
}

func canonicalExternalBase(provider ai.Provider, raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	defaults := map[ai.Provider]string{
		ai.ProviderGemini:     "https://generativelanguage.googleapis.com",
		ai.ProviderOpenRouter: "https://openrouter.ai/api/v1",
		ai.ProviderQwen:       "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
		ai.ProviderDeepSeek:   "https://api.deepseek.com",
		ai.ProviderOpenAI:     "https://api.openai.com/v1",
	}
	expected, ok := defaults[provider]
	if !ok {
		return "", errors.New("provider_base_url_not_external")
	}
	if raw == "" {
		return expected, nil
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme != "https" || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", errors.New("provider_base_url_invalid")
	}
	expectedURL, _ := url.Parse(expected)
	if !strings.EqualFold(parsed.Hostname(), expectedURL.Hostname()) {
		return "", errors.New("provider_base_url_host_not_allowed")
	}
	path := strings.TrimSuffix(parsed.EscapedPath(), "/")
	expectedPath := strings.TrimSuffix(expectedURL.EscapedPath(), "/")
	if path != expectedPath {
		return "", errors.New("provider_base_url_path_not_allowed")
	}
	return strings.TrimSuffix(raw, "/"), nil
}

func (c *Client) callGemini(
	ctx context.Context,
	setting ai.ProviderSetting,
	prompt string,
) (ai.ProviderCallResult, error) {
	base, err := canonicalExternalBase(ai.ProviderGemini, setting.BaseURL)
	if err != nil {
		return ai.ProviderCallResult{}, err
	}
	model := strings.TrimSpace(setting.Model)
	if model == "" {
		return ai.ProviderCallResult{}, errors.New("provider_model_missing")
	}
	endpoint := fmt.Sprintf("%s/v1beta/models/%s:generateContent?key=%s", base, url.PathEscape(model), url.QueryEscape(c.cfg.GeminiAPIKey))
	body := map[string]any{
		"contents": []any{map[string]any{"parts": []any{map[string]any{"text": prompt}}}},
		"generationConfig": map[string]any{"maxOutputTokens": setting.MaxOutputTokens},
	}
	var payload struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
		Usage struct {
			Prompt int `json:"promptTokenCount"`
			Output int `json:"candidatesTokenCount"`
			Total  int `json:"totalTokenCount"`
			Cached int `json:"cachedContentTokenCount"`
		} `json:"usageMetadata"`
	}
	if err = c.postJSON(ctx, endpoint, body, nil, &payload); err != nil {
		return ai.ProviderCallResult{}, err
	}
	text := ""
	if len(payload.Candidates) > 0 {
		parts := make([]string, 0, len(payload.Candidates[0].Content.Parts))
		for _, part := range payload.Candidates[0].Content.Parts {
			if strings.TrimSpace(part.Text) != "" {
				parts = append(parts, strings.TrimSpace(part.Text))
			}
		}
		text = strings.TrimSpace(strings.Join(parts, "\n"))
	}
	if text == "" {
		return ai.ProviderCallResult{}, errors.New("provider_empty_response")
	}
	usage := ai.ProviderUsage{
		InputTokens: payload.Usage.Prompt,
		OutputTokens: payload.Usage.Output,
		TotalTokens: payload.Usage.Total,
		CachedTokens: payload.Usage.Cached,
	}
	usage = normalizeUsage(usage, prompt, text)
	return ai.ProviderCallResult{Text: text, Usage: usage, Model: model}, nil
}

func (c *Client) callOpenAICompatible(
	ctx context.Context,
	setting ai.ProviderSetting,
	prompt string,
) (ai.ProviderCallResult, error) {
	base, err := canonicalExternalBase(setting.Provider, setting.BaseURL)
	if err != nil {
		return ai.ProviderCallResult{}, err
	}
	model := strings.TrimSpace(setting.Model)
	if model == "" {
		return ai.ProviderCallResult{}, errors.New("provider_model_missing")
	}
	apiKey := c.apiKey(setting.Provider)
	body := map[string]any{
		"model": model,
		"messages": []any{map[string]any{"role": "user", "content": prompt}},
		"temperature": 0.25,
		"max_tokens": setting.MaxOutputTokens,
	}
	headers := map[string]string{"Authorization": "Bearer " + apiKey}
	if setting.Provider == ai.ProviderOpenRouter {
		headers["X-Title"] = "ALMEAA"
	}
	var payload struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Usage struct {
			Prompt int `json:"prompt_tokens"`
			Output int `json:"completion_tokens"`
			Total  int `json:"total_tokens"`
			Details struct {
				Cached int `json:"cached_tokens"`
			} `json:"prompt_tokens_details"`
		} `json:"usage"`
	}
	if err = c.postJSON(ctx, base+"/chat/completions", body, headers, &payload); err != nil {
		return ai.ProviderCallResult{}, err
	}
	if len(payload.Choices) == 0 || strings.TrimSpace(payload.Choices[0].Message.Content) == "" {
		return ai.ProviderCallResult{}, errors.New("provider_empty_response")
	}
	text := strings.TrimSpace(payload.Choices[0].Message.Content)
	usage := normalizeUsage(ai.ProviderUsage{
		InputTokens: payload.Usage.Prompt,
		OutputTokens: payload.Usage.Output,
		TotalTokens: payload.Usage.Total,
		CachedTokens: payload.Usage.Details.Cached,
	}, prompt, text)
	return ai.ProviderCallResult{Text: text, Usage: usage, Model: model}, nil
}

func (c *Client) callOllama(
	ctx context.Context,
	setting ai.ProviderSetting,
	prompt string,
) (ai.ProviderCallResult, error) {
	base := strings.TrimRight(strings.TrimSpace(c.cfg.OllamaBaseURL), "/")
	model := strings.TrimSpace(setting.Model)
	if model == "" {
		model = strings.TrimSpace(c.cfg.OllamaModel)
	}
	if base == "" || model == "" {
		return ai.ProviderCallResult{}, errors.New("provider_not_configured")
	}
	var payload struct {
		Response string `json:"response"`
		PromptEvalCount int `json:"prompt_eval_count"`
		EvalCount int `json:"eval_count"`
	}
	body := map[string]any{
		"model": model,
		"prompt": prompt,
		"stream": false,
		"options": map[string]any{"num_predict": setting.MaxOutputTokens},
	}
	if err := c.postJSON(ctx, base+"/api/generate", body, nil, &payload); err != nil {
		return ai.ProviderCallResult{}, err
	}
	text := strings.TrimSpace(payload.Response)
	if text == "" {
		return ai.ProviderCallResult{}, errors.New("provider_empty_response")
	}
	usage := normalizeUsage(ai.ProviderUsage{
		InputTokens: payload.PromptEvalCount,
		OutputTokens: payload.EvalCount,
		TotalTokens: payload.PromptEvalCount + payload.EvalCount,
	}, prompt, text)
	return ai.ProviderCallResult{Text: text, Usage: usage, Model: model}, nil
}

func (c *Client) callLMStudio(
	ctx context.Context,
	setting ai.ProviderSetting,
	prompt string,
) (ai.ProviderCallResult, error) {
	base := strings.TrimRight(strings.TrimSpace(c.cfg.LMStudioBaseURL), "/")
	model := strings.TrimSpace(setting.Model)
	if model == "" {
		model = strings.TrimSpace(c.cfg.LMStudioModel)
	}
	if base == "" || model == "" {
		return ai.ProviderCallResult{}, errors.New("provider_not_configured")
	}
	var payload struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Usage struct {
			Prompt int `json:"prompt_tokens"`
			Output int `json:"completion_tokens"`
			Total  int `json:"total_tokens"`
		} `json:"usage"`
	}
	body := map[string]any{
		"model": model,
		"messages": []any{map[string]any{"role": "user", "content": prompt}},
		"temperature": 0.25,
		"max_tokens": setting.MaxOutputTokens,
	}
	if err := c.postJSON(ctx, base+"/chat/completions", body, nil, &payload); err != nil {
		return ai.ProviderCallResult{}, err
	}
	if len(payload.Choices) == 0 || strings.TrimSpace(payload.Choices[0].Message.Content) == "" {
		return ai.ProviderCallResult{}, errors.New("provider_empty_response")
	}
	text := strings.TrimSpace(payload.Choices[0].Message.Content)
	usage := normalizeUsage(ai.ProviderUsage{
		InputTokens: payload.Usage.Prompt,
		OutputTokens: payload.Usage.Output,
		TotalTokens: payload.Usage.Total,
	}, prompt, text)
	return ai.ProviderCallResult{Text: text, Usage: usage, Model: model}, nil
}

func (c *Client) apiKey(provider ai.Provider) string {
	switch provider {
	case ai.ProviderOpenRouter:
		return c.cfg.OpenRouterAPIKey
	case ai.ProviderQwen:
		return c.cfg.QwenAPIKey
	case ai.ProviderDeepSeek:
		return c.cfg.DeepSeekAPIKey
	case ai.ProviderOpenAI:
		return c.cfg.OpenAIAPIKey
	default:
		return ""
	}
}

func (c *Client) postJSON(
	ctx context.Context,
	endpoint string,
	body any,
	headers map[string]string,
	target any,
) error {
	raw, err := json.Marshal(body)
	if err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	for key, value := range headers {
		request.Header.Set(key, value)
	}
	response, err := c.client.Do(request)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return errors.New("provider_timeout")
		}
		return errors.New("provider_network_error")
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 32<<10))
		return fmt.Errorf("provider_http_%d", response.StatusCode)
	}
	decoder := json.NewDecoder(io.LimitReader(response.Body, 256<<10))
	if err = decoder.Decode(target); err != nil {
		return errors.New("provider_invalid_json")
	}
	return nil
}

func normalizeUsage(usage ai.ProviderUsage, prompt, text string) ai.ProviderUsage {
	if usage.TotalTokens > 0 {
		if usage.InputTokens < 0 {
			usage.InputTokens = 0
		}
		if usage.OutputTokens < 0 {
			usage.OutputTokens = 0
		}
		if usage.CachedTokens < 0 {
			usage.CachedTokens = 0
		}
		return usage
	}
	input := maxInt(1, (len([]rune(prompt))+2)/3)
	output := maxInt(1, (len([]rune(text))+2)/3)
	return ai.ProviderUsage{
		InputTokens: input,
		OutputTokens: output,
		TotalTokens: input + output,
		Estimated: true,
	}
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
