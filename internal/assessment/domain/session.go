package domain

import "time"

type SessionChannel string
type SessionStatus string

const (
	SessionPublic  SessionChannel = "public"
	SessionBarcode SessionChannel = "barcode"
	SessionLive    SessionChannel = "live"

	SessionScheduled SessionStatus = "scheduled"
	SessionActive    SessionStatus = "active"
	SessionClosed    SessionStatus = "closed"
	SessionCancelled SessionStatus = "cancelled"
)

func ValidSessionChannel(v SessionChannel) bool {
	return v == SessionPublic || v == SessionBarcode || v == SessionLive
}

func ValidSessionStatus(v SessionStatus) bool {
	return v == SessionScheduled || v == SessionActive || v == SessionClosed || v == SessionCancelled
}

type Session struct {
	ID                string         `json:"id"`
	AssessmentID      string         `json:"assessmentId"`
	AssessmentVersion int            `json:"assessmentVersion"`
	Title             string         `json:"title"`
	Channel           SessionChannel `json:"channel"`
	SessionCode       string         `json:"sessionCode"`
	Status            SessionStatus  `json:"status"`
	SchoolID          string         `json:"schoolId"`
	ClassID           string         `json:"classId"`
	OpensAt           *time.Time     `json:"opensAt"`
	ClosesAt          *time.Time     `json:"closesAt"`
	MaxSubmissions    *int           `json:"maxSubmissions"`
	CreatedAt         time.Time      `json:"createdAt"`
	UpdatedAt         time.Time      `json:"updatedAt"`
}

type SessionWrite struct {
	AssessmentID   string         `json:"assessmentId"`
	Channel        SessionChannel `json:"channel"`
	SchoolID       string         `json:"schoolId"`
	ClassID        string         `json:"classId"`
	OpensAt        *time.Time     `json:"opensAt"`
	ClosesAt       *time.Time     `json:"closesAt"`
	MaxSubmissions *int           `json:"maxSubmissions"`
}

type SessionPage struct {
	Items   []Session `json:"items"`
	Page    int       `json:"page"`
	Limit   int       `json:"limit"`
	HasMore bool      `json:"hasMore"`
}

type PublicAttempt struct {
	ID                      string            `json:"id"`
	SessionID               string            `json:"sessionId"`
	SessionCode             string            `json:"sessionCode"`
	AssessmentID            string            `json:"assessmentId"`
	AssessmentVersion       int               `json:"assessmentVersion"`
	Title                   string            `json:"title"`
	AttemptNumber           int               `json:"attemptNumber"`
	Status                  AttemptStatus     `json:"status"`
	StartedAt               time.Time         `json:"startedAt"`
	ExpiresAt               *time.Time        `json:"expiresAt"`
	ShowProgressBar         bool              `json:"showProgressBar"`
	RequireAnswerBeforeNext bool              `json:"requireAnswerBeforeNext"`
	OptionLayout            string            `json:"optionLayout"`
	Questions               []LearnerQuestion `json:"questions"`
}

type PublicStartInput struct {
	ParticipantKey string `json:"participantKey"`
	StartKey       string `json:"startKey"`
}

type PublicAnswerWrite struct {
	QuestionID          string `json:"questionId"`
	SelectedOptionIndex *int   `json:"selectedOptionIndex"`
}

type PublicSubmitInput struct {
	ParticipantKey   string              `json:"participantKey"`
	PublicAttemptID  string              `json:"publicAttemptId"`
	SubmissionKey    string              `json:"submissionKey"`
	ParticipantName  string              `json:"participantName"`
	SchoolName       string              `json:"schoolName"`
	ClassroomName    string              `json:"classroomName"`
	Contact          string              `json:"contact"`
	TimeSpentSeconds int                 `json:"timeSpentSeconds"`
	Answers          []PublicAnswerWrite `json:"answers"`
}

type PublicSubmission struct {
	ResultVisible bool    `json:"resultVisible"`
	Result        *Result `json:"result,omitempty"`
}

type LiveJoin struct {
	SessionID         string     `json:"sessionId"`
	AssessmentID      string     `json:"assessmentId"`
	AssessmentVersion int        `json:"assessmentVersion"`
	Title             string     `json:"title"`
	SessionCode       string     `json:"sessionCode"`
	OpensAt           *time.Time `json:"opensAt"`
	ClosesAt          *time.Time `json:"closesAt"`
	AttemptCount      int        `json:"attemptCount"`
	MaxAttempts       int        `json:"maxAttempts"`
	CanStart          bool       `json:"canStart"`
}
