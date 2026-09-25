package postgres

import (
	"strings"
	"testing"

	content "github.com/nasef6464/almeaago/internal/content/domain"
)

func TestBuildListWhereTeacherScopeDoesNotUseCreatorAuthority(t *testing.T) {
	where, args := buildListWhere(content.ListQuery{TeacherScopeUserID: "teacher-1"}, "c")

	if strings.Contains(where, "created_by") {
		t.Fatalf("creator must not remain an authorization scope: %s", where)
	}
	if !strings.Contains(where, "owner_user_id") || !strings.Contains(where, "assigned_teacher_id") {
		t.Fatalf("teacher scope must use owner/assignment authority: %s", where)
	}
	if len(args) != 1 || args[0] != "teacher-1" {
		t.Fatalf("unexpected args: %#v", args)
	}
}
