package domain

import "time"

type SchoolContractStatus string

const (
	SchoolContractStatusActive   SchoolContractStatus = "active"
	SchoolContractStatusInactive SchoolContractStatus = "inactive"
	SchoolContractStatusExpired  SchoolContractStatus = "expired"
)

type SchoolModule string

const (
	SchoolModuleCore               SchoolModule = "SCHOOL_CORE"
	SchoolModuleQuestionBank       SchoolModule = "QUESTION_BANK"
	SchoolModuleAssessments        SchoolModule = "SCHOOL_ASSESSMENTS"
	SchoolModulePathsAndCourses    SchoolModule = "PATHS_AND_COURSES"
	SchoolModuleInteractiveVideo   SchoolModule = "INTERACTIVE_VIDEO"
	SchoolModuleSmartClassroom     SchoolModule = "SMART_CLASSROOM"
	SchoolModuleIntelligence       SchoolModule = "SCHOOL_INTELLIGENCE"
	SchoolModuleInterventionCenter SchoolModule = "INTERVENTION_CENTER"
	SchoolModuleLiveTutoring       SchoolModule = "LIVE_TUTORING"
	SchoolModuleWhiteLabel         SchoolModule = "WHITE_LABEL"
	SchoolModuleExecutiveAnalytics SchoolModule = "EXECUTIVE_ANALYTICS"
)

var SchoolModules = []SchoolModule{
	SchoolModuleCore,
	SchoolModuleQuestionBank,
	SchoolModuleAssessments,
	SchoolModulePathsAndCourses,
	SchoolModuleInteractiveVideo,
	SchoolModuleSmartClassroom,
	SchoolModuleIntelligence,
	SchoolModuleInterventionCenter,
	SchoolModuleLiveTutoring,
	SchoolModuleWhiteLabel,
	SchoolModuleExecutiveAnalytics,
}

type SchoolContract struct {
	ID         string
	SchoolID   string
	Status     SchoolContractStatus
	Modules    []SchoolModule
	ValidFrom  *time.Time
	ValidUntil *time.Time
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

type SchoolContractWrite struct {
	Status     SchoolContractStatus
	Modules    []SchoolModule
	ValidFrom  *time.Time
	ValidUntil *time.Time
}

type SchoolEntitlement struct {
	Allowed  bool
	Module   SchoolModule
	Contract *SchoolContract
}

func ValidSchoolContractStatus(status SchoolContractStatus) bool {
	switch status {
	case SchoolContractStatusActive, SchoolContractStatusInactive, SchoolContractStatusExpired:
		return true
	default:
		return false
	}
}

func ValidSchoolModule(module SchoolModule) bool {
	switch module {
	case SchoolModuleCore,
		SchoolModuleQuestionBank,
		SchoolModuleAssessments,
		SchoolModulePathsAndCourses,
		SchoolModuleInteractiveVideo,
		SchoolModuleSmartClassroom,
		SchoolModuleIntelligence,
		SchoolModuleInterventionCenter,
		SchoolModuleLiveTutoring,
		SchoolModuleWhiteLabel,
		SchoolModuleExecutiveAnalytics:
		return true
	default:
		return false
	}
}
