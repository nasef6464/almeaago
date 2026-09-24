package application

import (
	"context"
	"errors"
	"testing"

	"github.com/nasef6464/almeaago/internal/identity/domain"
	"github.com/nasef6464/almeaago/internal/platform/security"
)

type adminRepoMock struct {
	lastQuery      domain.AdminUserQuery
	listPage       domain.AdminUserPage
	summary        domain.AdminUserSummary
	upsertInput    domain.AdminUpsertUserInput
	updateTargetID string
	updateInput    domain.AdminUpdateUserInput
	bulkIDs        []string
	bulkActive     bool
	deleteTargetID string
	err            error
}

func (m *adminRepoMock) AdminListUsers(
	_ context.Context,
	query domain.AdminUserQuery,
) (domain.AdminUserPage, error) {
	m.lastQuery = query
	if m.err != nil {
		return domain.AdminUserPage{}, m.err
	}
	if m.listPage.Limit == 0 {
		m.listPage = domain.AdminUserPage{Page: query.Page, Limit: query.Limit}
	}
	return m.listPage, nil
}

func (m *adminRepoMock) AdminSummary(context.Context) (domain.AdminUserSummary, error) {
	if m.err != nil {
		return domain.AdminUserSummary{}, m.err
	}
	return m.summary, nil
}

func (m *adminRepoMock) AdminUpsertUser(
	_ context.Context,
	_ string,
	input domain.AdminUpsertUserInput,
) (domain.User, error) {
	m.upsertInput = input
	if m.err != nil {
		return domain.User{}, m.err
	}
	return domain.User{
		ID:     "user-1",
		Email:  input.Email,
		Name:   input.Name,
		Status: "active",
		Roles:  []domain.Role{input.Role},
	}, nil
}

func (m *adminRepoMock) AdminUpdateUser(
	_ context.Context,
	_ string,
	targetID string,
	input domain.AdminUpdateUserInput,
) (domain.User, error) {
	m.updateTargetID = targetID
	m.updateInput = input
	if m.err != nil {
		return domain.User{}, m.err
	}
	return domain.User{ID: targetID, Status: "active"}, nil
}

func (m *adminRepoMock) AdminBulkStatus(
	_ context.Context,
	_ string,
	userIDs []string,
	active bool,
) ([]domain.AdminBulkStatusResult, error) {
	m.bulkIDs = append([]string(nil), userIDs...)
	m.bulkActive = active
	if m.err != nil {
		return nil, m.err
	}
	return []domain.AdminBulkStatusResult{{UserID: userIDs[0], Status: "updated"}}, nil
}

func (m *adminRepoMock) AdminDeleteUser(
	_ context.Context,
	_ string,
	targetID string,
) error {
	m.deleteTargetID = targetID
	return m.err
}

func adminActor() domain.User {
	return domain.User{ID: "admin-1", Status: "active", Roles: []domain.Role{domain.RoleAdmin}}
}

func TestAdminListNormalizesPagination(t *testing.T) {
	repo := &adminRepoMock{}
	service := NewAdminService(repo)

	_, err := service.ListUsers(context.Background(), adminActor(), domain.AdminUserQuery{
		Page:  0,
		Limit: 0,
	})
	if err != nil {
		t.Fatal(err)
	}
	if repo.lastQuery.Page != 1 || repo.lastQuery.Limit != 50 {
		t.Fatalf("unexpected pagination %#v", repo.lastQuery)
	}

	_, err = service.ListUsers(context.Background(), adminActor(), domain.AdminUserQuery{
		Page:  2,
		Limit: 500,
	})
	if err != nil {
		t.Fatal(err)
	}
	if repo.lastQuery.Page != 2 || repo.lastQuery.Limit != 100 {
		t.Fatalf("hard limit must be 100, got %#v", repo.lastQuery)
	}
}

func TestSupervisorAndTeacherDirectoryFailClosedUntilOrganizationScope(t *testing.T) {
	service := NewAdminService(&adminRepoMock{})

	for _, role := range []domain.Role{domain.RoleSupervisor, domain.RoleTeacher} {
		_, err := service.ListUsers(
			context.Background(),
			domain.User{ID: "actor", Roles: []domain.Role{role}},
			domain.AdminUserQuery{},
		)
		if !errors.Is(err, ErrOrganizationScopePending) {
			t.Fatalf("role %s: expected scope-pending error, got %v", role, err)
		}
	}
}

func TestNonAdminAdminOperationsAreForbidden(t *testing.T) {
	service := NewAdminService(&adminRepoMock{})
	student := domain.User{ID: "student", Roles: []domain.Role{domain.RoleStudent}}

	if _, err := service.Summary(context.Background(), student); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden summary, got %v", err)
	}
	if err := service.DeleteUser(context.Background(), student, "target"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden delete, got %v", err)
	}
}

func TestAdminUpsertValidatesAndHashesPassword(t *testing.T) {
	repo := &adminRepoMock{}
	service := NewAdminService(repo)

	_, err := service.UpsertUser(
		context.Background(),
		adminActor(),
		"طالب جديد",
		" STUDENT@EXAMPLE.COM ",
		"Password123",
		domain.RoleStudent,
	)
	if err != nil {
		t.Fatal(err)
	}
	if repo.upsertInput.Email != "student@example.com" {
		t.Fatalf("email was not normalized: %q", repo.upsertInput.Email)
	}
	if repo.upsertInput.PasswordHash == "Password123" {
		t.Fatal("admin-created password must never reach repository in plaintext")
	}
	if !security.VerifyPassword(repo.upsertInput.PasswordHash, "Password123") {
		t.Fatal("expected Argon2id-compatible password hash")
	}

	_, err = service.UpsertUser(
		context.Background(),
		adminActor(),
		"x",
		"bad-email",
		"short",
		domain.Role("root"),
	)
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
}

func TestAdminBulkStatusDeduplicatesIDs(t *testing.T) {
	repo := &adminRepoMock{}
	service := NewAdminService(repo)

	_, err := service.BulkStatus(
		context.Background(),
		adminActor(),
		[]string{" user-1 ", "user-1", "user-2", ""},
		false,
	)
	if err != nil {
		t.Fatal(err)
	}
	if len(repo.bulkIDs) != 2 || repo.bulkIDs[0] != "user-1" || repo.bulkIDs[1] != "user-2" {
		t.Fatalf("unexpected bulk IDs %#v", repo.bulkIDs)
	}
	if repo.bulkActive {
		t.Fatal("expected disable operation")
	}
}

func TestAdminUpdateRejectsEmptyPatchAndInvalidRole(t *testing.T) {
	service := NewAdminService(&adminRepoMock{})

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
