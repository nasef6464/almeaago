package domain

import "time"

type ProviderID string

const (
	ProviderGemini     ProviderID = "gemini"
	ProviderOpenRouter ProviderID = "openrouter"
	ProviderDeepSeek   ProviderID = "deepseek"
	ProviderQwen       ProviderID = "qwen"
	ProviderOpenAI     ProviderID = "openai"
	ProviderOllama     ProviderID = "ollama"
	ProviderLMStudio   ProviderID = "lmstudio"
	ProviderNone       ProviderID = "none"
)

func ValidProviderID(id ProviderID) bool {
	switch id {
	case ProviderGemini, ProviderOpenRouter, ProviderDeepSeek, ProviderQwen, ProviderOpenAI, ProviderOllama, ProviderLMStudio:
		return true
	default:
		return false
	}
}

type ProviderConfig struct {
	Provider        ProviderID `json:"provider"`
	Enabled         bool       `json:"enabled"`
	Model           string     `json:"model"`
	BaseURL         string     `json:"baseUrl"`
	HasSecret       bool       `json:"hasSecret"`
	Priority        int        `json:"priority"`
	MaxOutputTokens int        `json:"maxOutputTokens"`
	TimeoutMS       int        `json:"timeoutMs"`
	Revision        int        `json:"revision"`
	CreatedAt       time.Time  `json:"createdAt"`
	UpdatedAt       time.Time  `json:"updatedAt"`
}

type ProviderConfigWrite struct {
	Enabled          bool       `json:"enabled"`
	Model            string     `json:"model"`
	BaseURL          string     `json:"baseUrl"`
	Secret           string     `json:"secret,omitempty"`
	ClearSecret      bool       `json:"clearSecret,omitempty"`
	Priority         int        `json:"priority"`
	MaxOutputTokens  int        `json:"maxOutputTokens"`
	TimeoutMS        int        `json:"timeoutMs"`
	ExpectedRevision int        `json:"expectedRevision"`
}

type ProviderRuntime struct {
	Provider        ProviderID
	Enabled         bool
	Model           string
	BaseURL         string
	Secret          string
	Priority        int
	MaxOutputTokens int
	TimeoutMS       int
	Revision        int
}

type Usage struct {
	InputTokens  int `json:"inputTokens"`
	OutputTokens int `json:"outputTokens"`
	CachedTokens int `json:"cachedTokens"`
}

type GenerateRequest struct {
	Prompt          string
	MaxOutputTokens int
	TimeoutMS       int
}

type GenerateResult struct {
	Text     string
	Provider ProviderID
	Model    string
	Usage    Usage
}

type HelpLevel string

const (
	HelpHint        HelpLevel = "hint"
	HelpStrongerHint HelpLevel = "stronger_hint"
	HelpConcept     HelpLevel = "concept"
	HelpSteps       HelpLevel = "steps"
	HelpFollowUp    HelpLevel = "follow_up"
)

func ValidHelpLevel(level HelpLevel) bool {
	return level == HelpHint || level == HelpStrongerHint || level == HelpConcept || level == HelpSteps || level == HelpFollowUp
}

type QuestionAssistRequest struct {
	CardID    string    `json:"cardId"`
	HelpLevel HelpLevel `json:"helpLevel"`
	Message   string    `json:"message"`
}

type QuestionAssistResponse struct {
	Text        string     `json:"text"`
	HelpLevel   HelpLevel  `json:"helpLevel"`
	Provider    ProviderID `json:"provider"`
	Model       string     `json:"model"`
	UsedFallback bool      `json:"usedFallback"`
	CacheHit    bool       `json:"cacheHit"`
	HasImage    bool       `json:"hasImage"`
	ImageSentToProvider bool `json:"imageSentToProvider"`
}

type QuestionAssistCacheEntry struct {
	CacheKey        string
	StudentID       string
	ReviewCardID    string
	QuestionID      string
	QuestionVersion int
	HelpLevel       HelpLevel
	ResponseText    string
	Provider        ProviderID
	Model           string
	ExpiresAt       time.Time
}

type Interaction struct {
	RequestID      string
	UserID         string
	Audience       string
	Endpoint       string
	Capability     string
	Provider       ProviderID
	Model          string
	Status         string
	UsedFallback   bool
	CacheHit       bool
	LatencyMS      int
	InputTokens    int
	OutputTokens   int
	CachedTokens   int
	ResponseLength int
	ErrorCategory  string
	Metadata       map[string]any
	RetentionUntil *time.Time
}

type ProviderHealth struct {
	Provider      ProviderID `json:"provider"`
	Failures      int        `json:"failures"`
	Open          bool       `json:"open"`
	OpenUntil     *time.Time `json:"openUntil,omitempty"`
	LastFailureAt *time.Time `json:"lastFailureAt,omitempty"`
}

type Status struct {
	Providers []ProviderConfig `json:"providers"`
	Health    []ProviderHealth `json:"health"`
}


type InteractionRow struct {
	ID             string     `json:"id"`
	UserID         string     `json:"userId"`
	Audience       string     `json:"audience"`
	Endpoint       string     `json:"endpoint"`
	Capability     string     `json:"capability"`
	Provider       ProviderID `json:"provider"`
	Model          string     `json:"model"`
	Status         string     `json:"status"`
	UsedFallback   bool       `json:"usedFallback"`
	CacheHit       bool       `json:"cacheHit"`
	LatencyMS      int        `json:"latencyMs"`
	InputTokens    int        `json:"inputTokens"`
	OutputTokens   int        `json:"outputTokens"`
	CachedTokens   int        `json:"cachedTokens"`
	TotalTokens    int        `json:"totalTokens"`
	ResponseLength int        `json:"responseLength"`
	ErrorCategory  string     `json:"errorCategory"`
	CreatedAt      time.Time  `json:"createdAt"`
}

type InteractionPage struct {
	Items   []InteractionRow `json:"items"`
	Page    int              `json:"page"`
	Limit   int              `json:"limit"`
	HasMore bool             `json:"hasMore"`
}

type UsageSummary struct {
	RequestCount int `json:"requestCount"`
	InputTokens int `json:"inputTokens"`
	OutputTokens int `json:"outputTokens"`
	CachedTokens int `json:"cachedTokens"`
	FallbackCount int `json:"fallbackCount"`
	ErrorCount int `json:"errorCount"`
}
