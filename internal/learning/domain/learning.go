package domain

import (
	"math"
	"time"
)

type EvidenceType string

const (
	EvidenceAssessment     EvidenceType = "assessment"
	EvidencePractice       EvidenceType = "practice"
	EvidenceRemediation    EvidenceType = "remediation"
	EvidenceMasteryReview  EvidenceType = "mastery_review"
	EvidenceSmartClassroom EvidenceType = "smart_classroom"
)

type SubmissionEvidence struct {
	StudentID         string
	AttemptID         string
	AssessmentID      string
	AssessmentVersion int
	PathID            string
	SubjectID         string
	OccurredAt        time.Time
	Questions         []QuestionEvidence
}

type QuestionEvidence struct {
	QuestionID      string
	QuestionVersion int
	Answered        bool
	Correct         bool
	SkillIDs        []string
}

type ApplyResult struct {
	InsertedEvidence int `json:"insertedEvidence"`
	AffectedSkills   int `json:"affectedSkills"`
}

type SkillProgress struct {
	PathID            string    `json:"pathId"`
	SubjectID         string    `json:"subjectId"`
	SkillID           string    `json:"skillId"`
	Mastery           float64   `json:"mastery"`
	Status            string    `json:"status"`
	Attempts          int       `json:"attempts"`
	EvidenceCount     int       `json:"evidenceCount"`
	LastEvidenceAt    time.Time `json:"lastEvidenceAt"`
	RecommendedAction string    `json:"recommendedAction"`
}

type SkillProgressPage struct {
	Items   []SkillProgress `json:"items"`
	Page    int             `json:"page"`
	Limit   int             `json:"limit"`
	HasMore bool            `json:"hasMore"`
}

type ReviewTab string

const (
	ReviewSaved    ReviewTab = "saved"
	ReviewMistakes ReviewTab = "mistakes"
	ReviewAll      ReviewTab = "all"
)

func ValidReviewTab(v ReviewTab) bool {
	return v == ReviewSaved || v == ReviewMistakes || v == ReviewAll
}

type ReviewCard struct {
	ID              string     `json:"cardId"`
	QuestionID      string     `json:"questionId"`
	QuestionVersion int        `json:"questionVersion"`
	PathID          string     `json:"pathId"`
	SubjectID       string     `json:"subjectId"`
	ReviewType      string     `json:"reviewType"`
	SavedForReview  bool       `json:"savedForReview"`
	SavedAt         *time.Time `json:"savedAt"`
	HasMistake      bool       `json:"hasMistake"`
	NextReviewAt    time.Time  `json:"nextReviewAt"`
	SkillIDs        []string   `json:"skillIds"`
	UpdatedAt       time.Time  `json:"updatedAt"`
}

type ReviewQuestionOption struct {
	Index   int    `json:"index"`
	Text    string `json:"text"`
	AssetID string `json:"assetId"`
}

type ReviewQuestion struct {
	ID                     string                 `json:"id"`
	Version                int                    `json:"version"`
	Type                   string                 `json:"type"`
	Text                   string                 `json:"text"`
	ImageAssetID           string                 `json:"imageAssetId"`
	ImageAlt               string                 `json:"imageAlt"`
	OptionsEmbeddedInImage bool                   `json:"optionsEmbeddedInImage"`
	VideoURL               string                 `json:"videoUrl"`
	Difficulty             string                 `json:"difficulty"`
	Options                []ReviewQuestionOption `json:"options"`
	CorrectOptionIndex     *int                   `json:"correctOptionIndex,omitempty"`
	Explanation            string                 `json:"explanation"`
	Hint                   string                 `json:"hint"`
	SolvingStrategy        string                 `json:"solvingStrategy"`
}

type ReviewItem struct {
	Card     ReviewCard     `json:"card"`
	Question ReviewQuestion `json:"question"`
}

type ReviewPage struct {
	Items   []ReviewItem `json:"items"`
	Page    int          `json:"page"`
	Limit   int          `json:"limit"`
	HasMore bool         `json:"hasMore"`
}

type SM2Card struct {
	EaseFactor  float64
	Interval    int
	Repetitions int
}

type SM2Result struct {
	EaseFactor  float64
	Interval    int
	Repetitions int
	NextReview  time.Time
}

func NormalizeQuality(v int) int {
	if v < 0 {
		return 0
	}
	if v > 5 {
		return 5
	}
	return v
}

func SM2(card SM2Card, quality int, now time.Time) SM2Result {
	q := NormalizeQuality(quality)
	ease := card.EaseFactor
	interval := card.Interval
	repetitions := card.Repetitions
	if ease <= 0 {
		ease = 2.5
	}
	if interval < 0 {
		interval = 1
	}
	if repetitions < 0 {
		repetitions = 0
	}
	if q >= 3 {
		switch repetitions {
		case 0:
			interval = 1
		case 1:
			interval = 6
		default:
			interval = int(math.Round(float64(interval) * ease))
			if interval < 1 {
				interval = 1
			}
		}
		delta := float64(5 - q)
		ease = ease + 0.1 - delta*(0.08+delta*0.02)
		if ease < 1.3 {
			ease = 1.3
		}
		repetitions++
	} else {
		repetitions = 0
		interval = 1
	}
	ease = math.Round(ease*1000) / 1000
	return SM2Result{
		EaseFactor:  ease,
		Interval:    interval,
		Repetitions: repetitions,
		NextReview:  now.Add(time.Duration(interval) * 24 * time.Hour),
	}
}

func SkillStatus(mastery float64) string {
	switch {
	case mastery >= 90:
		return "mastered"
	case mastery >= 75:
		return "good"
	case mastery >= 50:
		return "average"
	default:
		return "weak"
	}
}

func RecommendedAction(mastery float64, attempts int) string {
	switch {
	case mastery < 45:
		return "خطة علاج عاجلة: شرح + تدريب + اختبار موجه"
	case mastery < 65 && attempts >= 3:
		return "زيادة التدريب ثم اختبار ساهر علاجي"
	case mastery < 65:
		return "إضافة تدريب قصير ومتابعة الأداء"
	default:
		return "تثبيت المهارة بتدريب خفيف وإعادة قياس لاحقًا"
	}
}
