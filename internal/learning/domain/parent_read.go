package domain

import "time"

type ParentWeakSkill struct {
	PathID            string    `json:"pathId"`
	SubjectID         string    `json:"subjectId"`
	SkillID           string    `json:"skillId"`
	SkillName         string    `json:"skillName"`
	Mastery           float64   `json:"mastery"`
	Status            string    `json:"status"`
	Attempts          int       `json:"attempts"`
	EvidenceCount     int       `json:"evidenceCount"`
	RecommendedAction string    `json:"recommendedAction"`
	LastEvidenceAt    time.Time `json:"lastEvidenceAt"`
}

type ParentStudentLearningSnapshot struct {
	StudentID  string
	WeakSkills []ParentWeakSkill
}
