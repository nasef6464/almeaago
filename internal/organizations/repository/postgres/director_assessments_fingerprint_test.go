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

func TestDirectorAssessmentFingerprintDistinguishesSettings(t *testing.T) {
	base := org.DirectorAssessmentCreate{Title: "اختبار", TargetScope: "school", PathID: "path", SubjectID: "subject", QuestionIDs: []string{"question"}}
	unlimited := 0
	short := 15
	a, b := base, base
	a.Settings = &org.DirectorAssessmentSettings{TimeLimitMinutes: &unlimited}
	b.Settings = &org.DirectorAssessmentSettings{TimeLimitMinutes: &short}
	ha, _ := directorAssessmentFingerprint(a)
	hb, _ := directorAssessmentFingerprint(b)
	if ha == hb {
		t.Fatal("changing exam duration must invalidate old idempotency key")
	}
	legacy, _ := directorAssessmentFingerprint(base)
	if legacy == ha {
		t.Fatal("explicit custom settings must have distinct fingerprint")
	}
}
