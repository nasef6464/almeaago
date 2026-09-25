package application

import (
	"context"
	"errors"
	"testing"

	"github.com/nasef6464/almeaago/internal/identity/domain"
	"github.com/nasef6464/almeaago/internal/platform/security"
)

func TestAdminUpsertHashesPasswordAndNormalizesScopes(t *testing.T) {
	repo := &adminRepoMock{}
	service := NewAdminService(repo, repo)

	_, err := service.UpsertUser(
		context.Background(),
		adminActor(),
		"Parent User",
		" PARENT@EXAMPLE.COM ",
		"Password123",
		domain.RoleParent,
		" school-1 ",
		[]string{" class-1 ", "class-1", "class-2"},
		[]string{" student-1 ", "student-1", "student-2"},
		nil,
		nil,
	)
	if err != nil {
		t.Fatal(err)
	}
	if repo.upsertInput.Email != "parent@example.com" {
		t.Fatalf("email was not normalized: %q", repo.upsertInput.Email)
	}
	if repo.upsertInput.PasswordHash == "Password123" {
		t.Fatal("admin-created password must never reach repository in plaintext")
	}
	if !security.VerifyPassword(repo.upsertInput.PasswordHash, "Password123") {
		t.Fatal("expected password hash to verify")
	}
	if repo.upsertInput.SchoolID != "school-1" {
		t.Fatalf("school was not normalized: %q", repo.upsertInput.SchoolID)
	}
	if len(repo.upsertInput.ClassIDs) != 2 ||
		repo.upsertInput.ClassIDs[0] != "class-1" ||
		repo.upsertInput.ClassIDs[1] != "class-2" {
		t.Fatalf("unexpected class IDs %#v", repo.upsertInput.ClassIDs)
	}
	if len(repo.upsertInput.LinkedStudentIDs) != 2 {
		t.Fatalf("unexpected linked students %#v", repo.upsertInput.LinkedStudentIDs)
	}
}

func TestAdminUpsertDropsParentLinksForNonParent(t *testing.T) {
	repo := &adminRepoMock{}
	service := NewAdminService(repo, repo)

	_, err := service.UpsertUser(
		context.Background(),
		adminActor(),
		"Student User",
		"student@example.com",
		"Password123",
		domain.RoleStudent,
		"",
		nil,
		[]string{"student-1"},
		nil,
		nil,
	)
	if err != nil {
		t.Fatal(err)
	}
	if len(repo.upsertInput.LinkedStudentIDs) != 0 {
		t.Fatalf("non-parent account must not carry parent links: %#v", repo.upsertInput.LinkedStudentIDs)
	}
}

func TestAdminUpsertRejectsInvalidIdentityFields(t *testing.T) {
	service := NewAdminService(&adminRepoMock{}, &adminRepoMock{})

	_, err := service.UpsertUser(
		context.Background(),
		adminActor(),
		"x",
		"bad-email",
		"short",
		domain.Role("root"),
		"",
		nil,
		nil,
		nil,
		nil,
	)
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
}

func TestAdminBulkStatusDeduplicatesIDs(t *testing.T) {
	repo := &adminRepoMock{}
	service := NewAdminService(repo, repo)

	_, err := service.BulkStatus(
		context.Background(),
		adminActor(),
		[]string{" user-1 ", "user-1", "user-2", ""},
		false,
	)
	if err != nil {
		t.Fatal(err)
	}
	if len(repo.bulkIDs) != 2 ||
		repo.bulkIDs[0] != "user-1" ||
		repo.bulkIDs[1] != "user-2" {
		t.Fatalf("unexpected bulk IDs %#v", repo.bulkIDs)
	}
	if repo.bulkActive {
		t.Fatal("expected disable operation")
	}
}

func TestAdminUpdateRejectsEmptyPatchAndInvalidRole(t *testing.T) {
	service := NewAdminService(&adminRepoMock{}, &adminRepoMock{})

	if _, err := service.UpdateUser(
		context.Background(),
		adminActor(),
		"user-1",
		domain.AdminUpdateUserInput{},
	); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected empty patch rejection, got %v", err)
	}

	role := domain.Role("owner")
	if _, err := service.UpdateUser(
		context.Background(),
		adminActor(),
		"user-1",
		domain.AdminUpdateUserInput{Role: &role},
	); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid role rejection, got %v", err)
	}
}

func TestAdminUpdateAcceptsScopeOnlyPatch(t *testing.T) {
	repo := &adminRepoMock{}
	service := NewAdminService(repo, repo)
	school := " school-1 "
	classes := []string{" class-1 ", "class-1"}

	if _, err := service.UpdateUser(
		context.Background(),
		adminActor(),
		"user-1",
		domain.AdminUpdateUserInput{
			SchoolID: &school,
			ClassIDs: &classes,
		},
	); err != nil {
		t.Fatal(err)
	}
	if repo.updateInput.SchoolID == nil || *repo.updateInput.SchoolID != "school-1" {
		t.Fatalf("unexpected school scope %#v", repo.updateInput.SchoolID)
	}
	if repo.updateInput.ClassIDs == nil || len(*repo.updateInput.ClassIDs) != 1 {
		t.Fatalf("unexpected class scope %#v", repo.updateInput.ClassIDs)
	}
}

func TestAdminUpsertNormalizesManagedTrainerScope(t *testing.T) {
	repo := &adminRepoMock{}
	service := NewAdminService(repo, repo)

	_, err := service.UpsertUser(
		context.Background(),
		adminActor(),
		"Trainer User",
		"trainer@example.com",
		"Password123",
		domain.RoleTeacher,
		"",
		nil,
		nil,
		[]string{" path-1 ", "path-1", "path-2"},
		[]string{" subject-1 ", "subject-1"},
	)
	if err != nil {
		t.Fatal(err)
	}
	if len(repo.upsertInput.ManagedPathIDs) != 2 ||
		repo.upsertInput.ManagedPathIDs[0] != "path-1" ||
		repo.upsertInput.ManagedPathIDs[1] != "path-2" {
		t.Fatalf("unexpected managed paths %#v", repo.upsertInput.ManagedPathIDs)
	}
	if len(repo.upsertInput.ManagedSubjectIDs) != 1 ||
		repo.upsertInput.ManagedSubjectIDs[0] != "subject-1" {
		t.Fatalf("unexpected managed subjects %#v", repo.upsertInput.ManagedSubjectIDs)
	}
}

func TestAdminUpdateAcceptsManagedScopeOnlyPatch(t *testing.T) {
	repo := &adminRepoMock{}
	service := NewAdminService(repo, repo)
	paths := []string{" path-1 ", "path-1"}
	subjects := []string{" subject-1 "}

	_, err := service.UpdateUser(
		context.Background(),
		adminActor(),
		"user-1",
		domain.AdminUpdateUserInput{
			ManagedPathIDs:    &paths,
			ManagedSubjectIDs: &subjects,
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	if repo.updateInput.ManagedPathIDs == nil ||
		len(*repo.updateInput.ManagedPathIDs) != 1 ||
		(*repo.updateInput.ManagedPathIDs)[0] != "path-1" {
		t.Fatalf("unexpected managed paths %#v", repo.updateInput.ManagedPathIDs)
	}
	if repo.updateInput.ManagedSubjectIDs == nil ||
		len(*repo.updateInput.ManagedSubjectIDs) != 1 ||
		(*repo.updateInput.ManagedSubjectIDs)[0] != "subject-1" {
		t.Fatalf("unexpected managed subjects %#v", repo.updateInput.ManagedSubjectIDs)
	}
}
