package postgres

import (
	"testing"

	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func TestDirectorAssessmentFingerprintIncludesExplicitLearnerTargets(t *testing.T) {
	first := org.DirectorAssessmentCreate{Title: "اختبار", TargetScope: "selected", ClassIDs: []string{"00000000-0000-0000-0000-000000000100"}, StudentIDs: []string{"00000000-0000-0000-0000-000000000201"}, PathID: "path", SubjectID: "subject", QuestionIDs: []string{"question"}}
	next := first
	next.StudentIDs = []string{"00000000-0000-0000-0000-000000000202"}
	a, err := directorAssessmentFingerprint(first)
	if err != nil {
		t.Fatal(err)
	}
	b, err := directorAssessmentFingerprint(next)
	if err != nil {
		t.Fatal(err)
	}
	if a == b {
		t.Fatal("different explicitly targeted learners must never share an idempotency fingerprint")
	}
}
