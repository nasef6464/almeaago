package domain

type LearnerResourcePage struct {
	PathID    string
	SubjectID string
	Page      int
	Courses   []LearnerCourseSummary
	Library   []LearnerLibrarySummary
	HasMore   bool
}
