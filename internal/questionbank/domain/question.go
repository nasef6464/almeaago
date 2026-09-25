package domain

import (
	"encoding/json"
	"time"
)

type WorkflowStatus string

const (
	WorkflowDraft         WorkflowStatus = "draft"
	WorkflowPendingReview WorkflowStatus = "pending_review"
	WorkflowApproved      WorkflowStatus = "approved"
	WorkflowRejected      WorkflowStatus = "rejected"
	WorkflowArchived      WorkflowStatus = "archived"
)

func ValidWorkflowStatus(status WorkflowStatus) bool {
	switch status {
	case WorkflowDraft, WorkflowPendingReview, WorkflowApproved, WorkflowRejected, WorkflowArchived:
		return true
	default:
		return false
	}
}

type OwnerType string

const (
	OwnerPlatform OwnerType = "platform"
	OwnerTeacher  OwnerType = "teacher"
	OwnerSchool   OwnerType = "school"
)

type QuestionType string

const (
	QuestionMCQ       QuestionType = "mcq"
	QuestionTrueFalse QuestionType = "true_false"
	QuestionEssay     QuestionType = "essay"
)

func ValidQuestionType(value QuestionType) bool {
	switch value {
	case QuestionMCQ, QuestionTrueFalse, QuestionEssay:
		return true
	default:
		return false
	}
}

type RelationType string

const (
	RelationMain      RelationType = "main"
	RelationSub       RelationType = "sub"
	RelationSecondary RelationType = "secondary"
)

type Question struct {
	ID                     string
	QuestionCode           string
	CurrentVersion         int
	WorkflowStatus         WorkflowStatus
	OwnerType              OwnerType
	OwnerID                string
	PathID                 string
	SubjectID              string
	CreatedBy              string
	AssignedTeacherID      string
	ApprovedBy             string
	ApprovedAt             *time.Time
	ReviewerNotes          string
	RevenueSharePercentage *float64
	CreatedAt              time.Time
	UpdatedAt              time.Time
	Version                QuestionVersion
	Options                []Option
	SkillLinks             []SkillLink
}

type QuestionVersion struct {
	Version                int
	QuestionType           QuestionType
	TextContent            string
	ImageAssetID           string
	ImageAlt               string
	OptionsEmbeddedInImage bool
	CorrectOptionIndex     *int
	Explanation            string
	Hint                   string
	SolvingStrategy        string
	VideoURL               string
	SourceMeta             json.RawMessage
	AIContext              json.RawMessage
	VoiceExplanation       json.RawMessage
	Difficulty             string
	ExamType               string
	Source                 string
	SourceYear             *int
	CreatedBy              string
	RevisionNote           string
	CreatedAt              time.Time
}

type Option struct {
	Index   int
	Text    string
	AssetID string
}

type SkillLink struct {
	SkillID      string
	RelationType RelationType
}

type CreateCommand struct {
	QuestionCode      string
	PathID            string
	SubjectID         string
	OwnerType         OwnerType
	OwnerID           string
	AssignedTeacherID string
	Version           VersionCommand
	SkillLinks        []SkillLink
}

type VersionCommand struct {
	PathID                 string
	SubjectID              string
	QuestionType           QuestionType
	TextContent            string
	ImageAssetID           string
	ImageAlt               string
	OptionsEmbeddedInImage bool
	CorrectOptionIndex     *int
	Explanation            string
	Hint                   string
	SolvingStrategy        string
	VideoURL               string
	SourceMeta             json.RawMessage
	AIContext              json.RawMessage
	VoiceExplanation       json.RawMessage
	Difficulty             string
	ExamType               string
	Source                 string
	SourceYear             *int
	RevisionNote           string
	Options                []Option
	SkillLinks             []SkillLink
}
