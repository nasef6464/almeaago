package domain

import "time"

type AssignmentStatus string

const (
	AssignmentActive    AssignmentStatus = "active"
	AssignmentClosed    AssignmentStatus = "closed"
	AssignmentCancelled AssignmentStatus = "cancelled"
)

type Assignment struct {
	ID                  string           `json:"id"`
	AssessmentID        string           `json:"assessmentId"`
	AssessmentVersion   int              `json:"assessmentVersion"`
	SchoolID            string           `json:"schoolId"`
	Status              AssignmentStatus `json:"status"`
	OpensAt             *time.Time       `json:"opensAt"`
	ClosesAt            *time.Time       `json:"closesAt"`
	MaxAttemptsOverride *int             `json:"maxAttemptsOverride"`
	SupervisorMessage   string           `json:"supervisorMessage"`
	UserIDs             []string         `json:"userIds"`
	ClassIDs            []string         `json:"classIds"`
	CreatedAt           time.Time        `json:"createdAt"`
	UpdatedAt           time.Time        `json:"updatedAt"`
}
type AssignmentWrite struct {
	SchoolID            string     `json:"schoolId"`
	OpensAt             *time.Time `json:"opensAt"`
	ClosesAt            *time.Time `json:"closesAt"`
	MaxAttemptsOverride *int       `json:"maxAttemptsOverride"`
	SupervisorMessage   string     `json:"supervisorMessage"`
	UserIDs             []string   `json:"userIds"`
	ClassIDs            []string   `json:"classIds"`
}
type AssignmentPage struct {
	Items   []Assignment `json:"items"`
	Page    int          `json:"page"`
	Limit   int          `json:"limit"`
	HasMore bool         `json:"hasMore"`
}
type LearnerAssignment struct {
	AssignmentID      string     `json:"assignmentId"`
	AssessmentID      string     `json:"assessmentId"`
	AssessmentVersion int        `json:"assessmentVersion"`
	Title             string     `json:"title"`
	SchoolID          string     `json:"schoolId"`
	OpensAt           *time.Time `json:"opensAt"`
	ClosesAt          *time.Time `json:"closesAt"`
	SupervisorMessage string     `json:"supervisorMessage"`
	AttemptCount      int        `json:"attemptCount"`
	MaxAttempts       int        `json:"maxAttempts"`
	CanStart          bool       `json:"canStart"`
}
