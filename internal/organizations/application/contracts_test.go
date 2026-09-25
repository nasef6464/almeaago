package application

import (
	"context"
	"errors"
	"testing"
	"time"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func TestUpsertSchoolContractNormalizesModules(t *testing.T) {
	repo := &repositoryMock{}
	service := NewService(repo)
	admin := actor("admin-1", identity.RoleAdmin)

	_, err := service.UpsertSchoolContract(
		context.Background(),
		admin,
		"school-1",
		UpsertSchoolContractInput{
			Status: org.SchoolContractStatusActive,
			Modules: []org.SchoolModule{
				org.SchoolModuleSmartClassroom,
				org.SchoolModuleCore,
				org.SchoolModuleCore,
			},
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	if len(repo.contractWrite.Modules) != 2 {
		t.Fatalf("expected duplicate modules to be removed, got %#v", repo.contractWrite.Modules)
	}
	if repo.contractWrite.Modules[0] != org.SchoolModuleCore ||
		repo.contractWrite.Modules[1] != org.SchoolModuleSmartClassroom {
		t.Fatalf("expected stable sorted modules, got %#v", repo.contractWrite.Modules)
	}
}

func TestUpsertSchoolContractRejectsInvalidValidityRange(t *testing.T) {
	repo := &repositoryMock{}
	service := NewService(repo)
	admin := actor("admin-1", identity.RoleAdmin)
	start := time.Date(2026, 10, 10, 0, 0, 0, 0, time.UTC)
	end := start.Add(-24 * time.Hour)

	_, err := service.UpsertSchoolContract(
		context.Background(),
		admin,
		"school-1",
		UpsertSchoolContractInput{
			Status:     org.SchoolContractStatusActive,
			Modules:    []org.SchoolModule{org.SchoolModuleCore},
			ValidFrom:  &start,
			ValidUntil: &end,
		},
	)
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
}

func TestMissingSchoolContractReturnsDeniedEntitlement(t *testing.T) {
	repo := &repositoryMock{accessAllowed: true}
	service := NewService(repo)
	director := actor("director-1", identity.RoleSchoolAdmin)

	entitlement, err := service.ResolveSchoolEntitlement(
		context.Background(),
		director,
		"school-1",
		org.SchoolModuleCore,
	)
	if err != nil {
		t.Fatal(err)
	}
	if entitlement.Allowed || entitlement.Contract != nil {
		t.Fatalf("expected missing contract to deny access, got %#v", entitlement)
	}
}

func TestDirectorCapabilityRequiresPermissionAndModule(t *testing.T) {
	repo := &repositoryMock{
		permissionAllowed: true,
		moduleDenied:      true,
	}
	service := NewService(repo, repo)
	director := actor("director-1", identity.RoleSchoolAdmin)
	name := "Updated Student"

	_, err := service.DirectorUpdateStudentBasic(
		context.Background(),
		director,
		"school-1",
		"student-1",
		org.DirectorStudentBasicPatch{Name: &name},
	)
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected module denial, got %v", err)
	}
}
