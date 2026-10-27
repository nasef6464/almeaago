package domain

// DirectorOverview is the school-scoped read model displayed in the school
// director's executive summary. Counts come from authoritative domain tables.
type DirectorOverview struct {
	School  DirectorOverviewSchool  `json:"school"`
	Metrics DirectorOverviewMetrics `json:"metrics"`
	Classes []DirectorOverviewClass `json:"classes"`
}

type DirectorOverviewSchool struct {
	SchoolID   string `json:"schoolId"`
	SchoolName string `json:"schoolName"`
}

type DirectorOverviewClass struct {
	ClassID   string `json:"classId"`
	ClassName string `json:"className"`
}

type DirectorOverviewMetrics struct {
	Students              int `json:"students"`
	Classes               int `json:"classes"`
	Teachers              int `json:"teachers"`
	Supervisors           int `json:"supervisors"`
	SchoolAssessments     int `json:"schoolAssessments"`
	CompletedSmartClasses int `json:"completedSmartClasses"`
}
