package domain

import (
	"fmt"
	"time"
)

type SingleShotSubmissionRequest struct {
	Answers          map[string]int `json:"answers"`
	TimeSpentSeconds int            `json:"timeSpentSeconds"`
	Source           string         `json:"source"`
	SubmissionKey    string         `json:"submissionKey"`
}

type SingleShotQuizResultDTO struct {
	ID               string                    `json:"id"`
	AttemptID        string                    `json:"attemptId"`
	QuizID           string                    `json:"quizId"`
	QuizTitle        string                    `json:"quizTitle"`
	Score            float64                   `json:"score"`
	TotalQuestions   int                       `json:"totalQuestions"`
	CorrectAnswers   int                       `json:"correctAnswers"`
	WrongAnswers     int                       `json:"wrongAnswers"`
	Unanswered       int                       `json:"unanswered"`
	Passed           bool                      `json:"passed"`
	TimeSpentSeconds int                       `json:"timeSpentSeconds"`
	TimeSpent        string                    `json:"timeSpent"`
	Date             string                    `json:"date"`
	FinalizedAt      time.Time                 `json:"finalizedAt"`
	SkillsAnalysis   []ResultSkillAnalysisItem `json:"skillsAnalysis"`
	QuestionReview   []ReviewQuestion          `json:"questionReview"`
	Result           Result                    `json:"result"`
}

func FormatTimeSpent(seconds int) string {
	if seconds <= 0 {
		return "0 ثانية"
	}
	mins := seconds / 60
	secs := seconds % 60
	if mins > 0 && secs > 0 {
		return fmt.Sprintf("%d دقيقة و %d ثانية", mins, secs)
	}
	if mins > 0 {
		return fmt.Sprintf("%d دقيقة", mins)
	}
	return fmt.Sprintf("%d ثانية", secs)
}
