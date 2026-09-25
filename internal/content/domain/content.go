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

type CourseLevel string

const (
	CourseBeginner     CourseLevel = "beginner"
	CourseIntermediate CourseLevel = "intermediate"
	CourseAdvanced     CourseLevel = "advanced"
)

func ValidCourseLevel(level CourseLevel) bool {
	switch level {
	case CourseBeginner, CourseIntermediate, CourseAdvanced:
		return true
	default:
		return false
	}
}

type LessonType string

const (
	LessonVideo       LessonType = "video"
	LessonFile        LessonType = "file"
	LessonText        LessonType = "text"
	LessonAssignment  LessonType = "assignment"
	LessonLiveYouTube LessonType = "live_youtube"
	LessonZoom        LessonType = "zoom"
	LessonGoogleMeet  LessonType = "google_meet"
	LessonTeams       LessonType = "teams"
)

func ValidLessonType(value LessonType) bool {
	switch value {
	case LessonVideo, LessonFile, LessonText, LessonAssignment, LessonLiveYouTube, LessonZoom, LessonGoogleMeet, LessonTeams:
		return true
	default:
		return false
	}
}

type LibraryType string

const (
	LibraryPDF   LibraryType = "pdf"
	LibraryDoc   LibraryType = "doc"
	LibraryVideo LibraryType = "video"
	LibraryLink  LibraryType = "link"
)

func ValidLibraryType(value LibraryType) bool {
	switch value {
	case LibraryPDF, LibraryDoc, LibraryVideo, LibraryLink:
		return true
	default:
		return false
	}
}

type TopicStatus string

const (
	TopicActive   TopicStatus = "active"
	TopicInactive TopicStatus = "inactive"
	TopicArchived TopicStatus = "archived"
)

func ValidTopicStatus(value TopicStatus) bool {
	switch value {
	case TopicActive, TopicInactive, TopicArchived:
		return true
	default:
		return false
	}
}

type Course struct {
	ID                     string
	PathID                 string
	SubjectID              string
	Title                  string
	Description            string
	InstructorName         string
	DurationMinutes        int
	Level                  CourseLevel
	OwnerType              OwnerType
	OwnerUserID            string
	OwnerSchoolID          string
	CreatedBy              string
	AssignedTeacherID      string
	WorkflowStatus         WorkflowStatus
	ApprovedBy             string
	ApprovedAt             *time.Time
	ReviewerNotes          string
	RevenueSharePercentage *float64
	IsVisible              bool
	IsPublished            bool
	PublishedBy            string
	PublishedAt            *time.Time
	DripContentEnabled     bool
	CertificateEnabled     bool
	ThumbnailAssetID       string
	Presentation           json.RawMessage
	Revision               int
	SkillIDs               []string
	CreatedAt              time.Time
	UpdatedAt              time.Time
}

type Lesson struct {
	ID                     string
	PathID                 string
	SubjectID              string
	Title                  string
	Description            string
	LessonType             LessonType
	ContentText            string
	DurationSeconds        int
	VideoURL               string
	VideoSource            string
	MeetingURL             string
	MeetingAt              *time.Time
	RecordingURL           string
	JoinInstructions       string
	ShowRecording          bool
	OwnerType              OwnerType
	OwnerUserID            string
	OwnerSchoolID          string
	CreatedBy              string
	AssignedTeacherID      string
	WorkflowStatus         WorkflowStatus
	ApprovedBy             string
	ApprovedAt             *time.Time
	ReviewerNotes          string
	RevenueSharePercentage *float64
	IsVisible              bool
	IsLocked               bool
	Revision               int
	SkillIDs               []string
	AssetIDs               []string
	CreatedAt              time.Time
	UpdatedAt              time.Time
}

