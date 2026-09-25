package domain

import (
	"errors"
	"time"
)

var ErrSchoolContractNotFound = errors.New("school contract not found")

type SchoolContractStatus string

const (
	SchoolContractStatusActive   SchoolContractStatus = "active"
	SchoolContractStatusInactive SchoolContractStatus = "inactive"
	SchoolContractStatusExpired  SchoolContractStatus = "expired"
)

type SchoolModule string

const (
	SchoolModuleCore              SchoolModule = "SCHOOL_CORE"
	SchoolModuleQuestionBank      SchoolModule = "QUESTION_BANK"
	SchoolModuleAssessments       SchoolModule = "SCHOOL_ASSESSMENTS"
	SchoolModulePathsCourses      SchoolModule = "PATHS_AND_COURSES"
	SchoolModuleInteractiveVideo  SchoolModule = "INTERACTIVE_VIDEO"
	SchoolModuleSmartClassroom    SchoolModule = "SMART_CLASSROOM"
	SchoolModuleIntelligence      SchoolModule = "SCHOOL_INTELLIGENCE"
	SchoolModuleIntervention      SchoolModule = "INTERVENTION_CENTER"
	SchoolModuleLiveTutoring      SchoolModule = "LIVE_TUTORING"
	SchoolModuleWhiteLabel        SchoolModule = "WHITE_LABEL"
	SchoolModuleExecutiveAnalytics SchoolModule = "EXECUTIVE_ANALYTICS"
)

var SchoolModules = []SchoolModule{
	SchoolModuleCore,
	SchoolModuleQuestionBank,
	SchoolModuleAssessments,
	SchoolModulePathsCourses,
	SchoolModuleInteractiveVideo,
	SchoolModuleSmartClassroom,
	SchoolModuleIntelligence,
	SchoolModuleIntervention,
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

type SchoolModuleEntitlement struct {
	Allowed  bool
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
	for _, candidate := range SchoolModules {
		if module == candidate {
			return true
		}
	}
	return false
}

func (c SchoolContract) HasModule(module SchoolModule) bool {
	for _, candidate := range c.Modules {
		if candidate == module {
			return true
		}
	}
	return false
}

func (c SchoolContract) IsCurrent(now time.Time) bool {
	if c.Status != SchoolContractStatusActive {
		return false
	}
	if c.ValidFrom != nil && c.ValidFrom.After(now) {
		return false
	}
	if c.ValidUntil != nil && c.ValidUntil.Before(now) {
		return false
	}
	return true
}
