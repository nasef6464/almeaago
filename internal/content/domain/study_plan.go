package domain

type StudyPlanResourceKind string

const (
	StudyPlanLessonResource  StudyPlanResourceKind = "lesson"
	StudyPlanLibraryResource StudyPlanResourceKind = "resource"
)

type StudyPlanResource struct {
	Kind            StudyPlanResourceKind
	ID              string
	CourseID        string
	SubjectID       string
	Title           string
	ExternalURL     string
	DurationMinutes int
	SortOrder       int
}
