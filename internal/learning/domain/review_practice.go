package domain

import "time"

type ReviewPracticeQuestion struct {
	ID                     string                 `json:"id"`
	Version                int                    `json:"version"`
	Type                   string                 `json:"type"`
	Text                   string                 `json:"text"`
	ImageAssetID           string                 `json:"imageAssetId"`
	ImageAlt               string                 `json:"imageAlt"`
	OptionsEmbeddedInImage bool                   `json:"optionsEmbeddedInImage"`
	VideoURL               string                 `json:"videoUrl"`
	Difficulty             string                 `json:"difficulty"`
	Options                []ReviewQuestionOption `json:"options"`
}

type ReviewPracticeItem struct {
	Card     ReviewCard             `json:"card"`
	Question ReviewPracticeQuestion `json:"question"`
}

type ReviewPracticePage struct {
	Items   []ReviewPracticeItem `json:"items"`
	Page    int                  `json:"page"`
	Limit   int                  `json:"limit"`
	HasMore bool                 `json:"hasMore"`
}

type ReviewAnswerWrite struct {
	SubmissionKey       string    `json:"submissionKey"`
	ExpectedCardUpdated time.Time `json:"expectedUpdatedAt"`
	SelectedOptionIndex int       `json:"selectedOptionIndex"`
}

type ReviewAnswerEvent struct {
	StudentID           string
	CardID              string
	QuestionID          string
	QuestionVersion     int
	ExpectedCardUpdated time.Time
	SelectedOptionIndex int
	Correct             bool
	EvidenceType        EvidenceType
	Quality             int
	OccurredAt          time.Time
	SubmissionKey       string
}

type ReviewSubmission struct {
	ID                  string
	StudentID           string
	CardID              string
	QuestionID          string
	QuestionVersion     int
	SelectedOptionIndex int
	Correct             bool
	EvidenceType        EvidenceType
	Quality             int
	ReviewTypeAfter     string
	NextReviewAt        time.Time
	SubmittedAt         time.Time
}

type ReviewAnswerResult struct {
	SubmissionID        string       `json:"submissionId"`
	CardID              string       `json:"cardId"`
	QuestionID          string       `json:"questionId"`
	QuestionVersion     int          `json:"questionVersion"`
	SelectedOptionIndex int          `json:"selectedOptionIndex"`
	Correct             bool         `json:"correct"`
	EvidenceType        EvidenceType `json:"evidenceType"`
	Quality             int          `json:"quality"`
	CorrectOptionIndex  *int         `json:"correctOptionIndex"`
	Explanation         string       `json:"explanation"`
	Hint                string       `json:"hint"`
	SolvingStrategy     string       `json:"solvingStrategy"`
	ReviewTypeAfter     string       `json:"reviewTypeAfter"`
	NextReviewAt        time.Time    `json:"nextReviewAt"`
}
