package postgres

import (
	"strings"
	"testing"

	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

func TestQuestionTeacherScopeIncludesCanonicalTrainerTaxonomyScope(t *testing.T) {
	clauses, args := buildListFilters(question.ListQuery{TeacherScopeUserID: "teacher-1"})
	where := strings.Join(clauses, " AND ")
	if !strings.Contains(where, "assigned_teacher_id") || !strings.Contains(where, "owner_id") {
		t.Fatalf("missing owner/assignment scope: %s", where)
	}
	if !strings.Contains(where, "content_trainer_path_scopes") || !strings.Contains(where, "content_trainer_subject_scopes") {
		t.Fatalf("missing canonical trainer taxonomy scope: %s", where)
	}
	if len(args) != 1 || args[0] != "teacher-1" {
		t.Fatalf("unexpected args: %#v", args)
	}
}
