package application

import (
	"context"
	"errors"
	"testing"
	"time"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

type interventionRepoStub struct {
	created  learning.SchoolIntervention
	current  learning.SchoolIntervention
	page     learning.InterventionPage
	baseline learning.InterventionEvidence
	outcome  learning.InterventionEvidence
}

func (r *interventionRepoStub) InterventionEvidenceSnapshot(_ context.Context, _ string, _ string, _ string, _ string, since *time.Time) (learning.InterventionEvidence, error) {
	if since == nil {
		return r.baseline, nil
	}
	return r.outcome, nil
}
func (r *interventionRepoStub) CreateSchoolIntervention(context.Context, string, learning.InterventionCreate, learning.StudyPlanWrite, []learning.StudyPlanItemSeed, learning.InterventionEvidence) (learning.SchoolIntervention, error) {
	return r.created, nil
}
func (r *interventionRepoStub) ListSchoolInterventions(context.Context, string, string, learning.InterventionStatus, int, int) (learning.InterventionPage, error) {
	return r.page, nil
}
func (r *interventionRepoStub) GetSchoolIntervention(context.Context, string) (learning.SchoolIntervention, error) {
	return r.current, nil
}
func (r *interventionRepoStub) PatchSchoolIntervention(context.Context, string, string, learning.InterventionPatch) (learning.SchoolIntervention, error) {
	return r.current, nil
}
func (r *interventionRepoStub) MeasureSchoolIntervention(context.Context, string, string, time.Time, learning.InterventionEvidence) (learning.SchoolIntervention, error) {
	x := r.current
	x.Outcome = &r.outcome
	return x, nil
}
func (r *interventionRepoStub) ListStudentInterventions(context.Context, string, learning.InterventionStatus, int, int) (learning.InterventionPage, error) {
	return r.page, nil
}

type interventionOrgStub struct{ manage, view, student bool }

func (o interventionOrgStub) CanManageLearningIntervention(context.Context, string, string, string) (bool, error) {
	return o.manage, nil
}
func (o interventionOrgStub) CanViewLearningInterventions(context.Context, string, string, string) (bool, error) {
	return o.view, nil
}
func (o interventionOrgStub) ValidateLearningInterventionStudent(context.Context, string, string, string) (bool, error) {
	return o.student, nil
}

type interventionTaxonomyStub struct{ ok bool }

func (t interventionTaxonomyStub) ValidateLearningInterventionSkill(context.Context, string, string, string) (bool, error) {
	return t.ok, nil
}

func interventionActor(role identity.Role) identity.User {
	return identity.User{ID: "actor-1", Roles: []identity.Role{role}}
}

func TestInterventionSupervisorListRequiresExactClass(t *testing.T) {
	s := NewInterventionService(&interventionRepoStub{}, interventionOrgStub{view: true}, interventionTaxonomyStub{ok: true}, nil)
	_, err := s.List(context.Background(), interventionActor(identity.RoleSupervisor), "school-1", "", learning.InterventionActive, 1, 20)
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("want exact class requirement, got %v", err)
	}
}

func TestInterventionCreateRejectsStudentOutsideClassBeforePlan(t *testing.T) {
	s := NewInterventionService(&interventionRepoStub{}, interventionOrgStub{manage: true, student: false}, interventionTaxonomyStub{ok: true}, nil)
	_, err := s.Create(context.Background(), interventionActor(identity.RoleSchoolAdmin), learning.InterventionCreate{
		SchoolID: "school-1", ClassID: "class-1", StudentID: "student-1", PathID: "path-1", SubjectID: "subject-1", SkillID: "skill-1",
	})
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("want forbidden, got %v", err)
	}
}

func TestInterventionMeasureNeedsMinimumEvidenceForMeasuredConfidence(t *testing.T) {
	accBase := 40.0
	accOutcome := 70.0
	now := time.Now().UTC()
	repo := &interventionRepoStub{
		current: learning.SchoolIntervention{ID: "i-1", SchoolID: "school-1", ClassID: "class-1", StudentID: "student-1", PathID: "path-1", SubjectID: "subject-1", SkillID: "skill-1", MinimumEvidence: 3, Baseline: learning.InterventionEvidence{EvidenceCount: 5, Correct: 2, Accuracy: &accBase}, CreatedAt: now.Add(-48 * time.Hour), UpdatedAt: now},
		outcome: learning.InterventionEvidence{EvidenceCount: 3, Correct: 2, Accuracy: &accOutcome},
	}
	s := NewInterventionService(repo, interventionOrgStub{manage: true}, interventionTaxonomyStub{ok: true}, nil)
	out, err := s.Measure(context.Background(), interventionActor(identity.RoleSchoolAdmin), "i-1", now)
	if err != nil {
		t.Fatal(err)
	}
	if out.Confidence != "measured" || out.Delta == nil || *out.Delta != 30 {
		t.Fatalf("unexpected outcome: %#v", out)
	}
}
