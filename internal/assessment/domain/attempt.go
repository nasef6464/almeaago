package domain

import (
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
	"time"
)

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
	ID                     string                        `json:"id"`
	Version                int                           `json:"version"`
	SectionID              string                        `json:"sectionId"`
	SortOrder              int                           `json:"sortOrder"`
	Points                 float64                       `json:"points"`
	Type                   string                        `json:"type"`
	Text                   string                        `json:"text"`
	ImageAssetID           string                        `json:"imageAssetId"`
	ImageURL               string                        `json:"imageUrl,omitempty"`
	ImageAlt               string                        `json:"imageAlt"`
	OptionsEmbeddedInImage bool                          `json:"optionsEmbeddedInImage"`
	LearnerPresentation    *question.LearnerPresentation `json:"learnerPresentation,omitempty"`
	VideoURL               string                        `json:"videoUrl"`
	Passage                string                        `json:"passage,omitempty"`
	Difficulty             string                        `json:"difficulty"`
	Options                []LearnerOption               `json:"options"`
}
type SavedAnswer struct {
	QuestionID          string    `json:"questionId"`
	SelectedOptionIndex *int      `json:"selectedOptionIndex"`
	TextAnswer          string    `json:"textAnswer"`
	TimeSpentSeconds    int       `json:"timeSpentSeconds"`
	MarkedForReview     bool      `json:"markedForReview"`
	LastSavedAt         time.Time `json:"lastSavedAt"`
}

// SectionProgress is authoritative server state for a strict mock attempt.
type SectionProgress struct {
	CurrentSectionID string     `json:"currentSectionId"`
	StartedAt        time.Time  `json:"startedAt"`
	Deadline         *time.Time `json:"deadline,omitempty"`
	ServerTime       time.Time  `json:"serverTime"`
	Finished         bool       `json:"finished"`
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
	ServerTime              *time.Time        `json:"serverTime,omitempty"`
	SubmittedAt             *time.Time        `json:"submittedAt"`
	ShowProgressBar         bool              `json:"showProgressBar"`
	RequireAnswerBeforeNext bool              `json:"requireAnswerBeforeNext"`
	AllowQuestionReview     bool              `json:"allowQuestionReview"`
	ShowResultsReport       bool              `json:"showResultsReport"`
	RandomizeOptions        bool              `json:"randomizeOptions"`
	Kind                    Kind              `json:"kind"`
	MockPresentationMode    string            `json:"mockPresentationMode,omitempty"`
	MockStrictSectionLock   *bool             `json:"mockStrictSectionLock,omitempty"`
	Sections                []Section         `json:"sections"`
	SectionProgress         *SectionProgress  `json:"sectionProgress,omitempty"`
	TotalQuestions          int               `json:"totalQuestions"`
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
