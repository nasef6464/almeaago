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

// AssessmentReport is intentionally evidence-aware. No started-attempt or
// subject breakdown estimates may be substituted for unavailable results.
type DirectorAssessmentReport struct {
	Coverage struct {
		Complete        bool     `json:"complete"`
		MissingEvidence []string `json:"missingEvidence"`
		Subjects        struct {
			Completed    int  `json:"completed"`
			WithEvidence int  `json:"withEvidence"`
			Complete     bool `json:"complete"`
		} `json:"subjects"`
	} `json:"coverage"`
	Audience struct {
		Targeted int `json:"targeted"`
	} `json:"audience"`
	Participation struct {
		Completed    int  `json:"completed"`
		NotCompleted int  `json:"notCompleted"`
		Started      *int `json:"started"`
	} `json:"participation"`
	Scores struct {
		Average  *float64 `json:"average"`
		PassRate *float64 `json:"passRate"`
		Highest  *float64 `json:"highest"`
		Lowest   *float64 `json:"lowest"`
	} `json:"scores"`
	Subjects          []any `json:"subjects"`
	Sections          []any `json:"sections"`
	Skills            []any `json:"skills"`
	SubjectBreakdowns []any `json:"subjectBreakdowns"`
}
