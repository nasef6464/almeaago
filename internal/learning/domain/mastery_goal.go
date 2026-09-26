package domain

import "time"

type GoalTargetType string
type GoalHorizon string
type GoalStatus string

const (
	GoalTargetTopic   GoalTargetType = "topic"
	GoalTargetSection GoalTargetType = "section"
	GoalTargetPath    GoalTargetType = "path"

	GoalHorizonShort GoalHorizon = "short"
	GoalHorizonLong  GoalHorizon = "long"

	GoalStatusActive   GoalStatus = "active"
	GoalStatusAchieved GoalStatus = "achieved"
	GoalStatusArchived GoalStatus = "archived"
)

func ValidGoalTargetType(v GoalTargetType) bool {
	return v == GoalTargetTopic || v == GoalTargetSection || v == GoalTargetPath
}

func ValidGoalHorizon(v GoalHorizon) bool {
	return v == GoalHorizonShort || v == GoalHorizonLong
}

func ValidGoalStatus(v GoalStatus) bool {
	return v == GoalStatusActive || v == GoalStatusAchieved || v == GoalStatusArchived
}

type MasteryGoal struct {
	ID              string         `json:"id"`
	StudentID       string         `json:"studentId"`
	CreatedByUserID string         `json:"createdByUserId"`
	CreatedByRole   string         `json:"createdByRole"`
	PathID          string         `json:"pathId"`
	SubjectID       string         `json:"subjectId"`
	TargetType      GoalTargetType `json:"targetType"`
	TargetID        string         `json:"targetId"`
	Title           string         `json:"title"`
	TargetMastery   int            `json:"targetMastery"`
	Horizon         GoalHorizon    `json:"horizon"`
	DueDate         string         `json:"dueDate"`
	Status          GoalStatus     `json:"status"`
	CreatedAt       time.Time      `json:"createdAt"`
	UpdatedAt       time.Time      `json:"updatedAt"`
}

type MasteryGoalWrite struct {
	PathID        string         `json:"pathId"`
	SubjectID     string         `json:"subjectId"`
	TargetType    GoalTargetType `json:"targetType"`
	TargetID      string         `json:"targetId"`
	Title         string         `json:"title"`
	TargetMastery int            `json:"targetMastery"`
	Horizon       GoalHorizon    `json:"horizon"`
	DueDate       string         `json:"dueDate"`
}

type MasteryGoalPatch struct {
	ExpectedUpdatedAt time.Time   `json:"expectedUpdatedAt"`
	Title             *string     `json:"title"`
	TargetMastery     *int        `json:"targetMastery"`
	DueDate           *string     `json:"dueDate"`
	Status            *GoalStatus `json:"status"`
}

type MasteryGoalPage struct {
	Items   []MasteryGoal `json:"items"`
	Page    int           `json:"page"`
	Limit   int           `json:"limit"`
	HasMore bool          `json:"hasMore"`
}
