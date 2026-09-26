package postgres

import (
	"testing"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

func intPtr(v int) *int { return &v }

func TestApplyReviewPolicyHidesPrivateAnswerAndExplanation(t *testing.T) {
	q := assessment.ReviewQuestion{}
	applyReviewPolicy(&q, intPtr(2), "explanation", "hint", "strategy", false, false)

	if q.CorrectOptionIndex != nil {
		t.Fatalf("correct answer leaked: %v", *q.CorrectOptionIndex)
	}
	if q.Explanation != "" || q.Hint != "" || q.SolvingStrategy != "" {
		t.Fatalf("private explanation fields leaked: %#v", q)
	}
}

func TestApplyReviewPolicyAllowsConfiguredFields(t *testing.T) {
	q := assessment.ReviewQuestion{}
	applyReviewPolicy(&q, intPtr(2), "explanation", "hint", "strategy", true, true)

	if q.CorrectOptionIndex == nil || *q.CorrectOptionIndex != 2 {
		t.Fatalf("expected configured correct answer, got %#v", q.CorrectOptionIndex)
	}
	if q.Explanation != "explanation" || q.Hint != "hint" || q.SolvingStrategy != "strategy" {
		t.Fatalf("expected configured explanations, got %#v", q)
	}
}
