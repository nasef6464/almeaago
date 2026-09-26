package domain

import "time"

type StudyPlanStatus string
type StudyPlanWeekday string
type StudyPlanItemType string
type StudyPlanPhase string

const (
	StudyPlanActive   StudyPlanStatus = "active"
	StudyPlanArchived StudyPlanStatus = "archived"

	StudyPlanSaturday  StudyPlanWeekday = "saturday"
	StudyPlanSunday    StudyPlanWeekday = "sunday"
	StudyPlanMonday    StudyPlanWeekday = "monday"
	StudyPlanTuesday   StudyPlanWeekday = "tuesday"
	StudyPlanWednesday StudyPlanWeekday = "wednesday"
	StudyPlanThursday  StudyPlanWeekday = "thursday"
	StudyPlanFriday    StudyPlanWeekday = "friday"

	StudyPlanLesson     StudyPlanItemType = "lesson"
	StudyPlanAssessment StudyPlanItemType = "assessment"
	StudyPlanResource   StudyPlanItemType = "resource"

	StudyPlanFoundation StudyPlanPhase = "foundation"
	StudyPlanPractice   StudyPlanPhase = "practice"
	StudyPlanReview     StudyPlanPhase = "review"
)

func ValidStudyPlanStatus(v StudyPlanStatus) bool {
	return v == StudyPlanActive || v == StudyPlanArchived
}

func ValidStudyPlanWeekday(v StudyPlanWeekday) bool {
	switch v {
	case StudyPlanSaturday, StudyPlanSunday, StudyPlanMonday, StudyPlanTuesday,
		StudyPlanWednesday, StudyPlanThursday, StudyPlanFriday:
		return true
	default:
		return false
	}
}

type StudyPlanWrite struct {
	Name                     string             `json:"name"`
	PathID                   string             `json:"pathId"`
	SubjectIDs               []string           `json:"subjectIds"`
	CourseIDs                []string           `json:"courseIds"`
	StartDate                string             `json:"startDate"`
	EndDate                  string             `json:"endDate"`
	SkipCompletedAssessments bool               `json:"skipCompletedQuizzes"`
	OffDays                  []StudyPlanWeekday `json:"offDays"`
	DailyMinutes             int                `json:"dailyMinutes"`
	PreferredStartTime       string             `json:"preferredStartTime"`
	Status                   StudyPlanStatus    `json:"status"`
}

type StudyPlanPatch struct {
	ExpectedUpdatedAt time.Time `json:"expectedUpdatedAt"`
	StudyPlanWrite
}

type StudyPlanSummary struct {
	ID                       string          `json:"id"`
	StudentID                string          `json:"studentId"`
	Name                     string          `json:"name"`
	PathID                   string          `json:"pathId"`
	StartDate                string          `json:"startDate"`
	EndDate                  string          `json:"endDate"`
	SkipCompletedAssessments bool            `json:"skipCompletedQuizzes"`
	DailyMinutes             int             `json:"dailyMinutes"`
	PreferredStartTime       string          `json:"preferredStartTime"`
	Status                   StudyPlanStatus `json:"status"`
	ItemCount                int             `json:"itemCount"`
	CreatedAt                time.Time       `json:"createdAt"`
	UpdatedAt                time.Time       `json:"updatedAt"`
}

type StudyPlanItemSeed struct {
	SubjectID             string
	ItemType              StudyPlanItemType
	LessonID              string
	CourseID              string
	LibraryItemID         string
	AssessmentPlacementID string
	ScheduledDate         string
	ScheduledTime         string
	DurationMinutes       int
	Phase                 StudyPlanPhase
	SortOrder             int
}

type StudyPlanItem struct {
	ID                    string            `json:"id"`
	SubjectID             string            `json:"subjectId"`
	ItemType              StudyPlanItemType `json:"itemType"`
	LessonID              string            `json:"lessonId"`
	CourseID              string            `json:"courseId"`
	LibraryItemID         string            `json:"libraryItemId"`
	AssessmentPlacementID string            `json:"assessmentPlacementId"`
	ScheduledDate         string            `json:"scheduledDate"`
	ScheduledTime         string            `json:"scheduledTime"`
	DurationMinutes       int               `json:"durationMinutes"`
	Phase                 StudyPlanPhase    `json:"phase"`
	SortOrder             int               `json:"sortOrder"`
	Title                 string            `json:"title"`
	ExternalURL           string            `json:"externalUrl"`
	Completed             bool              `json:"completed"`
	Available             bool              `json:"available"`
	AssessmentSlot        string            `json:"assessmentSlot"`
}

type StudyPlan struct {
	StudyPlanSummary
	SubjectIDs []string           `json:"subjectIds"`
	CourseIDs  []string           `json:"courseIds"`
	OffDays    []StudyPlanWeekday `json:"offDays"`
	Items      []StudyPlanItem    `json:"items"`
}

type StudyPlanPage struct {
	Items   []StudyPlanSummary `json:"items"`
	Page    int                `json:"page"`
	Limit   int                `json:"limit"`
	HasMore bool               `json:"hasMore"`
}

type StudyPlanLessonRef struct {
	LessonID string
	CourseID string
}
