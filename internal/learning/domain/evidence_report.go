package domain

import (
	"math"
	"time"
)

type EvidenceStatus string

const (
	EvidenceUnmeasured   EvidenceStatus = "unmeasured"
	EvidenceInsufficient EvidenceStatus = "insufficient"
	EvidenceSupport      EvidenceStatus = "support"
	EvidenceDeveloping   EvidenceStatus = "developing"
	EvidenceReady        EvidenceStatus = "ready"
)

type LearningEvidencePolicy struct {
	MinimumAnswers int `json:"minimumAnswers"`
	SupportBelow   int `json:"supportBelow"`
	ReadyFrom      int `json:"readyFrom"`
}

var DefaultLearningEvidencePolicy = LearningEvidencePolicy{
	MinimumAnswers: 5,
	SupportBelow:   60,
	ReadyFrom:      80,
}

type LearningEvidenceQuery struct {
	Source    string
	SubjectID string
	Search    string
	PathID    string
	SchoolID  string
	ClassID   string
	QuizID    string
	Days      int
	Page      int
	Limit     int
	Status    string
}

type LearningEvidenceSkill struct {
	ID        string         `json:"id"`
	Name      string         `json:"name"`
	Accuracy  *int           `json:"accuracy"`
	Questions int            `json:"questions"`
	Correct   int            `json:"correct"`
	Tests     int            `json:"tests"`
	LatestAt  *time.Time     `json:"latestAt,omitempty"`
	Status    EvidenceStatus `json:"status"`
}

type LearningEvidenceStudent struct {
	ID         string                  `json:"id"`
	Name       string                  `json:"name"`
	Status     EvidenceStatus          `json:"status"`
	SkillCount int                     `json:"skillCount"`
	Skills     []LearningEvidenceSkill `json:"skills"`
}

type LearningEvidenceReport struct {
	Source        string                    `json:"source"`
	SubjectID     string                    `json:"subjectId"`
	Days          int                       `json:"days"`
	Policy        LearningEvidencePolicy    `json:"policy"`
	Coverage      string                    `json:"coverage"`
	Total         int                       `json:"total"`
	FilteredTotal int                       `json:"filteredTotal"`
	Page          int                       `json:"page"`
	Limit         int                       `json:"limit"`
	Summary       map[EvidenceStatus]int    `json:"summary"`
	Students      []LearningEvidenceStudent `json:"students"`
}

func ClassifySkillEvidence(questions, correct, incomplete int) (*int, EvidenceStatus) {
	if questions <= 0 {
		return nil, EvidenceUnmeasured
	}
	if incomplete > 0 {
		return nil, EvidenceInsufficient
	}
	pct := int(math.Round(float64(correct*100) / float64(questions)))
	if questions < DefaultLearningEvidencePolicy.MinimumAnswers {
		return &pct, EvidenceInsufficient
	}
	if pct < DefaultLearningEvidencePolicy.SupportBelow {
		return &pct, EvidenceSupport
	}
	if pct >= DefaultLearningEvidencePolicy.ReadyFrom {
		return &pct, EvidenceReady
	}
	return &pct, EvidenceDeveloping
}

func ClassifyStudentEvidence(skills []LearningEvidenceSkill) EvidenceStatus {
	if len(skills) == 0 {
		return EvidenceUnmeasured
	}
	hasInsufficient := false
	allReady := true
	for _, s := range skills {
		if s.Status == EvidenceSupport {
			return EvidenceSupport
		}
		if s.Status == EvidenceUnmeasured || s.Status == EvidenceInsufficient {
			hasInsufficient = true
			allReady = false
		} else if s.Status != EvidenceReady {
			allReady = false
		}
	}
	if hasInsufficient {
		return EvidenceInsufficient
	}
	if allReady {
		return EvidenceReady
	}
	return EvidenceDeveloping
}
