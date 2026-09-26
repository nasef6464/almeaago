package domain

import (
	"testing"
	"time"
)

func TestSkillStatusThresholdsMatchLegacyPolicy(t *testing.T) {
	cases := []struct {
		mastery float64
		want    string
	}{
		{49.9, "weak"},
		{50, "average"},
		{74.9, "average"},
		{75, "good"},
		{89.9, "good"},
		{90, "mastered"},
	}
	for _, tc := range cases {
		if got := SkillStatus(tc.mastery); got != tc.want {
			t.Fatalf("mastery %.1f: want %s got %s", tc.mastery, tc.want, got)
		}
	}
}

func TestRecommendedActionUsesDeterministicLegacyBands(t *testing.T) {
	if got := RecommendedAction(40, 1); got != "خطة علاج عاجلة: شرح + تدريب + اختبار موجه" {
		t.Fatalf("weak action mismatch: %q", got)
	}
	if got := RecommendedAction(55, 2); got != "إضافة تدريب قصير ومتابعة الأداء" {
		t.Fatalf("developing action mismatch: %q", got)
	}
	if got := RecommendedAction(55, 3); got != "زيادة التدريب ثم اختبار ساهر علاجي" {
		t.Fatalf("repeated weak action mismatch: %q", got)
	}
	if got := RecommendedAction(75, 1); got != "تثبيت المهارة بتدريب خفيف وإعادة قياس لاحقًا" {
		t.Fatalf("good action mismatch: %q", got)
	}
}

func TestSM2InitialEvidenceScheduling(t *testing.T) {
	now := time.Date(2026, 9, 26, 3, 0, 0, 0, time.UTC)
	correct := SM2(SM2Card{EaseFactor: 2.5, Interval: 1}, 4, now)
	if correct.Repetitions != 1 || correct.Interval != 1 || correct.EaseFactor != 2.5 {
		t.Fatalf("correct schedule mismatch: %#v", correct)
	}
	if !correct.NextReview.Equal(now.Add(24 * time.Hour)) {
		t.Fatalf("correct due mismatch: %s", correct.NextReview)
	}
	wrong := SM2(SM2Card{EaseFactor: 2.5, Interval: 1}, 2, now)
	if wrong.Repetitions != 0 || wrong.Interval != 1 {
		t.Fatalf("wrong schedule mismatch: %#v", wrong)
	}
}
