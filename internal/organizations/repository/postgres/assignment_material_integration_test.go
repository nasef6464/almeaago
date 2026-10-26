package postgres

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
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
	if err != nil { t.Fatal(err) }
	defer first.Close(context.Background())
	second, err := pgx.Connect(ctx, dsn)
	if err != nil { t.Fatal(err) }
	defer second.Close(context.Background())
	schema := fmt.Sprintf("assignment_guard_%d", time.Now().UnixNano())
	if _, err := first.Exec(ctx, "CREATE SCHEMA "+schema); err != nil { t.Fatal(err) }
	defer first.Exec(context.Background(), "DROP SCHEMA "+schema+" CASCADE")
	if _, err := first.Exec(ctx, "CREATE TABLE "+schema+".users (id uuid PRIMARY KEY)"); err != nil { t.Fatal(err) }
	if _, err := first.Exec(ctx, "CREATE TABLE "+schema+".teaching_assignments (school_id uuid NOT NULL, teacher_id uuid NOT NULL, subject_id uuid, status text NOT NULL)"); err != nil { t.Fatal(err) }
	const teacher = "00000000-0000-0000-0000-000000000011"
	const school = "00000000-0000-0000-0000-000000000012"
	const subjectA = "00000000-0000-0000-0000-000000000013"
	const subjectB = "00000000-0000-0000-0000-000000000014"
	if _, err := first.Exec(ctx, "INSERT INTO "+schema+".users (id) VALUES ($1)", teacher); err != nil { t.Fatal(err) }
	tx1, err := first.Begin(ctx)
	if err != nil { t.Fatal(err) }
	defer tx1.Rollback(context.Background())
	if _, err := tx1.Exec(ctx, "SET LOCAL search_path TO "+schema); err != nil { t.Fatal(err) }
	if err := ensureAssignmentMaterialTx(ctx, tx1, school, teacher, subjectA); err != nil { t.Fatal(err) }
	finished := make(chan error, 1)
	go func() {
		tx2, err := second.Begin(ctx)
		if err != nil { finished <- err; return }
		defer tx2.Rollback(context.Background())
		if _, err := tx2.Exec(ctx, "SET LOCAL search_path TO "+schema); err != nil { finished <- err; return }
		finished <- ensureAssignmentMaterialTx(ctx, tx2, school, teacher, subjectB)
	}()
	select {
	case result := <-finished: t.Fatalf("second transaction returned before commit: %v", result)
	case <-time.After(150*time.Millisecond):
	}
	if _, err := tx1.Exec(ctx, "INSERT INTO teaching_assignments (school_id, teacher_id, subject_id, status) VALUES ($1,$2,$3,'active')", school, teacher, subjectA); err != nil { t.Fatal(err) }
	if err := tx1.Commit(ctx); err != nil { t.Fatal(err) }
	select {
	case err := <-finished:
		if !errors.Is(err, org.ErrConflict) { t.Fatalf("expected committed material conflict: %v", err) }
	case <-ctx.Done(): t.Fatalf("second transaction stuck: %v", ctx.Err())
	}
}
