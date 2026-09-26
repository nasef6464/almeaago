package domain

import "time"

type PlacementSlot string

const (
	PlacementTraining   PlacementSlot = "training"
	PlacementTests      PlacementSlot = "tests"
	PlacementFoundation PlacementSlot = "foundation"
	PlacementCourse     PlacementSlot = "course"
)

func ValidPlacementSlot(v PlacementSlot) bool {
	return v == PlacementTraining || v == PlacementTests || v == PlacementFoundation || v == PlacementCourse
}

type Placement struct {
	ID                string        `json:"id"`
	AssessmentID      string        `json:"assessmentId"`
	AssessmentVersion int           `json:"assessmentVersion"`
	Slot              PlacementSlot       `json:"slot"`
	AccessType        PlacementAccessType `json:"accessType"`
	PathID            string        `json:"pathId"`
	SubjectID         string        `json:"subjectId"`
	CourseID          string        `json:"courseId"`
	LessonID          string        `json:"lessonId"`
	TopicID           string        `json:"topicId"`
	IsVisible         bool          `json:"isVisible"`
	SortOrder         int           `json:"sortOrder"`
	CreatedAt         time.Time     `json:"createdAt"`
	UpdatedAt         time.Time     `json:"updatedAt"`
}

type PlacementWrite struct {
	Slot       PlacementSlot       `json:"slot"`
	AccessType PlacementAccessType `json:"accessType"`
	PathID    string        `json:"pathId"`
	SubjectID string        `json:"subjectId"`
	CourseID  string        `json:"courseId"`
	LessonID  string        `json:"lessonId"`
	TopicID   string        `json:"topicId"`
	IsVisible bool          `json:"isVisible"`
	SortOrder int           `json:"sortOrder"`
}

type PlacementPatch struct {
	ExpectedUpdatedAt time.Time           `json:"expectedUpdatedAt"`
	AccessType        PlacementAccessType `json:"accessType"`
	IsVisible         bool      `json:"isVisible"`
	SortOrder         int       `json:"sortOrder"`
}

type PlacementPage struct {
	Items   []Placement `json:"items"`
	Page    int         `json:"page"`
	Limit   int         `json:"limit"`
	HasMore bool        `json:"hasMore"`
}

type LearnerPlacementQuery struct {
	Page      int
	Limit     int
	Slot      PlacementSlot
	PathID    string
	SubjectID string
	CourseID  string
	LessonID  string
	TopicID   string
}

type LearnerPlacement struct {
	PlacementID       string        `json:"placementId"`
	AssessmentID      string        `json:"assessmentId"`
	AssessmentVersion int           `json:"assessmentVersion"`
	AssessmentKind    Kind          `json:"assessmentKind"`
	Title             string        `json:"title"`
	Slot              PlacementSlot `json:"slot"`
	PathID            string        `json:"pathId"`
	SubjectID         string        `json:"subjectId"`
	CourseID          string        `json:"courseId"`
	LessonID          string        `json:"lessonId"`
	TopicID           string        `json:"topicId"`
	SortOrder         int           `json:"sortOrder"`
	AttemptCount      int           `json:"attemptCount"`
	MaxAttempts       int           `json:"maxAttempts"`
	AccessType        PlacementAccessType `json:"accessType"`
	BaseAccessType    AccessType          `json:"baseAccessType"`
	AccessAllowed     bool                `json:"accessAllowed"`
	AccessReason      string              `json:"accessReason"`
	CanStart          bool                `json:"canStart"`
}

type LearnerPlacementPage struct {
	Items   []LearnerPlacement `json:"items"`
	Page    int                `json:"page"`
	Limit   int                `json:"limit"`
	HasMore bool               `json:"hasMore"`
}
