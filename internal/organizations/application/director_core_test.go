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
