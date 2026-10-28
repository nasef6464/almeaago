package domain

import (
	"encoding/json"
	"fmt"
	"os"
	"testing"
)

// Expectations come from executing pinned Legacy TypeScript, not Go helpers.
func TestLegacySkillPolicyGolden(t *testing.T) {
	data, err := os.ReadFile("testdata/legacy_learning_golden.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Cases []struct {
			Mastery        float64
			Attempts       int
			Status, Action string
		}
	}
	if err = json.Unmarshal(data, &fixture); err != nil {
		t.Fatal(err)
	}
	if len(fixture.Cases) == 0 {
		t.Fatal("source oracle has no cases")
	}
	for _, c := range fixture.Cases {
		t.Run(fmt.Sprintf("mastery=%g/attempts=%d", c.Mastery, c.Attempts), func(t *testing.T) {
			if got := SkillStatus(c.Mastery); got != c.Status {
				t.Errorf("status got %q want Legacy %q", got, c.Status)
			}
			if got := RecommendedAction(c.Mastery, c.Attempts); got != c.Action {
				t.Errorf("action got %q want Legacy %q", got, c.Action)
			}
		})
	}
}
