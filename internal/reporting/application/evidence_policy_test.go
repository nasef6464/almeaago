package application

import (
	"context"
	"errors"
	"testing"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	reporting "github.com/nasef6464/almeaago/internal/reporting/domain"
)

func TestClassifySkillEvidencePolicyThresholds(t *testing.T) {
	cases := []struct {
		name     string
		count    int
		mastery  float64
		expected reporting.EvidenceStatus
	}{
		{name: "zero evidence is unmeasured", count: 0, mastery: 0, expected: reporting.EvidenceUnmeasured},
		{name: "below minimum 5 answers is insufficient even at high score", count: 4, mastery: 95, expected: reporting.EvidenceInsufficient},
		{name: "5 answers below 60 is support", count: 5, mastery: 59.9, expected: reporting.EvidenceSupport},
		{name: "5 answers at 60 is developing", count: 5, mastery: 60.0, expected: reporting.EvidenceDeveloping},
		{name: "5 answers below 80 is developing", count: 5, mastery: 79.9, expected: reporting.EvidenceDeveloping},
		{name: "5 answers at 80 is ready", count: 5, mastery: 80.0, expected: reporting.EvidenceReady},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := reporting.ClassifySkillEvidence(tc.count, tc.mastery)
			if got != tc.expected {
				t.Fatalf("ClassifySkillEvidence(%d, %.1f) = %s, want %s", tc.count, tc.mastery, got, tc.expected)
			}
		})
	}
}

func TestReportingQueryValidatesSkillID(t *testing.T) {
	repo := &reportRepoStub{scope: reporting.ResolvedScope{Kind: reporting.ScopeStudent, CanDetail: true}}
	svc := NewService(repo)

	if _, err := svc.Overview(context.Background(), reportActor(identity.RoleStudent), reporting.Query{SkillID: "not-a-uuid"}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("invalid skillId must return ErrInvalidInput, got %v", err)
	}

	const validSkillID = "0199aabb-ccdd-7eee-8fff-001122334477"
	if _, err := svc.Overview(context.Background(), reportActor(identity.RoleStudent), reporting.Query{SkillID: validSkillID}); err != nil {
		t.Fatalf("valid skillId rejected: %v", err)
	}
	if repo.lastQuery.SkillID != validSkillID {
		t.Fatalf("expected repo to receive skillId=%s, got %s", validSkillID, repo.lastQuery.SkillID)
	}
}
