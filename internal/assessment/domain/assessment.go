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
	ErrInvalidAnswer     = errors.New("invalid assessment answer")
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
	ID                string              `json:"id"`
	Code              string              `json:"code"`
	OwnerType         OwnerType           `json:"ownerType"`
	OwnerUserID       string              `json:"ownerUserId"`
	OwnerSchoolID     string              `json:"ownerSchoolId"`
	AssignedTeacherID string              `json:"assignedTeacherId"`
	WorkflowStatus    WorkflowStatus      `json:"workflowStatus"`
	ReviewerNotes     string              `json:"reviewerNotes"`
	CurrentVersion    int                 `json:"currentVersion"`
	PublishedVersion  *int                `json:"publishedVersion"`
	IsPublished       bool                `json:"isPublished"`
	IsVisible         bool                `json:"isVisible"`
	Revision          int                 `json:"revision"`
	CreatedAt         time.Time           `json:"createdAt"`
	UpdatedAt         time.Time           `json:"updatedAt"`
	Version           Version             `json:"version"`
	Sections          []Section           `json:"sections"`
	Questions         []QuestionPlacement `json:"questions"`
}

type Version struct {
	Version                 int             `json:"version"`
	AccessType              AccessType      `json:"accessType"`
	Title                   string          `json:"title"`
	Description             string          `json:"description"`
	PathID                  string          `json:"pathId"`
	SubjectID               string          `json:"subjectId"`
	Kind                    Kind            `json:"kind"`
	NormalMode              NormalMode      `json:"normalMode"`
	ShowExplanations        bool            `json:"showExplanations"`
	ShowAnswers             bool            `json:"showAnswers"`
	ShowResultsReport       bool            `json:"showResultsReport"`
	ReturnToSourceOnFinish  bool            `json:"returnToSourceOnFinish"`
	MaxAttempts             int             `json:"maxAttempts"`
	PassingScore            float64         `json:"passingScore"`
	TimeLimitSeconds        *int            `json:"timeLimitSeconds"`
	RandomizeQuestions      bool            `json:"randomizeQuestions"`
	RandomizeOptions        bool            `json:"randomizeOptions"`
	ShowProgressBar         bool            `json:"showProgressBar"`
	RequireAnswerBeforeNext bool            `json:"requireAnswerBeforeNext"`
	AllowQuestionReview     bool            `json:"allowQuestionReview"`
	OptionLayout            string          `json:"optionLayout"`
	MockCategory            string          `json:"mockCategory"`
	MockTargetScore         *float64        `json:"mockTargetScore"`
	MockStrictSectionLock   *bool           `json:"mockStrictSectionLock"`
	MockPresentationMode    string          `json:"mockPresentationMode"`
	Presentation            json.RawMessage `json:"presentation"`
	RevisionNote            string          `json:"revisionNote"`
}

type Section struct {
	ID               string `json:"id"`
	Title            string `json:"title"`
	SubjectID        string `json:"subjectId"`
	SortOrder        int    `json:"sortOrder"`
	TimeLimitSeconds *int   `json:"timeLimitSeconds"`
	Domain           string `json:"domain"`
	StrictLock       bool   `json:"strictLock"`
}

type QuestionPlacement struct {
	QuestionID      string  `json:"questionId"`
	QuestionVersion int     `json:"questionVersion"`
	SectionID       string  `json:"sectionId"`
	SortOrder       int     `json:"sortOrder"`
	Points          float64 `json:"points"`
}

type Write struct {
	Code              string              `json:"code"`
	OwnerType         OwnerType           `json:"ownerType"`
	OwnerUserID       string              `json:"ownerUserId"`
	OwnerSchoolID     string              `json:"ownerSchoolId"`
	AssignedTeacherID string              `json:"assignedTeacherId"`
	IsVisible         bool                `json:"isVisible"`
	Version           Version             `json:"version"`
	Sections          []Section           `json:"sections"`
	Questions         []QuestionPlacement `json:"questions"`
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
	ID             string         `json:"id"`
	Code           string         `json:"code"`
	Title          string         `json:"title"`
	PathID         string         `json:"pathId"`
	SubjectID      string         `json:"subjectId"`
	Kind           Kind           `json:"kind"`
	WorkflowStatus WorkflowStatus `json:"workflowStatus"`
	OwnerType      OwnerType      `json:"ownerType"`
	Revision       int            `json:"revision"`
	CurrentVersion int            `json:"currentVersion"`
	IsPublished    bool           `json:"isPublished"`
	UpdatedAt      time.Time      `json:"updatedAt"`
}

type Page struct {
	Items   []Summary `json:"items"`
	Page    int       `json:"page"`
	Limit   int       `json:"limit"`
	HasMore bool      `json:"hasMore"`
}
