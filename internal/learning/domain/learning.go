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

type MasteryReadiness struct {
	Score              float64 `json:"score"`
	Status             string  `json:"status"`
	Mastery            float64 `json:"mastery"`
	Coverage           float64 `json:"coverage"`
	EvidenceConfidence float64 `json:"evidenceConfidence"`
	Recency            float64 `json:"recency"`
	TotalSkills        int     `json:"totalSkills"`
	ReliableSkills     int     `json:"reliableSkills"`
	TotalEvidence      int     `json:"totalEvidence"`
	Explanation        string  `json:"explanation"`
}

func MasteryReadinessFrom(rows []SkillProgress, now time.Time) MasteryReadiness {
	total := len(rows)
	reliable, evidence := 0, 0
	weighted := 0.0
	latest := time.Time{}
	for _, row := range rows {
		if row.EvidenceCount >= 3 {
			reliable++
		}
		evidence += row.EvidenceCount
		weighted += row.Mastery * float64(row.EvidenceCount)
		if row.LastEvidenceAt.After(latest) {
			latest = row.LastEvidenceAt
		}
	}
	mastery := 0.0
	if evidence > 0 {
		mastery = weighted / float64(evidence)
	}
	coverage := 0.0
	if total > 0 {
		coverage = float64(reliable) / float64(total)
	}
	confidence := 0.0
	if denom := total * 3; denom > 0 {
		confidence = math.Min(1, float64(evidence)/float64(denom))
	}
	recency := 0.5
	if !latest.IsZero() {
		days := now.Sub(latest).Hours() / 24
		switch {
		case days <= 14:
			recency = 1
		case days <= 30:
			recency = .8
		case days <= 60:
			recency = .6
		default:
			recency = .4
		}
	}
	score := math.Round(mastery*.55 + coverage*100*.2 + confidence*100*.15 + recency*100*.1)
	status, explanation := "building", "استمر في العلاج والتدريب قبل إعادة القياس."
	if total == 0 || reliable == 0 {
		status, explanation = "needs_measurement", "نحتاج أدلة أكثر قبل اتخاذ قرار انتقال."
	} else if score >= 80 && coverage >= .7 {
		status, explanation = "ready_to_advance", "الإتقان والتغطية والأدلة الحديثة تسمح بالانتقال بعد تثبيت قصير."
	} else if score >= 60 {
		status, explanation = "ready_for_recheck", "المستوى قريب من الجاهزية؛ أعد القياس بعد تدريب قصير."
	}
	return MasteryReadiness{Score: score, Status: status, Mastery: math.Round(mastery), Coverage: coverage, EvidenceConfidence: confidence, Recency: recency, TotalSkills: total, ReliableSkills: reliable, TotalEvidence: evidence, Explanation: explanation}
}
