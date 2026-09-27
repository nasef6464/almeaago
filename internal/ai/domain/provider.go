package domain

import "time"

type Provider string

const (
	ProviderGemini     Provider = "gemini"
	ProviderOpenRouter Provider = "openrouter"
	ProviderQwen       Provider = "qwen"
	ProviderDeepSeek   Provider = "deepseek"
	ProviderOpenAI     Provider = "openai"
	ProviderOllama     Provider = "ollama"
	ProviderLMStudio   Provider = "lmstudio"
	ProviderNone       Provider = "none"
)

func ValidProvider(provider Provider) bool {
	switch provider {
	case ProviderGemini, ProviderOpenRouter, ProviderQwen, ProviderDeepSeek, ProviderOpenAI, ProviderOllama, ProviderLMStudio:
		return true
	default:
		return false
	}
}

type ProviderSetting struct {
	Provider         Provider
	Enabled          bool
	Model            string
	BaseURL          string
	Priority         int
	MaxOutputTokens  int
	Revision         int
	SecretConfigured bool
	CreatedAt        time.Time
	UpdatedAt        time.Time
	Health           ProviderHealth
}

type ProviderHealth struct {
	Provider            Provider
	ConsecutiveFailures int
	OpenUntil           *time.Time
	LastError           string
	LastSuccessAt       *time.Time
	LastFailureAt       *time.Time
	UpdatedAt           time.Time
}

type ProviderSettingWrite struct {
	Enabled          bool
	Model            string
	BaseURL          string
	Priority         int
	MaxOutputTokens  int
	ExpectedRevision int
}

type ProviderUsage struct {
	InputTokens  int
	OutputTokens int
	TotalTokens  int
	CachedTokens int
	Estimated    bool
}

type ProviderResponse struct {
	Text     string
	Provider Provider
	Model    string
	Usage    ProviderUsage
}

type ProviderAttempt struct {
	Provider        Provider
	Model           string
	Prompt          string
	MaxOutputTokens int
}

type ProviderCallResult struct {
	Text  string
	Usage ProviderUsage
	Model string
}
