package domain

import "time"

type ResultListItem struct {
	AttemptID         string    `json:"attemptId"`
	AssessmentID      string    `json:"assessmentId"`
	AssessmentVersion int       `json:"assessmentVersion"`
	Title             string    `json:"title"`
	AttemptNumber     int       `json:"attemptNumber"`
	Score             float64   `json:"score"`
	TotalQuestions    int       `json:"totalQuestions"`
	CorrectAnswers    int       `json:"correctAnswers"`
	WrongAnswers      int       `json:"wrongAnswers"`
	Unanswered        int       `json:"unanswered"`
	Passed            bool      `json:"passed"`
	TimeSpentSeconds  int       `json:"timeSpentSeconds"`
	FinalizedAt       time.Time `json:"finalizedAt"`
}

// ResultPage is a bounded learner-owned history page.
type ResultPage struct {
	Items   []ResultListItem `json:"items"`
	Page    int              `json:"page"`
	Limit   int              `json:"limit"`
	HasMore bool             `json:"hasMore"`
}

type ReviewQuestion struct {
	QuestionID             string          `json:"questionId"`
	QuestionVersion        int             `json:"questionVersion"`
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
	SelectedOptionIndex    *int            `json:"selectedOptionIndex"`
	CorrectOptionIndex     *int            `json:"correctOptionIndex,omitempty"`
	Answered               bool            `json:"answered"`
	Correct                bool            `json:"correct"`
	MarkedForReview        bool            `json:"markedForReview"`
	TimeSpentSeconds       int             `json:"timeSpentSeconds"`
	Explanation            string          `json:"explanation,omitempty"`
	Hint                   string          `json:"hint,omitempty"`
	SolvingStrategy        string          `json:"solvingStrategy,omitempty"`
}

type ResultDetail struct {
	Result              Result           `json:"result"`
	AssessmentID        string           `json:"assessmentId"`
	AssessmentVersion   int              `json:"assessmentVersion"`
	Title               string           `json:"title"`
	AttemptNumber       int              `json:"attemptNumber"`
	AllowQuestionReview bool             `json:"allowQuestionReview"`
	ShowAnswers         bool             `json:"showAnswers"`
	ShowExplanations    bool             `json:"showExplanations"`
	ShowResultsReport   bool             `json:"showResultsReport"`
	Questions           []ReviewQuestion `json:"questions,omitempty"`
}
