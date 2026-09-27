package domain

import "time"

type SchoolModule string

const (
	ModuleSchoolCore         SchoolModule = "SCHOOL_CORE"
	ModuleQuestionBank       SchoolModule = "QUESTION_BANK"
	ModuleSchoolAssessments  SchoolModule = "SCHOOL_ASSESSMENTS"
	ModulePathsAndCourses    SchoolModule = "PATHS_AND_COURSES"
	ModuleInteractiveVideo   SchoolModule = "INTERACTIVE_VIDEO"
	ModuleSmartClassroom     SchoolModule = "SMART_CLASSROOM"
	ModuleSchoolIntelligence SchoolModule = "SCHOOL_INTELLIGENCE"
	ModuleInterventionCenter SchoolModule = "INTERVENTION_CENTER"
	ModuleLiveTutoring       SchoolModule = "LIVE_TUTORING"
	ModuleWhiteLabel         SchoolModule = "WHITE_LABEL"
	ModuleExecutiveAnalytics SchoolModule = "EXECUTIVE_ANALYTICS"
)

func ValidSchoolModule(module SchoolModule) bool {
	switch module {
	case ModuleSchoolCore,
		ModuleQuestionBank,
		ModuleSchoolAssessments,
		ModulePathsAndCourses,
		ModuleInteractiveVideo,
		ModuleSmartClassroom,
		ModuleSchoolIntelligence,
		ModuleInterventionCenter,
		ModuleLiveTutoring,
		ModuleWhiteLabel,
		ModuleExecutiveAnalytics:
		return true
	default:
		return false
	}
}

type SchoolContractStatus string

const (
	SchoolContractActive   SchoolContractStatus = "active"
	SchoolContractInactive SchoolContractStatus = "inactive"
	SchoolContractExpired  SchoolContractStatus = "expired"
)

func ValidSchoolContractStatus(status SchoolContractStatus) bool {
	return status == SchoolContractActive || status == SchoolContractInactive || status == SchoolContractExpired
}

type SchoolContract struct {
	ID         string
	SchoolID   string
	Status     SchoolContractStatus
	Modules    []SchoolModule
	ValidFrom  *time.Time
	ValidUntil *time.Time
	Revision   int
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

type SchoolContractWrite struct {
	Status           SchoolContractStatus
	Modules          []SchoolModule
	ValidFrom        *time.Time
	ValidUntil       *time.Time
	ExpectedRevision int
}
