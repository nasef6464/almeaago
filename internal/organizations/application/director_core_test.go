package application

import (
	"context"
	"errors"
	"testing"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func schoolAdminActor() identity.User {
	return identity.User{
		ID:     "director-1",
		Status: "active",
		Roles:  []identity.Role{identity.RoleSchoolAdmin},
	}
}

func TestDirectorStudentsPreservesLegacy500Limit(t *testing.T) {
	repo := &repositoryMock{permissionAllowed: true}
	service := NewService(repo, repo)

	page, err := service.DirectorStudents(
		context.Background(),
		schoolAdminActor(),
		"school-1",
		org.DirectorStudentQuery{Limit: 500},
	)
	if err != nil {
		t.Fatal(err)
	}
	if page.Limit != 500 {
		t.Fatalf("expected legacy 500 limit, got %d", page.Limit)
	}
}

func TestDirectorStudentsRequirePermission(t *testing.T) {
	repo := &repositoryMock{permissionAllowed: false}
	service := NewService(repo, repo)

	_, err := service.DirectorStudents(
		context.Background(),
		schoolAdminActor(),
		"school-1",
		org.DirectorStudentQuery{},
	)
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
}

func TestDirectorTeacherWorkspaceRequiresAssignPermission(t *testing.T) {
	repo := &repositoryMock{permissionAllowed: false}
	service := NewService(repo, repo)

	_, err := service.DirectorTeachers(
		context.Background(),
		schoolAdminActor(),
		"school-1",
	)
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
}

func TestDirectorOverviewAccessRequiresSchoolAdminRole(t *testing.T) {
	repo := &repositoryMock{permissionAllowed: true}
	service := NewService(repo, repo)

	err := service.DirectorOverviewAccess(
		context.Background(),
		actor("teacher-1", identity.RoleTeacher),
		"school-1",
	)
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
}

func TestDirectorOverviewReturnsScopedSixMetricsOnlyWhenPermitted(t *testing.T) {
	const school = "00000000-0000-0000-0000-000000000101"
	repo := &repositoryMock{
		permissionAllowed: true,
		allowedSchoolID:   school,
		directorOverview: org.DirectorOverview{
			School:  org.DirectorOverviewSchool{SchoolID: school, SchoolName: "مدرسة المئة"},
			Metrics: org.DirectorOverviewMetrics{Students: 12, Classes: 3, Teachers: 2, Supervisors: 1, SchoolAssessments: 5, CompletedSmartClasses: 4},
		},
	}
	service := NewService(repo, repo)
	got, err := service.DirectorOverview(context.Background(), schoolAdminActor(), school)
	if err != nil || got.Metrics.SchoolAssessments != 5 || got.Metrics.CompletedSmartClasses != 4 || repo.lastDirectorOverviewSchool != school {
		t.Fatalf("authorized director did not receive scoped overview: %+v error=%v", got, err)
	}
	if _, err := service.DirectorOverview(context.Background(), schoolAdminActor(), "00000000-0000-0000-0000-000000000102"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("cross-school request must be rejected: %v", err)
	}
	if repo.lastDirectorOverviewSchool != school {
		t.Fatalf("denied request reached directory: %s", repo.lastDirectorOverviewSchool)
	}
	if _, err := service.DirectorOverview(context.Background(), actor("teacher-1", identity.RoleTeacher), school); !errors.Is(err, ErrForbidden) {
		t.Fatalf("teacher must be denied even if permissions are configured: %v", err)
	}
	repo.permissionAllowed = false
	if _, err := service.DirectorOverview(context.Background(), schoolAdminActor(), school); !errors.Is(err, ErrForbidden) {
		t.Fatalf("school admin without overview permission must be denied: %v", err)
	}
	repo.permissionAllowed = true
	if _, err := service.DirectorOverview(context.Background(), schoolAdminActor(), " "); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("empty school ID must fail input validation: %v", err)
	}
	if _, err := service.DirectorOverview(context.Background(), schoolAdminActor(), "not-a-school-uuid"); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("malformed school ID must fail before database authorization: %v", err)
	}
}

