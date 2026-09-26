package application

import (
	"context"
	"errors"
	"testing"
	"time"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

type masteryGoalRepoStub struct {
	created     learning.MasteryGoalWrite
	updated     learning.MasteryGoalPatch
	lastStudent string
	lastPath    string
	lastSubject string
	lastStatus  learning.GoalStatus
	lastPage    int
	lastLimit   int
	goal        learning.MasteryGoal
	page        learning.MasteryGoalPage
	err         error
}

func (r *masteryGoalRepoStub) CreateMasteryGoal(_ context.Context, student string, write learning.MasteryGoalWrite) (learning.MasteryGoal, error) {
	r.lastStudent, r.created = student, write
	return r.goal, r.err
}
func (r *masteryGoalRepoStub) ListMasteryGoals(_ context.Context, student, path, subject string, status learning.GoalStatus, page, limit int) (learning.MasteryGoalPage, error) {
	r.lastStudent, r.lastPath, r.lastSubject, r.lastStatus, r.lastPage, r.lastLimit = student, path, subject, status, page, limit
	return r.page, r.err
}
func (r *masteryGoalRepoStub) UpdateMasteryGoal(_ context.Context, student, _ string, patch learning.MasteryGoalPatch) (learning.MasteryGoal, error) {
	r.lastStudent, r.updated = student, patch
	return r.goal, r.err
}

type masteryTaxonomyStub struct {
	ok          bool
	lastPath    string
	lastSubject string
}

func (r *masteryTaxonomyStub) ValidateMasteryGoalScope(_ context.Context, pathID, subjectID string) (bool, error) {
	r.lastPath, r.lastSubject = pathID, subjectID
	return r.ok, nil
}

func goalStudent(id string) identity.User {
	return identity.User{ID: id, Roles: []identity.Role{identity.RoleStudent}}
}

func TestMasteryGoalCreateIsSelfOwnedScopedAndDefaultsLegacyPolicy(t *testing.T) {
	repo := &masteryGoalRepoStub{goal: learning.MasteryGoal{ID: "goal-1"}}
	taxonomy := &masteryTaxonomyStub{ok: true}
	service := NewMasteryGoalService(repo, taxonomy)

	out, err := service.Create(context.Background(), goalStudent("student-1"), learning.MasteryGoalWrite{
		PathID: " path-1 ", TargetType: learning.GoalTargetPath, TargetID: " path-1 ",
		Title: " إتقان المسار ",
	})
	if err != nil {
		t.Fatal(err)
	}
	if out.ID != "goal-1" || repo.lastStudent != "student-1" {
		t.Fatalf("unexpected owner/result: %#v %#v", out, repo)
	}
	if repo.created.TargetMastery != 90 || repo.created.Horizon != learning.GoalHorizonShort ||
		repo.created.PathID != "path-1" || repo.created.TargetID != "path-1" ||
		taxonomy.lastPath != "path-1" {
		t.Fatalf("legacy defaults/scope lost: %#v taxonomy=%#v", repo.created, taxonomy)
	}
}

func TestMasteryGoalRejectsUnmappedLegacySectionTopicTargets(t *testing.T) {
	service := NewMasteryGoalService(&masteryGoalRepoStub{}, &masteryTaxonomyStub{ok: true})
	for _, target := range []learning.GoalTargetType{learning.GoalTargetSection, learning.GoalTargetTopic} {
		_, err := service.Create(context.Background(), goalStudent("student-1"), learning.MasteryGoalWrite{
			PathID: "path-1", TargetType: target, TargetID: "legacy-target-1", Title: "هدف",
			TargetMastery: 90, Horizon: learning.GoalHorizonShort,
		})
		if !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("target %s should fail closed, got %v", target, err)
		}
	}
}

func TestMasteryGoalListIsBoundedAndExactStudentScoped(t *testing.T) {
	repo := &masteryGoalRepoStub{}
	service := NewMasteryGoalService(repo, &masteryTaxonomyStub{ok: true})
	_, err := service.List(
		context.Background(), goalStudent("student-1"), " path-1 ", " subject-1 ",
		"", 0, 500,
	)
	if err != nil {
		t.Fatal(err)
	}
	if repo.lastStudent != "student-1" || repo.lastPath != "path-1" || repo.lastSubject != "subject-1" ||
		repo.lastStatus != learning.GoalStatusActive || repo.lastPage != 1 || repo.lastLimit != 100 {
		t.Fatalf("query not bounded/scoped: %#v", repo)
	}
}

func TestMasteryGoalMutationRejectsNonStudentAndUsesOptimisticTimestamp(t *testing.T) {
	repo := &masteryGoalRepoStub{}
	service := NewMasteryGoalService(repo, &masteryTaxonomyStub{ok: true})
	teacher := identity.User{ID: "teacher-1", Roles: []identity.Role{identity.RoleTeacher}}
	if _, err := service.List(context.Background(), teacher, "path-1", "", learning.GoalStatusActive, 1, 20); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected student-only read, got %v", err)
	}

	now := time.Now().UTC()
	status := learning.GoalStatusAchieved
	if _, err := service.Update(
		context.Background(),
		goalStudent("student-1"),
		"goal-1",
		learning.MasteryGoalPatch{ExpectedUpdatedAt: now, Status: &status},
	); err != nil {
		t.Fatal(err)
	}
	if repo.updated.ExpectedUpdatedAt != now || repo.updated.Status == nil || *repo.updated.Status != learning.GoalStatusAchieved {
		t.Fatalf("optimistic update lost: %#v", repo.updated)
	}
}
