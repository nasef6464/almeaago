package postgres

import (
	"strings"
	"testing"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func TestSupervisorRosterQueryKeepsSchoolAndClassScope(t *testing.T) {
	role := identity.RoleStudent
	active := true
	where, args := buildRosterWhere(org.AccessContext{
		ActorUserID: "supervisor-1",
		ActorRoles:  []identity.Role{identity.RoleSupervisor},
	}, "school-1", org.RosterQuery{
		Role: &role, Active: &active, Search: "طالب", ClassID: "class-1",
	})
	for _, required := range []string{
		"school_memberships membership",
		"membership.school_id = $1::uuid",
		"membership.status = 'active'",
		"school_supervisor_scopes school_scope",
		"school_scope.scope_type = 'school'",
		"school_scope.status = 'active'",
		"school_supervisor_scopes class_scope",
		"class_scope.scope_type = 'class'",
		"class_scope.status = 'active'",
		"target_cm.status = 'active'",
		"target_class.status = 'active'",
		"class_filter.class_id",
		"role_membership.role",
		"u.status = 'active'",
	} {
		if !strings.Contains(where, required) {
			t.Errorf("missing scope predicate %q in %s", required, where)
		}
	}
	if len(args) != 5 {
		t.Fatalf("expected school, supervisor, search, role, class args, got %d: %#v", len(args), args)
	}
	if args[0] != "school-1" || args[1] != "supervisor-1" {
		t.Fatalf("supervisor scope must use authenticated actor and selected school: %#v", args)
	}
	if strings.Contains(where, " OR TRUE") || strings.Contains(where, "1=1") {
		t.Fatalf("unexpected unrestricted supervisor predicate: %s", where)
	}
}
