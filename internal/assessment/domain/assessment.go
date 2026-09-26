package domain

import (
	"encoding/json"
	"errors"
	"time"
)

var (
	ErrNotFound          = errors.New("assessment not found")
	ErrConflict          = errors.New("assessment conflict")
	ErrVersionConflict   = errors.New("assessment revision conflict")
	ErrAttemptExpired    = errors.New("assessment attempt expired")
	ErrAttemptSubmitted  = errors.New("assessment attempt submitted")
	ErrResultUnavailable = errors.New("assessment result unavailable")
)

type WorkflowStatus string

const (
	WorkflowDraft         WorkflowStatus = "draft"
	WorkflowPendingReview WorkflowStatus = "pending_review"
	WorkflowApproved      WorkflowStatus = "approved"
	WorkflowRejected      WorkflowStatus = "rejected"
	WorkflowArchived      WorkflowStatus = "archived"
)

func ValidWorkflowStatus(v WorkflowStatus) bool {
	switch v {
	case WorkflowDraft, WorkflowPendingReview, WorkflowApproved, WorkflowRejected, WorkflowArchived:
		return true
	}
	return false
}

type OwnerType string

const (
	OwnerPlatform OwnerType = "platform"
	OwnerTeacher  OwnerType = "teacher"
	OwnerSchool   OwnerType = "school"
)

func ValidOwnerType(v OwnerType) bool {
	return v == OwnerPlatform || v == OwnerTeacher || v == OwnerSchool
}

type Kind string

const (
	KindNormal Kind = "normal"
	KindMock   Kind = "mock"
)

type NormalMode string

const (
	ModePractice NormalMode = "practice"
	ModeExam     NormalMode = "exam"
)

type Assessment struct {
	ID                string
	Code              string
	OwnerType         OwnerType
	OwnerUserID       string
	OwnerSchoolID     string
	AssignedTeacherID string
	WorkflowStatus    WorkflowStatus
	ReviewerNotes     string
	CurrentVersion    int
	PublishedVersion  *int
	IsPublished       bool
	IsVisible         bool
	Revision          int
	CreatedAt         time.Time
	UpdatedAt         time.Time
	Version           Version
	Sections          []Section
	Questions         []QuestionPlacement
}

type Version struct {
	Version                 int
	AccessType              AccessType
	Title                   string
	Description             string
	PathID                  string
	SubjectID               string
	Kind                    Kind
	NormalMode              NormalMode
	ShowExplanations        bool
	ShowAnswers             bool
	ShowResultsReport       bool
	ReturnToSourceOnFinish  bool
	MaxAttempts             int
	PassingScore            float64
	TimeLimitSeconds        *int
	RandomizeQuestions      bool
	RandomizeOptions        bool
	ShowProgressBar         bool
	RequireAnswerBeforeNext bool
	AllowQuestionReview     bool
	OptionLayout            string
	MockCategory            string
	MockTargetScore         *float64
	MockStrictSectionLock   *bool
	MockPresentationMode    string
	Presentation            json.RawMessage
	RevisionNote            string
}

type Section struct {
	ID               string
	Title            string
	SubjectID        string
	SortOrder        int
	TimeLimitSeconds *int
	Domain           string
	StrictLock       bool
}

type QuestionPlacement struct {
	QuestionID      string
	QuestionVersion int
	SectionID       string
	SortOrder       int
	Points          float64
}

type Write struct {
	Code              string
	OwnerType         OwnerType
	OwnerUserID       string
	OwnerSchoolID     string
	AssignedTeacherID string
	IsVisible         bool
	Version           Version
	Sections          []Section
	Questions         []QuestionPlacement
}

type ListQuery struct {
	Page               int
	Limit              int
	PathID             string
	SubjectID          string
	WorkflowStatus     WorkflowStatus
	Search             string
	TeacherScopeUserID string
}

type Summary struct {
	ID             string
	Code           string
	Title          string
	PathID         string
	SubjectID      string
	Kind           Kind
	WorkflowStatus WorkflowStatus
	OwnerType      OwnerType
	Revision       int
	CurrentVersion int
	IsPublished    bool
	UpdatedAt      time.Time
}

type Page struct {
	Items   []Summary
	Page    int
	Limit   int
	HasMore bool
}
