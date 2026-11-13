package postgres

import (
	"testing"
	"time"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

func TestResolveStrictSectionProgress(t *testing.T) {
	start := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	first, second := 60, 120
	sections := []assessment.Section{{ID: "a", TimeLimitSeconds: &first}, {ID: "b", TimeLimitSeconds: &second}}
	current, err := resolveStrictSectionProgress(sections, nil, start, start.Add(30*time.Second))
	if err != nil || current.CurrentSectionID != "a" || current.Deadline == nil || !current.Deadline.Equal(start.Add(time.Minute)) {
		t.Fatalf("initial: %+v %v", current, err)
	}
	current, err = resolveStrictSectionProgress(sections, nil, start, start.Add(70*time.Second))
	if err != nil || current.CurrentSectionID != "b" || !current.StartedAt.Equal(start.Add(time.Minute)) {
		t.Fatalf("expired moves to next without resetting time: %+v %v", current, err)
	}
	current, err = resolveStrictSectionProgress(sections, nil, start, start.Add(181*time.Second))
	if err != nil || !current.Finished || current.CurrentSectionID != "" {
		t.Fatalf("all expired: %+v %v", current, err)
	}
	bad := &strictSectionState{CurrentSectionID: "unknown", StartedAt: start}
	if _, err = resolveStrictSectionProgress(sections, bad, start, start); err == nil {
		t.Fatal("unknown stored section must fail closed")
	}
}