func TestDirectorAssessmentCapabilityRequiresRolePermissionAndActiveModule(t *testing.T) {
	const schoolA = "00000000-0000-0000-0000-000000000101"
	const schoolB = "00000000-0000-0000-0000-000000000102"
	allowed := org.SchoolContext{
		SchoolID:    schoolA,
		Role:        identity.RoleSchoolAdmin,
		Permissions: []string{org.PermissionSchoolAssessmentsManage},
		Modules:     []string{string(org.ModuleSchoolAssessments)},
	}
	tests := []struct {
		name     string
		actor    identity.User
		contexts []org.SchoolContext
		schoolID string
		want     error
	}{
		{name: "permission and active module", actor: schoolAdminActor(), contexts: []org.SchoolContext{allowed}, schoolID: schoolA},
		{name: "different school", actor: schoolAdminActor(), contexts: []org.SchoolContext{allowed}, schoolID: schoolB, want: ErrForbidden},
		{name: "missing membership", actor: schoolAdminActor(), schoolID: schoolA, want: ErrForbidden},
		{name: "wrong role", actor: actor("teacher-1", identity.RoleTeacher), contexts: []org.SchoolContext{allowed}, schoolID: schoolA, want: ErrForbidden},
		{name: "missing permission", actor: schoolAdminActor(), contexts: []org.SchoolContext{{SchoolID: schoolA, Role: identity.RoleSchoolAdmin, Modules: []string{string(org.ModuleSchoolAssessments)}}}, schoolID: schoolA, want: ErrForbidden},
		{name: "expired contract", actor: schoolAdminActor(), contexts: []org.SchoolContext{{SchoolID: schoolA, Role: identity.RoleSchoolAdmin, Permissions: []string{org.PermissionSchoolAssessmentsManage}}}, schoolID: schoolA, want: ErrForbidden},
		{name: "stale student membership", actor: schoolAdminActor(), contexts: []org.SchoolContext{{SchoolID: schoolA, Role: identity.RoleStudent, Permissions: allowed.Permissions, Modules: allowed.Modules}}, schoolID: schoolA, want: ErrForbidden},
		{name: "bad school id", actor: schoolAdminActor(), contexts: []org.SchoolContext{allowed}, schoolID: "not-a-uuid", want: ErrInvalidInput},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := NewService(&repositoryMock{contexts: tt.contexts})
			err := service.requireDirectorCapability(context.Background(), tt.actor, tt.schoolID, org.PermissionSchoolAssessmentsManage, org.ModuleSchoolAssessments)
			if tt.want == nil && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tt.want != nil && !errors.Is(err, tt.want) {
				t.Fatalf("expected %v, got %v", tt.want, err)
			}
		})
	}
}

func TestDirectorAcademicAssessmentsDelegatesOnlyAfterExactSchoolCapability(t *testing.T) {
	const schoolA = "00000000-0000-0000-0000-000000000101"
	const schoolB = "00000000-0000-0000-0000-000000000102"
	ctx := org.SchoolContext{
		SchoolID: schoolA, Role: identity.RoleSchoolAdmin,
		Permissions: []string{org.PermissionSchoolAssessmentsManage},
		Modules:     []string{string(org.ModuleSchoolAssessments)},
	}
	repo := &repositoryMock{contexts: []org.SchoolContext{ctx}}
	service := NewService(repo, repo)
	got, err := service.DirectorAcademicAssessments(context.Background(), schoolAdminActor(), schoolA)
	if err != nil || repo.lastDirectorAssessmentsSchool != schoolA || got.Assessments == nil {
		t.Fatalf("authorized read failed: %+v, err=%v, directory=%q", got, err, repo.lastDirectorAssessmentsSchool)
	}
	if _, err := service.DirectorAcademicAssessments(context.Background(), schoolAdminActor(), schoolB); !errors.Is(err, ErrForbidden) {
		t.Fatalf("cross-school read was not denied: %v", err)
	}
	if repo.lastDirectorAssessmentsSchool != schoolA {
		t.Fatalf("denied read reached database: %s", repo.lastDirectorAssessmentsSchool)
	}
	repo.contexts[0].Modules = nil
	if _, err := service.DirectorAcademicAssessments(context.Background(), schoolAdminActor(), schoolA); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expired module did not deny request: %v", err)
	}
	if _, err := service.DirectorAcademicAssessments(context.Background(), schoolAdminActor(), "invalid-uuid"); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("bad UUID should fail before database request: %v", err)
	}
}
