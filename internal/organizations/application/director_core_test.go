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
