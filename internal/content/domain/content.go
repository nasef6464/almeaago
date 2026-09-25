package domain

import (
	"encoding/json"
	"time"
)

type WorkflowStatus string

const (
	WorkflowDraft WorkflowStatus = "draft"
	WorkflowPendingReview WorkflowStatus = "pending_review"
	WorkflowApproved WorkflowStatus = "approved"
	WorkflowRejected WorkflowStatus = "rejected"
	WorkflowArchived WorkflowStatus = "archived"
)

func ValidWorkflowStatus(value WorkflowStatus) bool {
	switch value {
	case WorkflowDraft, WorkflowPendingReview, WorkflowApproved, WorkflowRejected, WorkflowArchived:
		return true
	default:
		return false
	}
}

type OwnerType string

const (
	OwnerPlatform OwnerType = "platform"
	OwnerTeacher OwnerType = "teacher"
	OwnerSchool OwnerType = "school"
)

type StaffScope string

const (
	ScopeAdmin StaffScope = "admin"
	ScopeTeacher StaffScope = "teacher"
	ScopeSchoolAdmin StaffScope = "school_admin"
)

type SkillLink struct {
	SkillID string
	RelationType string
}

type AssetLink struct {
	AssetID string
	Purpose string
	Title string
	SortOrder int
}

type Ownership struct {
	OwnerType OwnerType
	OwnerUserID string
	OwnerSchoolID string
	CreatedBy string
	AssignedTeacherID string
	WorkflowStatus WorkflowStatus
	ApprovedBy string
	ApprovedAt *time.Time
	ReviewerNotes string
	RevenueShare *float64
	Revision int
	CreatedAt time.Time
	UpdatedAt time.Time
}

type Course struct {
	ID string
	PathID string
	SubjectID string
	Title string
	Description string
	InstructorName string
	DurationMinutes int
	Level string
	Ownership Ownership
	IsVisible bool
	DripContentEnabled bool
	CertificateEnabled bool
	ThumbnailAssetID string
	Presentation json.RawMessage
	SkillLinks []SkillLink
}

type CourseCommand struct {
	PathID string
	SubjectID string
	Title string
	Description string
	InstructorName string
	DurationMinutes int
	Level string
	OwnerType OwnerType
	OwnerUserID string
	OwnerSchoolID string
	AssignedTeacherID string
	IsVisible bool
	DripContentEnabled bool
	CertificateEnabled bool
	ThumbnailAssetID string
	Presentation json.RawMessage
	SkillLinks []SkillLink
}

type CoursePage struct {
	Items []Course
	Page int
	Limit int
	HasMore bool
}

type CourseModule struct {
	ID string
	CourseID string
	Title string
	Description string
	SortOrder int
	Status string
	CreatedAt time.Time
	UpdatedAt time.Time
}

type Lesson struct {
	ID string
	PathID string
	SubjectID string
	Title string
	Description string
	LessonType string
	ContentText string
	DurationSeconds int
	VideoURL string
	VideoSource string
	MeetingURL string
	MeetingAt *time.Time
	RecordingURL string
	JoinInstructions string
	ShowRecording bool
	Ownership Ownership
	IsVisible bool
	IsLocked bool
	SkillLinks []SkillLink
	Assets []AssetLink
}

type LessonCommand struct {
	PathID string
	SubjectID string
	Title string
	Description string
	LessonType string
	ContentText string
	DurationSeconds int
	VideoURL string
	VideoSource string
	MeetingURL string
	MeetingAt *time.Time
	RecordingURL string
	JoinInstructions string
	ShowRecording bool
	OwnerType OwnerType
	OwnerUserID string
	OwnerSchoolID string
	AssignedTeacherID string
	IsVisible bool
	IsLocked bool
	SkillLinks []SkillLink
	Assets []AssetLink
}

type LessonPage struct {
	Items []Lesson
	Page int
	Limit int
	HasMore bool
}

type FoundationTopic struct {
	ID string
	PathID string
	SubjectID string
	ParentTopicID string
	Code string
	Title string
	Description string
	SortOrder int
	IsVisible bool
	IsLocked bool
	Status string
	CreatedBy string
	Revision int
	CreatedAt time.Time
	UpdatedAt time.Time
	SkillLinks []SkillLink
}

type TopicCommand struct {
	PathID string
	SubjectID string
	ParentTopicID string
	Code string
	Title string
	Description string
	SortOrder int
	IsVisible bool
	IsLocked bool
	SkillLinks []SkillLink
}

type TopicPage struct {
	Items []FoundationTopic
	Page int
	Limit int
	HasMore bool
}

type LibraryItem struct {
	ID string
	PathID string
	SubjectID string
	Title string
	Description string
	ItemType string
	ExternalURL string
	Ownership Ownership
	IsVisible bool
	IsLocked bool
	SkillLinks []SkillLink
	Assets []AssetLink
}

type LibraryCommand struct {
	PathID string
	SubjectID string
	Title string
	Description string
	ItemType string
	ExternalURL string
	OwnerType OwnerType
	OwnerUserID string
	OwnerSchoolID string
	AssignedTeacherID string
	IsVisible bool
	IsLocked bool
	SkillLinks []SkillLink
	Assets []AssetLink
}

type LibraryPage struct {
	Items []LibraryItem
	Page int
	Limit int
	HasMore bool
}

type ListQuery struct {
	Page int
	Limit int
	Search string
	PathID string
	SubjectID string
	Workflow WorkflowStatus
	Status string
	ActorUserID string
	StaffScope StaffScope
}

type WorkflowCommand struct {
	ExpectedRevision int
	Status WorkflowStatus
	ReviewerNotes string
}
