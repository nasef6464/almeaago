package postgres

import "testing"

func TestResultSkillBand(t *testing.T) {
	for _, tc := range []struct {
		correct, total, mastery int
		status                  string
	}{
		{49, 100, 49, "weak"}, {50, 100, 50, "average"}, {59, 100, 59, "average"},
		{60, 100, 60, "average"}, {79, 100, 79, "average"}, {80, 100, 80, "strong"},
		{1, 3, 33, "weak"}, {2, 3, 67, "average"},
	} {
		mastery, status := resultSkillBand(tc.correct, tc.total)
		if mastery != tc.mastery || status != tc.status {
			t.Errorf("%d/%d: got %d %s", tc.correct, tc.total, mastery, status)
		}
	}
}
