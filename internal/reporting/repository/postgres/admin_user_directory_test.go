package postgres

import (
	"strings"
	"testing"

	"github.com/nasef6464/almeaago/internal/identity/domain"
)

func TestAdminUserSelectDoesNotReadCredentialInternals(t *testing.T) {
	for _, forbidden := range []string{
		"password_hash",
		"failed_login_attempts",
		"login_locked_until",
		"csrf",
		"token_hash",
	} {
		if strings.Contains(strings.ToLower(adminUserSelect), forbidden) {
			t.Fatalf("admin directory must not select %q", forbidden)
		}
	}
}

func TestBuildAdminUserWhereAdminHasGlobalDirectory(t *testing.T) {
	where, args := BuildAdminUserWhere(domain.AdminUserQuery{
		ActorUserID: "00000000-0000-0000-0000-000000000001",
		ActorRoles:  []domain.Role{domain.RoleAdmin},
	})
	if where != "" || len(args) != 0 {
		t.Fatalf("unexpected global admin scope where=%q args=%#v", where, args)
	}
}

func TestBuildAdminUserWhereTeacherAndSupervisorKeepLegacySchoolAndClassScope(t *testing.T) {
	for _, role := range []domain.Role{domain.RoleTeacher, domain.RoleSupervisor} {
		where, args := BuildAdminUserWhere(domain.AdminUserQuery{
			ActorUserID: "00000000-0000-0000-0000-000000000001",
			ActorRoles:  []domain.Role{role},
		})
		for _, fragment := range []string{
			"school_memberships actor_sm",
			"class_memberships actor_cm",
			"u.id = $1::uuid",
		} {
			if !strings.Contains(where, fragment) {
				t.Fatalf("role %s missing %q in %q", role, fragment, where)
			}
		}
		if len(args) != 1 {
			t.Fatalf("role %s expected one actor arg, got %#v", role, args)
		}
	}
}

func TestBuildAdminUserWhereUsesIndexedSearchExpressions(t *testing.T) {
	role := domain.RoleStudent
	active := true
	where, args := BuildAdminUserWhere(domain.AdminUserQuery{
		ActorUserID: "00000000-0000-0000-0000-000000000001",
		ActorRoles:  []domain.Role{domain.RoleAdmin},
		Search:      "Math",
		Role:        &role,
		Active:      &active,
	})
	for _, fragment := range []string{
		"lower(u.name) LIKE",
		"lower(u.email) LIKE",
		"EXISTS (SELECT 1 FROM user_roles",
		"u.status = 'active'",
	} {
		if !strings.Contains(where, fragment) {
			t.Fatalf("missing %q in %q", fragment, where)
		}
	}
	if len(args) != 2 || args[0] != "%math%" || args[1] != "student" {
		t.Fatalf("unexpected args %#v", args)
	}
}

func TestBuildAdminUserWherePlatformTrainerUsesCanonicalContentScope(t *testing.T) {
	value := true
	where, args := BuildAdminUserWhere(domain.AdminUserQuery{
		ActorUserID:     "00000000-0000-0000-0000-000000000001",
		ActorRoles:      []domain.Role{domain.RoleAdmin},
		PlatformTrainer: &value,
	})
	for _, fragment := range []string{
		"trainer_role.role='teacher'",
		"content_trainer_path_scopes",
		"content_trainer_subject_scopes",
	} {
		if !strings.Contains(where, fragment) {
			t.Fatalf("missing %q in %q", fragment, where)
		}
	}
	if len(args) != 0 {
		t.Fatalf("unexpected args %#v", args)
	}
}
