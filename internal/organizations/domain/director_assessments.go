package domain

// SchoolDirectorAssessment follows the read-only Node director cards contract.
// The optional due date remains absent: PostgreSQL assignments can have
// multiple different close windows, which cannot be collapsed faithfully.
type SchoolDirectorAssessment struct {
	ID             string   `json:"id"`
	Title          string   `json:"title"`
	SubjectID      string   `json:"subjectId,omitempty"`
	TargetGroupIDs []string `json:"targetGroupIds"`
	IsPublished    bool     `json:"isPublished"`
}

type DirectorAssessmentWorkspace struct {
	Assessments []SchoolDirectorAssessment `json:"assessments"`
	Classes     []DirectorOverviewClass    `json:"classes"`
}
