package postgres

import (
	"strings"
	"testing"

	"github.com/nasef6464/almeaago/internal/identity/domain"
)

func TestBuildAdminUserWhereUsesBoundArguments(t *testing.T) {
	role := domain.RoleTeacher
	active := true
	where, args := buildAdminUserWhere(domain.AdminUserQuery{
		Search:     "Math",
		Role:       &role,
		Active:     &active,
		ActorUserID: "admin-1",
		ActorRoles: []domain.Role{domain.RoleAdmin},
	})

	for _, fragment := range []string{
		"lower(u.name) LIKE",
		"EXISTS (SELECT 1 FROM user_roles",
		"u.status = 'active'",
	} {
		if !strings.Contains(where, fragment) {
			t.Fatalf("missing %q in %q", fragment, where)
		}
	}
	if len(args) != 2 {
		t.Fatalf("expected 2 bound args, got %d", len(args))
	}
	if args[0] != "%math%" || args[1] != "teacher" {
		t.Fatalf("unexpected args %#v", args)
	}
}

func TestBuildAdminUserWhereAdminEmptyQuery(t *testing.T) {
	where, args := buildAdminUserWhere(domain.AdminUserQuery{
		ActorUserID: "admin-1",
		ActorRoles:  []domain.Role{domain.RoleAdmin},
	})
	if where != "" || len(args) != 0 {
		t.Fatalf("unexpected empty admin query where=%q args=%#v", where, args)
	}
}

func TestBuildAdminUserWhereScopesSupervisorByOrganization(t *testing.T) {
	where, args := buildAdminUserWhere(domain.AdminUserQuery{
		ActorUserID: "00000000-0000-0000-0000-000000000001",
		ActorRoles:  []domain.Role{domain.RoleSupervisor},
	})
	for _, fragment := range []string{
		"school_memberships actor_sm",
		"class_memberships actor_cm",
		"::uuid",
	} {
		if !strings.Contains(where, fragment) {
			t.Fatalf("missing scoped fragment %q in %q", fragment, where)
		}
	}
	if len(args) != 1 {
		t.Fatalf("expected one actor argument, got %#v", args)
	}
}
