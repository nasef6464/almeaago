package application

import (
	"context"
	"errors"
	"testing"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

type stubEvidenceRepo struct {
	called bool
	query  learning.LearningEvidenceQuery
}

func (s *stubEvidenceRepo) ReadLearningEvidence(_ context.Context, _ identity.User, q learning.LearningEvidenceQuery) (learning.LearningEvidenceReport, error) {
	s.called = true
	s.query = q
	return learning.LearningEvidenceReport{
		Source:    q.Source,
		SubjectID: q.SubjectID,
		Days:      q.Days,
		Policy:    learning.DefaultLearningEvidencePolicy,
		Coverage:  "complete",
		Page:      q.Page,
		Limit:     q.Limit,
	}, nil
}

func TestLearningEvidencePolicyAndRBAC(t *testing.T) {
	// Policy classification
	if pct, st := learning.ClassifySkillEvidence(4, 4, 0); st != learning.EvidenceInsufficient || *pct != 100 {
		t.Fatalf("expected insufficient for <5 answers, got %v %v", st, pct)
	}
	if pct, st := learning.ClassifySkillEvidence(5, 2, 0); st != learning.EvidenceSupport || *pct != 40 {
		t.Fatalf("expected support for 40%%, got %v %v", st, pct)
	}
	if pct, st := learning.ClassifySkillEvidence(5, 4, 0); st != learning.EvidenceReady || *pct != 80 {
		t.Fatalf("expected ready for 80%%, got %v %v", st, pct)
	}
	if pct, st := learning.ClassifySkillEvidence(5, 3, 1); st != learning.EvidenceInsufficient || pct != nil {
		t.Fatalf("expected nil accuracy and insufficient when incomplete > 0, got %v %v", st, pct)
	}

	// Student classification
	if st := learning.ClassifyStudentEvidence(nil); st != learning.EvidenceUnmeasured {
		t.Fatalf("expected unmeasured for empty skills, got %v", st)
	}
	if st := learning.ClassifyStudentEvidence([]learning.LearningEvidenceSkill{{Status: learning.EvidenceReady}, {Status: learning.EvidenceSupport}}); st != learning.EvidenceSupport {
		t.Fatalf("expected support when any skill needs support, got %v", st)
	}
	if st := learning.ClassifyStudentEvidence([]learning.LearningEvidenceSkill{{Status: learning.EvidenceReady}, {Status: learning.EvidenceReady}}); st != learning.EvidenceReady {
		t.Fatalf("expected ready when all ready, got %v", st)
	}

	// RBAC & validation
	repo := &stubEvidenceRepo{}
	svc := NewEvidenceService(repo)
	student := identity.User{ID: "st-1", Roles: []identity.Role{identity.RoleStudent}}
	teacher := identity.User{ID: "t-1", Roles: []identity.Role{identity.RoleTeacher}}

	if _, err := svc.Read(context.Background(), student, learning.LearningEvidenceQuery{Source: "school_assessment", SubjectID: "sub-1"}); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected ErrForbidden for student, got %v", err)
	}
	if _, err := svc.Read(context.Background(), teacher, learning.LearningEvidenceQuery{Source: "invalid", SubjectID: "sub-1"}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput for bad source, got %v", err)
	}
	out, err := svc.Read(context.Background(), teacher, learning.LearningEvidenceQuery{Source: "school_assessment", SubjectID: "sub-1"})
	if err != nil || !repo.called || out.Days != 90 || out.Limit != 12 {
		t.Fatalf("expected valid call with defaults 90/12, got out=%+v err=%v", out, err)
	}
}
