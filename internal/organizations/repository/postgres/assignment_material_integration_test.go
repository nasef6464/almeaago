package postgres

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

// DATABASE_URL enables this test in Database CI, using isolated test tables.
func TestAssignmentMaterialGuardConcurrentTransactionsPostgres(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL required for PostgreSQL integration")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	first, err := pgx.Connect(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer first.Close(context.Background())
	second, err := pgx.Connect(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer second.Close(context.Background())
	schema := fmt.Sprintf("assignment_guard_%d", time.Now().UnixNano())
	if _, err := first.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	defer first.Exec(context.Background(), "DROP SCHEMA "+schema+" CASCADE")
	if _, err := first.Exec(ctx, "CREATE TABLE "+schema+".users (id uuid PRIMARY KEY)"); err != nil {
		t.Fatal(err)
	}
	if _, err := first.Exec(ctx, "CREATE TABLE "+schema+".teaching_assignments (school_id uuid NOT NULL, teacher_id uuid NOT NULL, subject_id uuid, status text NOT NULL)"); err != nil {
		t.Fatal(err)
	}
	const teacher = "00000000-0000-0000-0000-000000000011"
	const school = "00000000-0000-0000-0000-000000000012"
	const subjectA = "00000000-0000-0000-0000-000000000013"
	const subjectB = "00000000-0000-0000-0000-000000000014"
	if _, err := first.Exec(ctx, "INSERT INTO "+schema+".users (id) VALUES ($1)", teacher); err != nil {
		t.Fatal(err)
	}
	tx1, err := first.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx1.Rollback(context.Background())
	if _, err := tx1.Exec(ctx, "SET LOCAL search_path TO "+schema); err != nil {
		t.Fatal(err)
	}
	if err := ensureAssignmentMaterialTx(ctx, tx1, school, teacher, subjectA); err != nil {
		t.Fatal(err)
	}
	finished := make(chan error, 1)
	go func() {
		tx2, err := second.Begin(ctx)
		if err != nil {
			finished <- err
			return
		}
		defer tx2.Rollback(context.Background())
		if _, err := tx2.Exec(ctx, "SET LOCAL search_path TO "+schema); err != nil {
			finished <- err
			return
		}
		finished <- ensureAssignmentMaterialTx(ctx, tx2, school, teacher, subjectB)
	}()
	select {
	case result := <-finished:
		t.Fatalf("second transaction returned before commit: %v", result)
	case <-time.After(150 * time.Millisecond):
	}
	if _, err := tx1.Exec(ctx, "INSERT INTO teaching_assignments (school_id, teacher_id, subject_id, status) VALUES ($1,$2,$3,'active')", school, teacher, subjectA); err != nil {
		t.Fatal(err)
	}
	if err := tx1.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	select {
	case err := <-finished:
		if !errors.Is(err, org.ErrConflict) {
			t.Fatalf("expected committed material conflict: %v", err)
		}
	case <-ctx.Done():
		t.Fatalf("second transaction stuck: %v", ctx.Err())
	}
	testArchivedAssignmentStopAndReactivation(ctx, t, dsn, schema, first, school, teacher, subjectA)
}

type assignmentAuditProbe struct{ calls int }

func (p *assignmentAuditProbe) WriteTx(_ context.Context, _ pgx.Tx, _ operations.AuditEvent) error {
	p.calls++
	return nil
}

// The source permits stopping an orphaned assignment but never reactivating
// one whose classroom is archived. Use real PostgreSQL and the repository
// transaction, not a SQL-text assertion or a mock.
func testArchivedAssignmentStopAndReactivation(
	ctx context.Context, t *testing.T, dsn, schema string, setup *pgx.Conn,
	school, teacher, subject string,
) {
	t.Helper()
	const archivedClass = "00000000-0000-0000-0000-000000000015"
	const otherSchool = "00000000-0000-0000-0000-000000000016"
	statements := []string{
		"ALTER TABLE " + schema + ".teaching_assignments ADD COLUMN id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ADD COLUMN class_id uuid, ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(), ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now()",
		"CREATE TABLE " + schema + ".schools (id uuid PRIMARY KEY, status text NOT NULL)",
		"CREATE TABLE " + schema + ".classes (id uuid PRIMARY KEY, school_id uuid NOT NULL, status text NOT NULL)",
		"CREATE TABLE " + schema + ".subjects (id uuid PRIMARY KEY)",
		"CREATE TABLE " + schema + ".user_roles (user_id uuid NOT NULL, role text NOT NULL)",
		"CREATE TABLE " + schema + ".school_memberships (school_id uuid NOT NULL, user_id uuid NOT NULL, role text NOT NULL, status text NOT NULL)",
	}
	for _, statement := range statements {
		if _, err := setup.Exec(ctx, statement); err != nil {
			t.Fatal(err)
		}
	}
	fixtures := []struct{ sql string; args []any }{
		{"INSERT INTO " + schema + ".schools (id,status) VALUES ($1,'active'),($2,'active')", []any{school, otherSchool}},
		{"INSERT INTO " + schema + ".classes (id,school_id,status) VALUES ($1,$2,'archived')", []any{archivedClass, school}},
		{"INSERT INTO " + schema + ".subjects (id) VALUES ($1)", []any{subject}},
		{"INSERT INTO " + schema + ".user_roles (user_id,role) VALUES ($1,'teacher')", []any{teacher}},
		{"INSERT INTO " + schema + ".school_memberships (school_id,user_id,role,status) VALUES ($1,$2,'teacher','active')", []any{school, teacher}},
		{"INSERT INTO " + schema + ".teaching_assignments (school_id,teacher_id,class_id,subject_id,status) VALUES ($1,$2,$3,$4,'ended')", []any{school, teacher, archivedClass, subject}},
	}
	for _, fixture := range fixtures {
		if _, err := setup.Exec(ctx, fixture.sql, fixture.args...); err != nil {
			t.Fatal(err)
		}
	}
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	config.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, err := conn.Exec(ctx, "SET search_path TO "+schema)
		return err
	}
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	probe := &assignmentAuditProbe{}
	repo := New(pool, probe)
	write := org.AssignmentWrite{TeacherID: teacher, ClassID: archivedClass, SubjectID: subject, Status: org.AssignmentStatusActive}
	if _, err := repo.UpsertAssignment(ctx, teacher, school, write); !errors.Is(err, org.ErrNotFound) {
		t.Fatalf("archived classroom must never be reactivated (Legacy rejects it), got %v", err)
	}
	var state string
	if err := setup.QueryRow(ctx, "SELECT status FROM "+schema+".teaching_assignments WHERE class_id=$1", archivedClass).Scan(&state); err != nil || state != "ended" {
		t.Fatalf("rejected activation must leave original assignment inactive: state=%s err=%v", state, err)
	}
	write.Status = org.AssignmentStatusEnded
	stopped, err := repo.UpsertAssignment(ctx, teacher, school, write)
	if err != nil || stopped.Status != org.AssignmentStatusEnded {
		t.Fatalf("stopping archived-class assignment must remain available: %+v err=%v", stopped, err)
	}
	repeated, err := repo.UpsertAssignment(ctx, teacher, school, write)
	if err != nil || repeated.ID != stopped.ID {
		t.Fatalf("repeated stop must preserve assignment identity: %+v err=%v", repeated, err)
	}
	var count int
	if err := setup.QueryRow(ctx, "SELECT count(*) FROM "+schema+".teaching_assignments WHERE class_id=$1", archivedClass).Scan(&count); err != nil || count != 1 {
		t.Fatalf("stop must not create duplicate assignment: count=%d err=%v", count, err)
	}
	if _, err := repo.UpsertAssignment(ctx, teacher, otherSchool, write); !errors.Is(err, org.ErrNotFound) {
		t.Fatalf("other school must not mutate archived assignment: %v", err)
	}
	if probe.calls != 2 {
		t.Fatalf("only two valid stop operations may be audited, got %d", probe.calls)
	}
}