type FoundationTopic struct {
	ID            string
	PathID        string
	SubjectID     string
	ParentTopicID string
	Code          string
	Title         string
	Description   string
	SortOrder     int
	Status        TopicStatus
	IsVisible     bool
	IsLocked      bool
	CreatedBy     string
	Revision      int
	SkillIDs      []string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type LibraryItem struct {
	ID                     string
	PathID                 string
	SubjectID              string
	Title                  string
	Description            string
	ItemType               LibraryType
	ExternalURL            string
	OwnerType              OwnerType
	OwnerUserID            string
	OwnerSchoolID          string
	CreatedBy              string
	AssignedTeacherID      string
	WorkflowStatus         WorkflowStatus
	ApprovedBy             string
	ApprovedAt             *time.Time
	ReviewerNotes          string
	RevenueSharePercentage *float64
	IsVisible              bool
	IsLocked               bool
	Revision               int
	SkillIDs               []string
	PrimaryAssetID         string
	CreatedAt              time.Time
	UpdatedAt              time.Time
}

type ListQuery struct {
	Page                     int
	Limit                    int
	PathID                   string
	SubjectID                string
	Search                   string
	WorkflowStatus           WorkflowStatus
	TeacherScopeUserID       string
	TeacherScopePrevalidated bool
}

type CoursePage struct {
	Items   []Course
	Page    int
	Limit   int
	HasMore bool
}

type LessonPage struct {
	Items   []Lesson
	Page    int
	Limit   int
	HasMore bool
}

type LibraryPage struct {
	Items   []LibraryItem
	Page    int
	Limit   int
	HasMore bool
}

type TopicQuery struct {
	PathID    string
	SubjectID string
	ParentID  string
	Search    string
	Status    TopicStatus
	Page      int
	Limit     int
}

type TopicPage struct {
	Items   []FoundationTopic
	Page    int
	Limit   int
	HasMore bool
}

type CourseWrite struct {
	PathID                 string
	SubjectID              string
	Title                  string
	Description            string
	InstructorName         string
	DurationMinutes        int
	Level                  CourseLevel
	OwnerType              OwnerType
	OwnerUserID            string
	OwnerSchoolID          string
	AssignedTeacherID      string
	RevenueSharePercentage *float64
	IsVisible              bool
	DripContentEnabled     bool
	CertificateEnabled     bool
	ThumbnailAssetID       string
	Presentation           json.RawMessage
	SkillIDs               []string
}

type LessonWrite struct {
	PathID                 string
	SubjectID              string
	Title                  string
	Description            string
	LessonType             LessonType
	ContentText            string
	DurationSeconds        int
	VideoURL               string
	VideoSource            string
	MeetingURL             string
	MeetingAt              *time.Time
	RecordingURL           string
	JoinInstructions       string
	ShowRecording          bool
	OwnerType              OwnerType
	OwnerUserID            string
	OwnerSchoolID          string
	AssignedTeacherID      string
	RevenueSharePercentage *float64
	IsVisible              bool
	IsLocked               bool
	SkillIDs               []string
	AssetIDs               []string
}

type TopicWrite struct {
	PathID        string
	SubjectID     string
	ParentTopicID string
	Code          string
	Title         string
	Description   string
	SortOrder     int
	Status        TopicStatus
	IsVisible     bool
	IsLocked      bool
	SkillIDs      []string
}

type LibraryWrite struct {
	PathID                 string
	SubjectID              string
	Title                  string
	Description            string
	ItemType               LibraryType
	ExternalURL            string
	OwnerType              OwnerType
	OwnerUserID            string
	OwnerSchoolID          string
	AssignedTeacherID      string
	RevenueSharePercentage *float64
	IsVisible              bool
	IsLocked               bool
	SkillIDs               []string
	PrimaryAssetID         string
}

type TrainerScope struct {
	UserID     string
	PathIDs    []string
	SubjectIDs []string
}

type CourseModule struct {
	ID          string
	CourseID    string
	Title       string
	Description string
	SortOrder   int
	Status      string
	Lessons     []CourseLessonPlacement
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type CourseLessonPlacement struct {
	LessonID  string
	SortOrder int
	IsPreview bool
}

type FoundationPlacements struct {
	Lessons      []TopicLessonPlacement
	LibraryItems []TopicLibraryPlacement
}

type TopicLessonPlacement struct {
	LessonID  string
	SortOrder int
}

type TopicLibraryPlacement struct {
	LibraryItemID string
	SortOrder     int
}

type LearningSpace struct {
	PathID            string
	SubjectID         string
	Courses           []LearnerCourseSummary
	CoursesHasMore    bool
	Foundation        []LearnerTopicSummary
	FoundationHasMore bool
	LibraryItems      []LearnerLibrarySummary
	LibraryHasMore    bool
}

type LearnerCourseSummary struct {
	ID                 string
	Title              string
	Description        string
	InstructorName     string
	DurationMinutes    int
	Level              CourseLevel
	ThumbnailAssetID   string
	DripContentEnabled bool
	CertificateEnabled bool
}

type LearnerTopicSummary struct {
	ID            string
	ParentTopicID string
	Title         string
	Description   string
	SortOrder     int
	IsLocked      bool
}

type LearnerLibrarySummary struct {
	ID          string
	Title       string
	Description string
	ItemType    LibraryType
	IsLocked    bool
}

type LearnerLessonSummary struct {
	ID              string
	Title           string
	Description     string
	LessonType      LessonType
	DurationSeconds int
	IsLocked        bool
	IsPreview       bool
	SortOrder       int
}

type LearnerCourseModule struct {
	ID          string
	Title       string
	Description string
	SortOrder   int
	Lessons     []LearnerLessonSummary
}

type LearnerCourse struct {
	Course  LearnerCourseSummary
	Modules []LearnerCourseModule
}

type LearnerTopic struct {
	Topic        LearnerTopicSummary
	Lessons      []LearnerLessonSummary
	LibraryItems []LearnerLibrarySummary
}
