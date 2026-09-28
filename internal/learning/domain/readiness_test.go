package domain

import (
	"testing"
	"time"
)

func TestMasteryReadinessFromEvidence(t *testing.T) {
	now := time.Date(2026, 9, 28, 0, 0, 0, 0, time.UTC)
	r := MasteryReadinessFrom([]SkillProgress{{Mastery: 90, EvidenceCount: 3, LastEvidenceAt: now}, {Mastery: 70, EvidenceCount: 3, LastEvidenceAt: now}}, now)
	if r.TotalSkills != 2 || r.ReliableSkills != 2 || r.TotalEvidence != 6 {
		t.Fatalf("bad evidence summary: %+v", r)
	}
	if r.Mastery != 80 || r.Coverage != 1 || r.EvidenceConfidence != 1 {
		t.Fatalf("bad readiness inputs: %+v", r)
	}
	if r.Status != "ready_to_advance" || r.Score != 89 {
		t.Fatalf("bad readiness decision: %+v", r)
	}
}

func TestMasteryReadinessNeedsMeasurement(t *testing.T) {
	r := MasteryReadinessFrom([]SkillProgress{{Mastery: 95, EvidenceCount: 1}}, time.Now())
	if r.Status != "needs_measurement" {
		t.Fatalf("insufficient evidence must not advance: %+v", r)
	}
}
