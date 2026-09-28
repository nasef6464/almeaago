package domain

import "time"

type DailyUsage struct {
	DayKey        time.Time `json:"dayKey"`
	ScopeType     string    `json:"scopeType"`
	ScopeID       string    `json:"scopeId"`
	RequestCount  int       `json:"requestCount"`
	InputTokens   int64     `json:"inputTokens"`
	OutputTokens  int64     `json:"outputTokens"`
	TotalTokens   int64     `json:"totalTokens"`
	CachedTokens  int64     `json:"cachedTokens"`
	FallbackCount int       `json:"fallbackCount"`
	ErrorCount    int       `json:"errorCount"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

type ProviderUsageSummary struct {
	Provider     Provider `json:"provider"`
	Requests     int      `json:"requests"`
	TotalTokens  int64    `json:"totalTokens"`
	Fallbacks    int      `json:"fallbacks"`
	Errors       int      `json:"errors"`
	AvgLatencyMS int      `json:"avgLatencyMs"`
}

type UsageSummary struct {
	Today          DailyUsage             `json:"today"`
	Last24h        int                    `json:"last24h"`
	Fallback24h    int                    `json:"fallback24h"`
	Error24h       int                    `json:"error24h"`
	CacheHit24h    int                    `json:"cacheHit24h"`
	InputTokens24h int64                  `json:"inputTokens24h"`
	OutputTokens24h int64                 `json:"outputTokens24h"`
	TotalTokens24h int64                  `json:"totalTokens24h"`
	CachedTokens24h int64                 `json:"cachedTokens24h"`
	ByProvider     []ProviderUsageSummary `json:"byProvider"`
}

type AdminReadiness struct {
	CheckedAt           time.Time  `json:"checkedAt"`
	Status              string     `json:"status"`
	EnabledProviders    int        `json:"enabledProviders"`
	ConfiguredProviders int        `json:"configuredProviders"`
	OpenCircuits        []Provider `json:"openCircuits"`
	TodayRequests       int        `json:"todayRequests"`
	GlobalDailyLimit    int        `json:"globalDailyLimit"`
	UserDailyLimit      int        `json:"userDailyLimit"`
	Fallback24h         int        `json:"fallback24h"`
	Error24h            int        `json:"error24h"`
	Notes               []string   `json:"notes"`
}

type AdminCopilotInput struct {
	Message string `json:"message"`
}

type AdminCopilotResult struct {
	Text          string         `json:"text"`
	Provider      Provider       `json:"provider"`
	Model         string         `json:"model"`
	UsedFallback  bool           `json:"usedFallback"`
	PromptVersion string         `json:"promptVersion"`
	Readiness     AdminReadiness `json:"readiness"`
}
