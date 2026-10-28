package application

import (
	"context"
	"errors"
	"testing"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func schoolDefinitionContext(schoolID string) org.SchoolContext {
	return org.SchoolContext{SchoolID: schoolID, Role: identity.RoleSchoolAdmin,
		Permissions: []string{org.PermissionSchoolAssessmentsManage},
		Modules:     []string{string(org.ModuleSchoolAssessments)}}
}

func TestDirectorAssessmentDefinitionRequiresManagePermissionAndValidScope(t *testing.T) {
	const school = "00000000-0000-0000-0000-000000000101"
	const assessment = "00000000-0000-0000-0000-000000000202"
	repo := &repositoryMock{contexts: []org.SchoolContext{schoolDefinitionContext(school)}}
	svc := NewService(repo)
	for _, pair := range [][2]string{{"bad", assessment}, {school, "bad"}} {
		if _, err := svc.DirectorAssessmentDefinition(context.Background(), schoolAdminActor(), pair[0], pair[1]); !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("invalid school/assessment IDs must be rejected, got %v", err)
		}
	}
	if repo.definitionCallCount != 0 {
		t.Fatalf("invalid input reached repository: %d", repo.definitionCallCount)
	}
	if _, err := svc.DirectorAssessmentDefinition(context.Background(), schoolAdminActor(), school, assessment); err != nil {
		t.Fatalf("authorized school director should read managed definition: %v", err)
	}
	if repo.definitionCallCount != 1 || repo.lastDefinitionSchool != school || repo.lastDefinitionAssessment != assessment {
		t.Fatalf("wrong school definition repository scope: %+v", repo)
	}
	repo.contexts[0].Permissions = []string{org.PermissionSchoolReportsAggregateView}
	if _, err := svc.DirectorAssessmentDefinition(context.Background(), schoolAdminActor(), school, assessment); !errors.Is(err, ErrForbidden) {
		t.Fatalf("revoked school capability must deny definition: %v", err)
	}
	if repo.definitionCallCount != 1 {
		t.Fatal("revoked permission reached definition repository")
	}
}

func TestDirectorAssessmentDefinitionHasSafePublishedReadContract(t *testing.T) {
	const school = "00000000-0000-0000-0000-000000000101"
	const assessment = "00000000-0000-0000-0000-000000000202"
	repo := &repositoryMock{contexts: []org.SchoolContext{schoolDefinitionContext(school)}}
	def, err := NewService(repo).DirectorAssessmentDefinition(context.Background(), schoolAdminActor(), school, assessment)
	if err != nil {
		t.Fatal(err)
	}
	if def.AssessmentID != assessment || !def.CanManage || def.CanClone || def.CanEditContent || !def.IsPublished {
		t.Fatalf("published school assessment must be reviewable without claiming unimplemented clone/edit commands: %+v", def)
	}
	if len(def.QuestionIDs) != 1 || def.QuestionIDs[0] != "00000000-0000-0000-0000-000000000303" {
		t.Fatalf("definition should contain exact pinned question IDs: %+v", def)
	}
	if def.TargetScope != "classes" || len(def.ClassIDs) != 2 || len(def.StudentIDs) != 0 || def.Settings.MaxAttempts == nil || *def.Settings.MaxAttempts != 3 {
		t.Fatalf("definition lost persisted target/settings data: %+v", def)
	}
}
