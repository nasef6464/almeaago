package domain

import "time"

type HelpLevel string

const (
	HelpHint         HelpLevel = "hint"
	HelpStrongerHint HelpLevel = "stronger_hint"
	HelpConcept      HelpLevel = "concept"
	HelpSteps        HelpLevel = "steps"
	HelpFollowUp     HelpLevel = "follow_up"
)

func ValidHelpLevel(level HelpLevel) bool {
	switch level {
	case HelpHint, HelpStrongerHint, HelpConcept, HelpSteps, HelpFollowUp:
		return true
	default:
		return false
	}
}

type QuestionAssistInput struct {
	ReviewCardID string
	HelpLevel    HelpLevel
	Message      string
}

type QuestionAssistResult struct {
	Text          string
	HelpLevel     HelpLevel
	Provider      Provider
	Model         string
	UsedFallback  bool
	CacheHit      bool
	PromptVersion string
}

type CacheEntry struct {
	CacheKey        string
	UserID          string
	ReviewCardID    string
	QuestionID      string
	QuestionVersion int
	HelpLevel       HelpLevel
	PromptVersion   string
	ResponseText    string
	Provider        Provider
	Model           string
	ExpiresAt       time.Time
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type InteractionStatus string

const (
	InteractionSuccess  InteractionStatus = "success"
	InteractionFallback InteractionStatus = "fallback"
	InteractionError    InteractionStatus = "error"
)

type Interaction struct {
	ID              string
	UserID          string
	Audience        string
	Endpoint        string
	Capability      string
	Provider        Provider
	Model           string
	Status          InteractionStatus
	UsedFallback    bool
	CacheHit        bool
	QuestionID      string
	QuestionVersion int
	ReviewCardID    string
	PromptVersion   string
	LatencyMS       int
	InputTokens     int
	OutputTokens    int
	TotalTokens     int
	UsageEstimated  bool
	ResponseLength  int
	ErrorCategory   string
	Metadata        map[string]any
	RetentionUntil  *time.Time
	CreatedAt       time.Time
}

type InteractionPage struct {
	Items   []Interaction
	Page    int
	Limit   int
	HasMore bool
}
