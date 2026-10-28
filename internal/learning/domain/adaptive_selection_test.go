package domain

import (
	"encoding/json"
	"os"
	"testing"
	"time"
)

func TestAdaptiveSelectionSourceGolden(t *testing.T) {
	var fixture struct {
		Now   time.Time
		Cases []struct {
			Name  string
			Scope struct{ PathID, SubjectID string }
			Rows  []struct {
				SkillID, PathID, SubjectID, Status, LastAttemptAt string
				Mastery                                           float64
				EvidenceCount, Attempts                           int
				RecentEvidence                                    []struct {
					Mastery    float64
					OccurredAt string
				}
			}
			Expected []struct {
				SkillID, Action, Trend string
				Mastery                float64
				EvidenceCount          int
			}
		}
	}
	bytes, err := os.ReadFile("testdata/adaptive_selection_golden.json")
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(bytes, &fixture); err != nil {
		t.Fatal(err)
	}
	for _, c := range fixture.Cases {
		t.Run(c.Name, func(t *testing.T) {
			rows := make([]AdaptiveProgress, 0, len(c.Rows))
			for _, r := range c.Rows {
				last, _ := time.Parse(time.RFC3339, r.LastAttemptAt)
				if last.IsZero() {
					last, _ = time.Parse("2006-01-02", r.LastAttemptAt)
				}
				item := AdaptiveProgress{SkillProgress: SkillProgress{SkillID: r.SkillID, PathID: r.PathID, SubjectID: r.SubjectID, Mastery: r.Mastery, Status: r.Status, EvidenceCount: r.EvidenceCount, Attempts: r.Attempts, LastEvidenceAt: last}}
				for _, e := range r.RecentEvidence {
					at, _ := time.Parse(time.RFC3339, e.OccurredAt)
					if at.IsZero() {
						at, _ = time.Parse("2006-01-02", e.OccurredAt)
					}
					item.RecentEvidence = append(item.RecentEvidence, AdaptiveEvidence{Mastery: e.Mastery, OccurredAt: at})
				}
				rows = append(rows, item)
			}
			got := RankAdaptiveProgress(rows, c.Scope.PathID, c.Scope.SubjectID, fixture.Now)
			if len(got) != len(c.Expected) {
				t.Fatalf("candidates=%d want %d", len(got), len(c.Expected))
			}
			for i, want := range c.Expected {
				r := got[i]
				if r.SkillID != want.SkillID || r.Action != want.Action || r.Trend != want.Trend || r.Mastery != want.Mastery || r.EvidenceCount != want.EvidenceCount {
					t.Fatalf("candidate %d: %+v want %+v", i, r, want)
				}
			}
		})
	}
}
