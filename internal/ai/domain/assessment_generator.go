package domain

type GeneratedQuestion struct {
	Text          string   `json:"text"`
	Options       []string `json:"options"`
	CorrectAnswer int      `json:"correctAnswer"`
	Explanation   string   `json:"explanation"`
	Difficulty    string   `json:"difficulty"`
	Skills        []string `json:"skills"`
}

type GenerateAssessmentInput struct {
	SchoolID   string         `json:"schoolId,omitempty"`
	PromptText string         `json:"promptText"`
	Media      *ChatImageData `json:"media,omitempty"`
}

type GenerateAssessmentResult struct {
	Questions []GeneratedQuestion `json:"questions"`
	Provider  Provider            `json:"provider"`
	Model     string              `json:"model"`
	LatencyMS int                 `json:"latencyMs"`
}
