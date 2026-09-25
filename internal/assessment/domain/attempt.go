package domain

import "time"

type AttemptStatus string

const (
	AttemptInProgress AttemptStatus = "in_progress"
	AttemptSubmitted  AttemptStatus = "submitted"
	AttemptExpired    AttemptStatus = "expired"
	AttemptAbandoned  AttemptStatus = "abandoned"
)

type LearnerOption struct {
	Index   int    `json:"index"`
	Text    string `json:"text"`
	AssetID string `json:"assetId"`
}
type LearnerQuestion struct {
	ID                     string          `json:"id"`
	Version                int             `json:"version"`
	SectionID              string          `json:"sectionId"`
	SortOrder              int             `json:"sortOrder"`
	Points                 float64         `json:"points"`
	Type                   string          `json:"type"`
	Text                   string          `json:"text"`
	ImageAssetID           string          `json:"imageAssetId"`
	ImageAlt               string          `json:"imageAlt"`
	OptionsEmbeddedInImage bool            `json:"optionsEmbeddedInImage"`
	VideoURL               string          `json:"videoUrl"`
	Difficulty             string          `json:"difficulty"`
	Options                []LearnerOption `json:"options"`
}
type SavedAnswer struct {
	QuestionID          string    `json:"questionId"`
	SelectedOptionIndex *int      `json:"selectedOptionIndex"`
	TextAnswer          string    `json:"textAnswer"`
	TimeSpentSeconds    int       `json:"timeSpentSeconds"`
	MarkedForReview     bool      `json:"markedForReview"`
	LastSavedAt         time.Time `json:"lastSavedAt"`
}
type Attempt struct {
	ID                      string            `json:"id"`
	AssessmentID            string            `json:"assessmentId"`
	AssessmentVersion       int               `json:"assessmentVersion"`
	StudentID               string            `json:"-"`
	AttemptNumber           int               `json:"attemptNumber"`
	Status                  AttemptStatus     `json:"status"`
	Title                   string            `json:"title"`
	StartedAt               time.Time         `json:"startedAt"`
	ExpiresAt               *time.Time        `json:"expiresAt"`
	SubmittedAt             *time.Time        `json:"submittedAt"`
	ShowProgressBar         bool              `json:"showProgressBar"`
	RequireAnswerBeforeNext bool              `json:"requireAnswerBeforeNext"`
	AllowQuestionReview     bool              `json:"allowQuestionReview"`
	RandomizeOptions        bool              `json:"randomizeOptions"`
	Questions               []LearnerQuestion `json:"questions"`
	Answers                 []SavedAnswer     `json:"answers"`
}
type Result struct {
	AttemptID        string    `json:"attemptId"`
	Score            float64   `json:"score"`
	TotalQuestions   int       `json:"totalQuestions"`
	CorrectAnswers   int       `json:"correctAnswers"`
	WrongAnswers     int       `json:"wrongAnswers"`
	Unanswered       int       `json:"unanswered"`
	Passed           bool      `json:"passed"`
	TimeSpentSeconds int       `json:"timeSpentSeconds"`
	FinalizedAt      time.Time `json:"finalizedAt"`
}
type AnswerWrite struct {
	SelectedOptionIndex *int   `json:"selectedOptionIndex"`
	TextAnswer          string `json:"textAnswer"`
	TimeSpentSeconds    int    `json:"timeSpentSeconds"`
	MarkedForReview     bool   `json:"markedForReview"`
}
