package domain

type StudyPlanResource struct {
	PlacementID     string
	AssessmentID    string
	AssessmentVersion int
	SubjectID       string
	Title           string
	Slot            PlacementSlot
	CourseID        string
	DurationMinutes int
	SortOrder       int
	Completed       bool
	CanStart        bool
}
