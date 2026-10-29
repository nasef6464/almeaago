package postgres

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// An isolated PostgreSQL schema exercises the same query used by
// GET /api/v1/schools/teacher-workspace, without production fixtures.
func TestTeacherWorkspaceSchoolAndAssignmentIsolationPostgres(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL required for PostgreSQL integration")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	admin, err := pgx.Connect(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close(context.Background())
	schema := fmt.Sprintf("teacher_scope_%d", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	defer admin.Exec(context.Background(), "DROP SCHEMA "+schema+" CASCADE")

	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	config.MaxConns = 1
	config.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, err := conn.Exec(ctx, "SET search_path TO "+schema)
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	for _, ddl := range []string{
		"CREATE TABLE schools (id uuid PRIMARY KEY, name text, status text)",
		"CREATE TABLE classes (id uuid PRIMARY KEY, school_id uuid, name text, status text)",
		"CREATE TABLE teaching_assignments (id uuid PRIMARY KEY, school_id uuid, teacher_id uuid, class_id uuid, subject_id uuid, status text)",
		"CREATE TABLE school_memberships (school_id uuid, user_id uuid, role text, status text)",
		"CREATE TABLE class_memberships (class_id uuid, user_id uuid, status text)",
	} {
		if _, err := pool.Exec(ctx, ddl); err != nil {
			t.Fatal(err)
		}
	}
	const teacher = "00000000-0000-0000-0000-000000008001"
	const studentA = "00000000-0000-0000-0000-000000008002"
	const studentB = "00000000-0000-0000-0000-000000008003"
	const schoolA = "00000000-0000-0000-0000-000000008011"
	const schoolB = "00000000-0000-0000-0000-000000008012"
	const classA = "00000000-0000-0000-0000-000000008021"
	const classB = "00000000-0000-0000-0000-000000008022"
	const subject = "00000000-0000-0000-0000-000000008031"
	const assignmentA = "00000000-0000-0000-0000-000000008041"
	const assignmentB = "00000000-0000-0000-0000-000000008042"
	fixtures := []struct {
		sql  string
		args []any
	}{
		{"INSERT INTO schools VALUES ($1,'مدرسة ألف','active'),($2,'مدرسة باء','active')", []any{schoolA, schoolB}},
		{"INSERT INTO classes VALUES ($1,$2,'الأول ألف','active'),($3,$4,'الثاني باء','active')", []any{classA, schoolA, classB, schoolB}},
		{"INSERT INTO school_memberships VALUES ($1,$3,'teacher','active'),($2,$3,'teacher','active'),($1,$4,'student','active'),($2,$5,'student','active')", []any{schoolA, schoolB, teacher, studentA, studentB}},
		{"INSERT INTO class_memberships VALUES ($1,$3,'active'),($2,$4,'active')", []any{classA, classB, studentA, studentB}},
		{"INSERT INTO teaching_assignments VALUES ($1,$3,$5,$6,$8,'active'),($2,$4,$5,$7,$8,'active')", []any{assignmentA, assignmentB, schoolA, schoolB, teacher, classA, classB, subject}},
	}
	for _, f := range fixtures {
		if _, err := pool.Exec(ctx, f.sql, f.args...); err != nil {
			t.Fatal(err)
		}
	}
	repo := New(pool, nil)
	workspace, err := repo.TeacherWorkspace(ctx, teacher)
	if err != nil {
		t.Fatal(err)
	}
	if len(workspace.Schools) != 2 {
		t.Fatalf("expected two authorized schools, got %+v", workspace.Schools)
	}
	for _, school := range workspace.Schools {
		if len(school.Assignments) != 1 || school.Assignments[0].StudentCount != 1 {
			t.Fatalf("unexpected school-scoped assignments %+v", school)
		}
		if school.SchoolID == schoolA && school.Assignments[0].ClassID != classA ||
			school.SchoolID == schoolB && school.Assignments[0].ClassID != classB {
			t.Fatalf("cross-school class disclosure %+v", school)
		}
	}
	if _, err := pool.Exec(ctx, "UPDATE school_memberships SET status='inactive' WHERE school_id=$1 AND user_id=$2 AND role='teacher'", schoolB, teacher); err != nil {
		t.Fatal(err)
	}
	workspace, err = repo.TeacherWorkspace(ctx, teacher)
	if err != nil {
		t.Fatal(err)
	}
	if len(workspace.Schools) != 1 || workspace.Schools[0].SchoolID != schoolA {
		t.Fatalf("revoked school still visible: %+v", workspace.Schools)
	}
	if _, err := pool.Exec(ctx, "UPDATE teaching_assignments SET status='inactive' WHERE id=$1", assignmentA); err != nil {
		t.Fatal(err)
	}
	workspace, err = repo.TeacherWorkspace(ctx, teacher)
	if err != nil {
		t.Fatal(err)
	}
	if len(workspace.Schools) != 0 {
		t.Fatalf("inactive teaching assignments still visible: %+v", workspace.Schools)
	}
}
