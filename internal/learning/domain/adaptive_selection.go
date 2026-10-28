package domain

import (
	"math"
	"sort"
	"strings"
	"time"
)

// AdaptiveEvidence is the percentage for one source event, not one question
// and not the cumulative persisted mastery. Legacy keeps the latest five.
type AdaptiveEvidence struct {
	Mastery    float64   `json:"mastery"`
	OccurredAt time.Time `json:"occurredAt"`
}

type AdaptiveProgress struct {
	SkillProgress
	RecentEvidence []AdaptiveEvidence
}

func boundedMastery(value float64) float64 {
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return 0
	}
	return math.Max(0, math.Min(100, value))
}

// RankAdaptiveProgress implements the pinned server next-best-action policy.
// It does not change mastery, thresholds, or the stored progress recommendation.
// Equal scores retain the repository's input order, matching stable JS sort.
func RankAdaptiveProgress(rows []AdaptiveProgress, pathID, subjectID string, now time.Time) []SkillProgress {
	type candidate struct {
		row   SkillProgress
		score float64
	}
	ranked := make([]candidate, 0, len(rows))
	for _, input := range rows {
		row := input.SkillProgress
		row.SkillID = strings.TrimSpace(row.SkillID)
		row.PathID = strings.TrimSpace(row.PathID)
		row.SubjectID = strings.TrimSpace(row.SubjectID)
		row.Status = strings.TrimSpace(row.Status)
		if row.SkillID == "" || row.PathID != pathID || (subjectID != "" && row.SubjectID != subjectID) {
			continue
		}
		row.Mastery = boundedMastery(row.Mastery)
		if row.EvidenceCount == 0 {
			row.EvidenceCount = row.Attempts
		}
		row.EvidenceCount = max(0, row.EvidenceCount)
		evidence := make([]AdaptiveEvidence, 0, len(input.RecentEvidence))
		for _, item := range input.RecentEvidence {
			if !item.OccurredAt.IsZero() && item.OccurredAt.UnixMilli() > 0 {
				evidence = append(evidence, item)
			}
		}
		sort.SliceStable(evidence, func(i, j int) bool { return evidence[i].OccurredAt.Before(evidence[j].OccurredAt) })
		row.Trend = "stable"
		if len(evidence) >= 2 {
			first, last := boundedMastery(evidence[0].Mastery), boundedMastery(evidence[len(evidence)-1].Mastery)
			if last > first {
				row.Trend = "improving"
			} else if last < first {
				row.Trend = "declining"
			}
		}
		score := 100 - row.Mastery
		switch row.Status {
		case "weak":
			score += 30
		case "average":
			score += 15
		}
		switch row.Trend {
		case "declining":
			score += 18
		case "improving":
			score -= 6
		}
		if row.EvidenceCount < 3 {
			score += 12
		}
		if !row.LastEvidenceAt.IsZero() && row.LastEvidenceAt.UnixMilli() > 0 {
			score += math.Min(10, math.Max(0, now.Sub(row.LastEvidenceAt).Hours()/24/14))
		}
		switch {
		case row.EvidenceCount < 3:
			row.Action = "measure"
			row.RecommendedAction = "قياس المهارة لاستكمال الأدلة"
		case row.Mastery >= 80:
			row.Action = "mastery_review"
			row.RecommendedAction = "مراجعة الإتقان"
		case row.Mastery < 50 || row.Trend == "declining":
			row.Action = "alternate_support_then_recheck"
			row.RecommendedAction = "دعم بديل ثم إعادة القياس"
		default:
			row.Action = "remediation_then_recheck"
			row.RecommendedAction = "تدريب علاجي ثم إعادة القياس"
		}
		ranked = append(ranked, candidate{row, score})
	}
	sort.SliceStable(ranked, func(i, j int) bool { return ranked[i].score > ranked[j].score })
	out := make([]SkillProgress, 0, min(4, len(ranked)))
	for _, item := range ranked[:min(4, len(ranked))] {
		out = append(out, item.row)
	}
	return out
}
