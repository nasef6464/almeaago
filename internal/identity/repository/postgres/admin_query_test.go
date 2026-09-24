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
		Search: "Math",
		Role:   &role,
		Active: &active,
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
	if len(args) != 3 {
		t.Fatalf("expected 3 bound args, got %d", len(args))
	}
	if args[0] != "math" || args[1] != "teacher" || args[2] != true {
		t.Fatalf("unexpected args %#v", args)
	}
}

func TestBuildAdminUserWhereEmptyQuery(t *testing.T) {
	where, args := buildAdminUserWhere(domain.AdminUserQuery{})
	if where != "" || len(args) != 0 {
		t.Fatalf("unexpected empty query where=%q args=%#v", where, args)
	}
}
