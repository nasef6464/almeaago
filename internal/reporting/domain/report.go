package domain

import "time"

type ScopeKind string

const (
	ScopePlatform    ScopeKind = "platform"
	ScopeSchool      ScopeKind = "school"
	ScopeTeacher     ScopeKind = "teacher"
	ScopeSupervisor  ScopeKind = "supervisor"
	ScopeStudent     ScopeKind = "student"
)

type Query struct {
	SchoolID     string
	ClassID      string
	PathID       string
	SubjectID    string
	StudentLimit int
	ResultLimit  int
	AttemptLimit int
}

type ResolvedScope struct {
	Kind          ScopeKind
	ActorUserID   string
	SchoolID      string
	ClassID       string
	StudentIDs    []string
	StudentCount  int
	CanDetail     bool
	CanExport     bool
}

type AppliedLimits struct {
	Students int `json:"students"`
	Results  int `json:"results"`
	Attempts int `json:"attempts"`
}

type ScopeSummary struct {
	Kind                ScopeKind     `json:"kind"`
	SchoolID            string        `json:"schoolId,omitempty"`
	ClassID             string        `json:"classId,omitempty"`
	StudentCount        int           `json:"studentCount"`
	SampledStudentCount int           `json:"sampledStudentCount"`
	IsTruncated         bool          `json:"isTruncated"`
	Limits              AppliedLimits `json:"limits"`
	CanDetail           bool          `json:"canDetail"`
	CanExport           bool          `json:"canExport"`
}

type AssessmentSummary struct {
	ResultCount        int     `json:"resultCount"`
	SampledResultCount int     `json:"sampledResultCount"`
	ResultsTruncated   bool    `json:"resultsTruncated"`
	AttemptCount       int     `json:"attemptCount"`
	SampledAttemptCount int    `json:"sampledAttemptCount"`
	AttemptsTruncated  bool    `json:"attemptsTruncated"`
	AverageScore       float64 `json:"averageScore"`
	Passed             int     `json:"passed"`
	Failed             int     `json:"failed"`
	PassRate           float64 `json:"passRate"`
}

type SkillAggregate struct {
	SkillID          string  `json:"skillId"`
	SkillName        string  `json:"skillName"`
	EvidenceCount    int     `json:"evidenceCount"`
	AffectedStudents int     `json:"affectedStudents"`
	Mastery          float64 `json:"mastery"`
}

type Overview struct {
	Scope         ScopeSummary      `json:"scope"`
	Assessment    AssessmentSummary `json:"assessment"`
	WeakestSkills []SkillAggregate  `json:"weakestSkills"`
}

type ResultItem struct {
	AttemptID         string    `json:"attemptId"`
	StudentID         string    `json:"studentId"`
	StudentName       string    `json:"studentName"`
	AssessmentID      string    `json:"assessmentId"`
	AssessmentVersion int       `json:"assessmentVersion"`
	Title             string    `json:"title"`
	PathID            string    `json:"pathId"`
	SubjectID         string    `json:"subjectId"`
	Score             float64   `json:"score"`
	Passed            bool      `json:"passed"`
	CorrectAnswers    int       `json:"correctAnswers"`
	WrongAnswers      int       `json:"wrongAnswers"`
	Unanswered        int       `json:"unanswered"`
	TimeSpentSeconds  int       `json:"timeSpentSeconds"`
	FinalizedAt       time.Time `json:"finalizedAt"`
}

type ResultPage struct {
	Items   []ResultItem `json:"items"`
	Page    int          `json:"page"`
	Limit   int          `json:"limit"`
	Total   int          `json:"total"`
	HasMore bool         `json:"hasMore"`
}
