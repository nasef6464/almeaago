package domain

import "time"

type InterventionStatus string

const (
	InterventionActive    InterventionStatus = "active"
	InterventionCompleted InterventionStatus = "completed"
	InterventionCancelled InterventionStatus = "cancelled"
)

func ValidInterventionStatus(v InterventionStatus) bool {
	return v == InterventionActive || v == InterventionCompleted || v == InterventionCancelled
}

type InterventionEvidence struct {
	EvidenceCount int        `json:"evidenceCount"`
	Correct       int        `json:"correct"`
	Accuracy      *float64   `json:"accuracy"`
	MeasuredAt    *time.Time `json:"measuredAt,omitempty"`
}

type InterventionCreate struct {
	SchoolID             string     `json:"schoolId"`
	ClassID              string     `json:"classId"`
	StudentID            string     `json:"studentId"`
	PathID               string     `json:"pathId"`
	SubjectID            string     `json:"subjectId"`
	SkillID              string     `json:"skillId"`
	FollowUpAt           *time.Time `json:"followUpAt"`
	RemediationThreshold *float64   `json:"remediationThreshold"`
	MinimumEvidence      int        `json:"minimumEvidence"`
}

type InterventionPatch struct {
	ExpectedUpdatedAt    time.Time          `json:"expectedUpdatedAt"`
	Status               InterventionStatus `json:"status"`
	FollowUpAt           *time.Time         `json:"followUpAt"`
	RemediationThreshold *float64           `json:"remediationThreshold"`
	MinimumEvidence      int                `json:"minimumEvidence"`
}

type SchoolIntervention struct {
	ID                   string               `json:"id"`
	SchoolID             string               `json:"schoolId"`
	ClassID              string               `json:"classId"`
	StudentID            string               `json:"studentId"`
	PathID               string               `json:"pathId"`
	SubjectID            string               `json:"subjectId"`
	SkillID              string               `json:"skillId"`
	ActionType           string               `json:"actionType"`
	StudyPlanID          string               `json:"studyPlanId"`
	Status               InterventionStatus   `json:"status"`
	AssignedBy           string               `json:"assignedBy"`
	FollowUpAt           *time.Time           `json:"followUpAt"`
	RemediationThreshold *float64             `json:"remediationThreshold"`
	MinimumEvidence      int                  `json:"minimumEvidence"`
	Baseline             InterventionEvidence `json:"baseline"`
	Outcome              *InterventionEvidence `json:"outcome,omitempty"`
	CreatedAt            time.Time            `json:"createdAt"`
	UpdatedAt            time.Time            `json:"updatedAt"`
}

type InterventionPage struct {
	Items   []SchoolIntervention `json:"items"`
	Page    int                  `json:"page"`
	Limit   int                  `json:"limit"`
	HasMore bool                 `json:"hasMore"`
}

type InterventionOutcome struct {
	Intervention SchoolIntervention `json:"intervention"`
	Confidence   string             `json:"confidence"`
	Delta        *float64           `json:"delta,omitempty"`
	ThresholdMet *bool              `json:"thresholdMet,omitempty"`
}
