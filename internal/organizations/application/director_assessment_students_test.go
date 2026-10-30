package application

import (
	"context"
	"errors"
	"testing"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func TestDirectorAssessmentEligibleStudentsRequiresDirectorScope(t *testing.T) {
	const school = "00000000-0000-0000-0000-000000000101"
	permitted := org.SchoolContext{SchoolID: school, Role: identity.RoleSchoolAdmin, Permissions: []string{org.PermissionSchoolAssessmentsManage}, Modules: []string{string(org.ModuleSchoolAssessments)}}
	tests := []struct {
		name        string
		contexts    []org.SchoolContext
		actor       identity.User
		search      string
		page, limit int
		want        error
		called      bool
	}{
		{"authorized", []org.SchoolContext{permitted}, schoolAdminActor(), " علي ", 1, 20, nil, true},
		{"teacher denied", []org.SchoolContext{permitted}, actor("teacher", identity.RoleTeacher), "", 1, 20, ErrForbidden, false},
		{"missing module", []org.SchoolContext{{SchoolID: school, Role: identity.RoleSchoolAdmin, Permissions: permitted.Permissions}}, schoolAdminActor(), "", 1, 20, ErrForbidden, false},
		{"missing permission", []org.SchoolContext{{SchoolID: school, Role: identity.RoleSchoolAdmin, Modules: permitted.Modules}}, schoolAdminActor(), "", 1, 20, ErrForbidden, false},
		{"huge page", []org.SchoolContext{permitted}, schoolAdminActor(), "", 10001, 20, ErrInvalidInput, false},
		{"huge limit", []org.SchoolContext{permitted}, schoolAdminActor(), "", 1, 1000, ErrInvalidInput, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &repositoryMock{contexts: tt.contexts}
			service := NewService(repo, repo)
			_, err := service.DirectorAssessmentEligibleStudents(context.Background(), tt.actor, school, tt.search, tt.page, tt.limit)
			if !errors.Is(err, tt.want) {
				t.Fatalf("want %v got %v", tt.want, err)
			}
			if repo.lastEligibleStudentsCalled != tt.called {
				t.Fatalf("unexpected repository call %v", repo.lastEligibleStudentsCalled)
			}
			if tt.called && repo.lastEligibleStudentsSearch != "علي" {
				t.Fatalf("search not normalized: %q", repo.lastEligibleStudentsSearch)
			}
		})
	}
}
