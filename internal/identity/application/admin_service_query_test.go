package application

import (
	"context"
	"errors"
	"testing"

	"github.com/nasef6464/almeaago/internal/identity/domain"
)

func TestAdminListNormalizesPaginationAndCarriesActorScope(t *testing.T) {
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
	if repo.lastQuery.ActorUserID != "admin-1" ||
		len(repo.lastQuery.ActorRoles) != 1 ||
		repo.lastQuery.ActorRoles[0] != domain.RoleAdmin {
		t.Fatalf("actor scope was not propagated: %#v", repo.lastQuery)
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

func TestSupervisorAndTeacherDirectoryUseOrganizationScope(t *testing.T) {
	for _, role := range []domain.Role{domain.RoleSupervisor, domain.RoleTeacher} {
		repo := &adminRepoMock{}
		service := NewAdminService(repo)
		actor := domain.User{ID: "actor-" + string(role), Roles: []domain.Role{role}}

		if _, err := service.ListUsers(
			context.Background(),
			actor,
			domain.AdminUserQuery{},
		); err != nil {
			t.Fatalf("role %s: unexpected list error %v", role, err)
		}
		if repo.lastQuery.ActorUserID != actor.ID ||
			len(repo.lastQuery.ActorRoles) != 1 ||
			repo.lastQuery.ActorRoles[0] != role {
			t.Fatalf("role %s: scope was not propagated: %#v", role, repo.lastQuery)
		}
	}
}

func TestStudentCannotUseAdminDirectoryOrMutations(t *testing.T) {
	service := NewAdminService(&adminRepoMock{})
	student := domain.User{ID: "student", Roles: []domain.Role{domain.RoleStudent}}

	if _, err := service.ListUsers(
		context.Background(),
		student,
		domain.AdminUserQuery{},
	); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden list, got %v", err)
	}
	if _, err := service.Summary(context.Background(), student); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden summary, got %v", err)
	}
	if err := service.DeleteUser(context.Background(), student, "target"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden delete, got %v", err)
	}
}
