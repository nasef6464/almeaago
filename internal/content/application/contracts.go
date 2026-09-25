package application

import (
	"encoding/json"
	"time"

	content "github.com/nasef6464/almeaago/internal/content/domain"
)

type CourseInput struct {
	PathID                 string              `json:"pathId"`
	SubjectID              string              `json:"subjectId"`
	Title                  string              `json:"title"`
	Description            string              `json:"description"`
	InstructorName         string              `json:"instructorName"`
	DurationMinutes        int                 `json:"durationMinutes"`
	Level                  content.CourseLevel `json:"level"`
	OwnerType              content.OwnerType   `json:"ownerType"`
	OwnerUserID            string              `json:"ownerUserId"`
	OwnerSchoolID          string              `json:"ownerSchoolId"`
	AssignedTeacherID      string              `json:"assignedTeacherId"`
	RevenueSharePercentage *float64            `json:"revenueSharePercentage"`
	IsVisible              *bool               `json:"isVisible"`
	DripContentEnabled     bool                `json:"dripContentEnabled"`
	CertificateEnabled     bool                `json:"certificateEnabled"`
	ThumbnailAssetID       string              `json:"thumbnailAssetId"`
	Presentation           json.RawMessage     `json:"presentation"`
	SkillIDs               []string            `json:"skillIds"`
}

type LessonInput struct {
	PathID                 string             `json:"pathId"`
	SubjectID              string             `json:"subjectId"`
	Title                  string             `json:"title"`
	Description            string             `json:"description"`
	LessonType             content.LessonType `json:"type"`
	ContentText            string             `json:"contentText"`
	DurationSeconds        int                `json:"durationSeconds"`
	VideoURL               string             `json:"videoUrl"`
	VideoSource            string             `json:"videoSource"`
	MeetingURL             string             `json:"meetingUrl"`
	MeetingAt              *time.Time         `json:"meetingAt"`
	RecordingURL           string             `json:"recordingUrl"`
	JoinInstructions       string             `json:"ioinstructions"`
	ShowRecording          bool               `json:"showRecording"`
	OwnerType              content.OwnerType  `json:"ownerType"`
	OwnerUserID            string             `json:"ownerUserId"`
	OwnerSchoolID          string             `json:"ownerSchoolId"`
	AssignedTeacherID      string             `json:"assignedTeacherId"`
	RevenueSharePercentage *float64           `json:"revenueSharePercentage"`
	IsVisible              *bool              `json:"isVisible"`
	IsLocked               bool               `json:"isLocked"`
	SkillIDs               []string           `json:"skillIds"`
	AssetIDs               []string           `json:"assetIds"`
}

type LibraryInput struct {
	PathID                 string              `json:"pathId"`
	SubjectID              string              `json:"subjectId"`
	Title                  string              `json:"title"`
	Description            string              `json:"description"`
	ItemType               content.LibraryType `json:"type"`
	ExternalURL            string              `json:"externalUrl"`
	OwnerType              content.OwnerType   `json:"ownerType"`
	OwnerUserID            string              `json:"ownerUserId"`
	OwnerSchoolID          string              `json:"ownerSchoolId"`
	AssignedTeacherID      string              `json:"assignedTeacherId"`
	RevenueSharePercentage *float64            `json:"revenueSharePercentage"`
	IsVisible              *bool               `json:"isVisible"`
	IsLocked               bool                `json:"isLocked"`
	SkillIDs               []string            `json:"skillIds"`
	PrimaryAssetID         string              `json:"primaryAssetId"`
}

type TopicInput struct {
	PathID        string              `json:"pathId"`
	SubjectID     string              `json:"subjectId"`
	ParentTopicID string              `json:"parentTopicId"`
	Code          string              `json:"code"`
	Title         string              `json:"title"`
	Description   string              `json:"description"`
	SortOrder     int                 `json:"sortOrder"`
	Status        content.TopicStatus `json:"status"`
	IsVisible     *bool               `json:"isVisible"`
	IsLocked      bool                `json:"isLocked"`
	SkillIDs      []string            `json:"skillIds"`
}

type UpdateCourseInput struct {
	ExpectedRevision int `json:"expectedRevision"`
	CourseInput
}

type UpdateLessonInput struct {
	ExpectedRevision int `json:"expectedRevision"`
	LessonInput
}

type UpdateLibraryInput struct {
	ExpectedRevision int `json:"expectedRevision"`
	LibraryInput
}

type UpdateTopicInput struct {
	ExpectedRevision int `json:"expectedRevision"`
	TopicInput
}

type WorkflowInput struct {
	ExpectedRevision int                    `json:"expectedRevision"`
	Status           content.WorkflowStatus `json:"status"`
	ReviewerNotes    string                 `json:"reviewerNotes"`
}
