package domain

import "time"

type ParentResultSummary struct {
	AttemptID          string    `json:"attemptId"`
	AssessmentID       string    `json:"assessmentId"`
	AssessmentVersion  int       `json:"assessmentVersion"`
	Title               string    `json:"title"`
	AttemptNumber       int       `json:"attemptNumber"`
	Score               float64   `json:"score"`
	TotalQuestions      int       `json:"totalQuestions"`
	CorrectAnswers      int       `json:"correctAnswers"`
	WrongAnswers        int       `json:"wrongAnswers"`
	Unanswered          int       `json:"unanswered"`
	Passed              bool      `json:"passed"`
	TimeSpentSeconds    int       `json:"timeSpentSeconds"`
	FinalizedAt         time.Time `json:"finalizedAt"`
}

type ParentStudentAssessmentSnapshot struct {
	StudentID              string
	WeeklyAssessmentCount  int
	WeeklyAverageScore     float64
	WeeklyStudySeconds     int
	RecentResults          []ParentResultSummary
}

type ParentResultPage struct {
	Items   []ParentResultSummary `json:"items"`
	Page    int                   `json:"page"`
	Limit   int                   `json:"limit"`
	HasMore bool                  `json:"hasMore"`
}
