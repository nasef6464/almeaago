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
	ReviewCardID       string
	QuestionID         string
	AttemptID          string
	ResultID           string
	Context            string
	HelpLevel          HelpLevel
	Message            string
	BoardMode          string
	BoardContext       string
	ImageVersion       string
	TutorSessionID     string
	UserSelectedAnswer *int
	CorrectAnswer      *int
	QuestionText       string
}

type TeachingStoryboard struct {
	Version  int             `json:"version"`
	Language string          `json:"language"`
	Scenes   []TeachingScene `json:"scenes"`
}

type TeachingScene struct {
	ID         string              `json:"id"`
	Narration  string              `json:"narration"`
	Actions    []TeachingAction    `json:"actions"`
	Checkpoint *TeachingCheckpoint `json:"checkpoint,omitempty"`
}

type TeachingAction struct {
	Type    string `json:"type"`
	ID      string `json:"id,omitempty"`
	Kind    string `json:"kind,omitempty"`
	Content string `json:"content,omitempty"`
	Target  string `json:"target,omitempty"`
}

type TeachingCheckpoint struct {
	Prompt string    `json:"prompt"`
	Hints  [2]string `json:"hints"`
}

type QuestionAssistResult struct {
	Text          string
	HelpLevel     HelpLevel
	Provider      Provider
	Model         string
	UsedFallback  bool
	CacheHit      bool
	PromptVersion string
	Storyboard    *TeachingStoryboard
}

type StudentChatInput struct {
	Message        string
	Image          *ChatImageData
	TutorSessionID string
	History        []ChatTurn
	Context        ChatContext
}

type ChatImageData struct {
	Data     string `json:"data"`
	MimeType string `json:"mimeType"`
}

type ChatTurn struct {
	Sender string `json:"sender"`
	Text   string `json:"text"`
}

type ChatContext struct {
	PathID  string `json:"pathId"`
	SkillID string `json:"skillId"`
	ExamID  string `json:"examId"`
}

type StudentChatResult struct {
	Text             string             `json:"text"`
	Reply            string             `json:"reply"`
	Suggestions      []string           `json:"suggestions"`
	Personalized     bool               `json:"personalized"`
	WeaknessesCount  int                `json:"weaknessesCount"`
	Provider         Provider           `json:"provider"`
	Model            string             `json:"model"`
	UsedFallback     bool               `json:"usedFallback"`
	RecommendedLinks []StudentTutorLink `json:"recommendedLinks"`
}

type StudentTutorLink struct {
	Label   string `json:"label"`
	Href    string `json:"href"`
	SkillID string `json:"skillId"`
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
	CachedTokens    int
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
