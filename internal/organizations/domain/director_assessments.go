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

// DirectorAssessmentCreate is the server-validated school director creation
// command; the caller cannot choose owner ID, publication policy or creator.
type DirectorAssessmentCreate struct {
	Title       string
	ClassID     string
	TargetScope string
	PathID      string
	SubjectID   string
	QuestionIDs []string
	RequestKey  string
}

type DirectorAssessmentCreated struct {
	AssessmentID string `json:"assessmentId"`
	Title        string `json:"title"`
	ClassID      string `json:"classId"`
	TargetScope  string `json:"targetScope"`
}

// School question picker never discloses answer keys or explanations.
type DirectorAssessmentQuestion struct {
	ID             string `json:"id"`
	QuestionCode   string `json:"questionCode"`
	Text           string `json:"text"`
	Type           string `json:"type"`
	ImageURL       string `json:"imageUrl"`
	ImageAlt       string `json:"imageAlt"`
	CurrentVersion int    `json:"currentVersion"`
}

type DirectorAssessmentQuestionPage struct {
	Items   []DirectorAssessmentQuestion `json:"items"`
	HasMore bool                         `json:"hasMore"`
}
