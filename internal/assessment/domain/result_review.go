package domain

import (
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
	"time"
)

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
	ShowResultsReport bool      `json:"showResultsReport"`
}

// ResultPage is a bounded learner-owned history page.
type ResultPage struct {
	Items   []ResultListItem `json:"items"`
	Page    int              `json:"page"`
	Limit   int              `json:"limit"`
	HasMore bool             `json:"hasMore"`
}

type ReviewQuestion struct {
	QuestionID             string                        `json:"questionId"`
	QuestionVersion        int                           `json:"questionVersion"`
	SectionID              string                        `json:"sectionId"`
	SortOrder              int                           `json:"sortOrder"`
	Points                 float64                       `json:"points"`
	Type                   string                        `json:"type"`
	Text                   string                        `json:"text"`
	ImageAssetID           string                        `json:"imageAssetId"`
	ImageAlt               string                        `json:"imageAlt"`
	OptionsEmbeddedInImage bool                          `json:"optionsEmbeddedInImage"`
	LearnerPresentation    *question.LearnerPresentation `json:"learnerPresentation,omitempty"`
	VideoURL               string                        `json:"videoUrl"`
	Passage                string                        `json:"passage,omitempty"`
	Difficulty             string                        `json:"difficulty"`
	Options                []LearnerOption               `json:"options"`
	SelectedOptionIndex    *int                          `json:"selectedOptionIndex"`
	CorrectOptionIndex     *int                          `json:"correctOptionIndex,omitempty"`
	Answered               bool                          `json:"answered"`
	Correct                bool                          `json:"correct"`
	MarkedForReview        bool                          `json:"markedForReview"`
	TimeSpentSeconds       int                           `json:"timeSpentSeconds"`
	Explanation            string                        `json:"explanation,omitempty"`
	Hint                   string                        `json:"hint,omitempty"`
	SolvingStrategy        string                        `json:"solvingStrategy,omitempty"`
}

type ResultDetail struct {
	Result              Result               `json:"result"`
	AssessmentID        string               `json:"assessmentId"`
	AssessmentVersion   int                  `json:"assessmentVersion"`
	Title               string               `json:"title"`
	AttemptNumber       int                  `json:"attemptNumber"`
	AllowQuestionReview bool                 `json:"allowQuestionReview"`
	ShowAnswers         bool                 `json:"showAnswers"`
	ShowExplanations    bool                 `json:"showExplanations"`
	ShowResultsReport   bool                 `json:"showResultsReport"`
	SkillAnalysis       *ResultSkillAnalysis `json:"skillAnalysis,omitempty"`
	Questions           []ReviewQuestion     `json:"questions,omitempty"`
}

// ResultSkillAnalysis describes only this submitted attempt, not cumulative mastery.
type ResultSkillAnalysis struct {
	Complete bool                      `json:"complete"`
	Items    []ResultSkillAnalysisItem `json:"items"`
}

type ResultSkillAnalysisItem struct {
	PathID           string                  `json:"pathId"`
	SubjectID        string                  `json:"subjectId"`
	SubjectName      string                  `json:"subjectName"`
	SkillID          string                  `json:"skillId"`
	SkillName        string                  `json:"skillName"`
	QuestionCount    int                     `json:"questionCount"`
	CorrectCount     int                     `json:"correctCount"`
	Mastery          int                     `json:"mastery"`
	Status           string                  `json:"status"`
	FoundationTopics []ResultFoundationTopic `json:"foundationTopics"`
}

// Topic metadata identifies a destination; it does not grant access to lessons or assessments.
type ResultFoundationTopic struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	IsLocked bool   `json:"isLocked"`
}
