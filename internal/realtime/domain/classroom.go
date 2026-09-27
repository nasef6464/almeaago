package domain

import (
	"encoding/json"
	"errors"
	"time"
)

var (
	ErrNotFound = errors.New("classroom resource not found")
	ErrConflict = errors.New("classroom state conflict")
)

type SessionStatus string

const (
	SessionDraft     SessionStatus = "draft"
	SessionScheduled SessionStatus = "scheduled"
	SessionLive      SessionStatus = "live"
	SessionEnded     SessionStatus = "ended"
	SessionArchived  SessionStatus = "archived"
)

type PublishedMode string

const (
	PublishedSingle PublishedMode = "single"
	PublishedBatch  PublishedMode = "batch"
)

type AttendanceStatus string

const (
	AttendancePresent AttendanceStatus = "present"
	AttendanceLate    AttendanceStatus = "late"
	AttendanceAbsent  AttendanceStatus = "absent"
	AttendanceExcused AttendanceStatus = "excused"
)

func ValidAttendanceStatus(status AttendanceStatus) bool {
	return status == AttendancePresent || status == AttendanceLate || status == AttendanceAbsent || status == AttendanceExcused
}

type Session struct {
	ID                    string
	SchoolID              string
	ClassID               string
	SubjectID             string
	TeacherID             string
	Status                SessionStatus
	Day                   string
	Period                *int
	PublishedMode         PublishedMode
	ActiveBatchID         string
	ActiveQuestionOrdinal *int
	PINExpiresAt          time.Time
	Revision              int
	StartedAt             *time.Time
	EndedAt               *time.Time
	CreatedAt             time.Time
	UpdatedAt             time.Time
}

type PinnedQuestion struct {
	Ordinal         int
	BatchID         string
	QuestionID      string
	QuestionVersion int
	PublishedAt     *time.Time
	RevealedAt      *time.Time
}

type Batch struct {
	ID          string
	SessionID   string
	BatchNumber int
	Label       string
	StartedAt   *time.Time
	EndedAt     *time.Time
	CreatedAt   time.Time
	Questions   []PinnedQuestion
}

type Participant struct {
	SessionID              string
	StudentID              string
	JoinedAt               time.Time
	AttendanceStatus       AttendanceStatus
	AttendanceOverriddenBy string
	AttendanceOverriddenAt *time.Time
}

type Response struct {
	SessionID           string
	QuestionOrdinal     int
	StudentID           string
	SelectedOptionIndex int
	IsCorrect           bool
	SubmittedAt         time.Time
	UpdatedAt           time.Time
}

type QuestionAggregate struct {
	Ordinal      int
	QuestionID   string
	ResponseCount int
	CorrectCount int
	Distribution map[string]int
}

type Aggregate struct {
	SessionID             string
	Status                SessionStatus
	ActiveBatchID         string
	ActiveQuestionOrdinal *int
	JoinedCount           int
	Questions             []QuestionAggregate
}

type StudentQuestion struct {
	Ordinal                int
	QuestionID             string
	QuestionVersion        int
	Text                   string
	ImageAssetID           string
	ImageAlt               string
	OptionsEmbeddedInImage bool
	Options                []StudentOption
	Difficulty             string
	Revealed               bool
	CorrectOptionIndex     *int
	Explanation            string
	SelectedOptionIndex    *int
}

type StudentOption struct {
	Index   int
	Text    string
	AssetID string
}

type StudentState struct {
	SessionID             string
	Status                SessionStatus
	PublishedMode         PublishedMode
	ActiveBatchID         string
	ActiveQuestionOrdinal *int
	Questions             []StudentQuestion
}

type CreateRecord struct {
	ActorUserID   string
	SchoolID      string
	ClassID       string
	SubjectID     string
	TeacherID     string
	Day           string
	Period        *int
	PublishedMode PublishedMode
	PINHash       string
	PINExpiresAt  time.Time
	Questions     []QuestionRef
}

type QuestionRef struct {
	ID      string
	Version int
}

type AppendBatchRecord struct {
	ActorUserID string
	SessionID   string
	Label       string
	Questions   []QuestionRef
}

type ReportSnapshot struct {
	SessionID   string
	Snapshot    json.RawMessage
	FinalizedAt time.Time
}

type StreamEvent struct {
	Type      string
	SessionID string
	At        time.Time
	Data      any
}
