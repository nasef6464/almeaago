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
	if !strings.Contains(where, "content_trainer_path_scopes") || !strings.Contains(where, "content_trainer_subject_scopes") {
		t.Fatalf("teacher list must also enforce canonical trainer taxonomy scope: %s", where)
	}
	if len(args) != 1 || args[0] != "teacher-1" {
		t.Fatalf("unexpected args: %#v", args)
	}
}

func TestBuildListWherePrevalidatedTeacherScopeSkipsPlatformTaxonomyTables(t *testing.T) {
	where, args := buildListWhere(content.ListQuery{
		TeacherScopeUserID:       "teacher-1",
		TeacherScopePrevalidated: true,
	}, "c")

	if !strings.Contains(where, "owner_user_id") || !strings.Contains(where, "assigned_teacher_id") {
		t.Fatalf("prevalidated scope must retain owner/assignment authority: %s", where)
	}
	if strings.Contains(where, "content_trainer_path_scopes") || strings.Contains(where, "content_trainer_subject_scopes") {
		t.Fatalf("prevalidated exact scope must not re-impose platform-only taxonomy scope: %s", where)
	}
	if len(args) != 1 || args[0] != "teacher-1" {
		t.Fatalf("unexpected args: %#v", args)
	}
}

func TestLessonSkillFilterKeepsOwnerScopeAndUsesCanonicalSkillLinks(t *testing.T) {
	const skillID = "22222222-2222-4222-8222-222222222222"
	where, args := buildLessonListWhere(content.ListQuery{
		PathID: "path-id", SubjectID: "subject-id", TeacherScopeUserID: "teacher-id", SkillID: skillID,
	})
	if !strings.Contains(where, "lesson_skill_links") || !strings.Contains(where, "lsl.lesson_id=l.id") || !strings.Contains(where, "lsl.skill_id=$4::uuid") {
		t.Fatalf("lesson link filter missing or wrongly parameterized: %s", where)
	}
	if !strings.Contains(where, "l.owner_user_id") || !strings.Contains(where, "l.assigned_teacher_id") || !strings.Contains(where, "content_trainer_subject_scopes") {
		t.Fatalf("lesson filter must preserve teacher authorization: %s", where)
	}
	if len(args) != 4 || args[0] != "path-id" || args[1] != "subject-id" || args[2] != "teacher-id" || args[3] != skillID {
		t.Fatalf("unexpected scoped args: %#v", args)
	}
}
