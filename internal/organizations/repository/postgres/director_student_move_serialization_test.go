package postgres

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
)

// A director moving the same student in two browser sessions must not leave
// that student active in two classes of the same school. This uses real
// READ COMMITTED transactions and an isolated schema, never production data.
func TestDirectorStudentConcurrentClassMovesPostgres(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL required for PostgreSQL integration")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
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

	schema := fmt.Sprintf("director_student_move_%d", time.Now().UnixNano())
	if _, err := first.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	defer first.Exec(context.Background(), "DROP SCHEMA "+schema+" CASCADE")

	fixtures := []string{
		"CREATE TABLE " + schema + ".users (id uuid PRIMARY KEY)",
		"CREATE TABLE " + schema + ".classes (id uuid PRIMARY KEY, school_id uuid NOT NULL, status text NOT NULL)",
		"CREATE TABLE " + schema + ".class_memberships (class_id uuid NOT NULL, user_id uuid NOT NULL, status text NOT NULL, joined_at timestamptz, left_at timestamptz, PRIMARY KEY (class_id, user_id))",
	}
	for _, sql := range fixtures {
		if _, err := first.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}

	const school = "00000000-0000-0000-0000-000000002001"
	const otherSchool = "00000000-0000-0000-0000-000000002002"
	const student = "00000000-0000-0000-0000-000000002003"
	const classA = "00000000-0000-0000-0000-000000002004"
	const classB = "00000000-0000-0000-0000-000000002005"
	const classC = "00000000-0000-0000-0000-000000002006"
	const classOther = "00000000-0000-0000-0000-000000002007"

	if _, err := first.Exec(ctx, "INSERT INTO "+schema+".users(id) VALUES ($1)", student); err != nil {
		t.Fatal(err)
	}
	if _, err := first.Exec(ctx, "INSERT INTO "+schema+".classes(id,school_id,status) VALUES ($1,$5,'active'),($2,$5,'active'),($3,$5,'active'),($4,$6,'active')", classA, classB, classC, classOther, school, otherSchool); err != nil {
		t.Fatal(err)
	}
	if _, err := first.Exec(ctx, "INSERT INTO "+schema+".class_memberships(class_id,user_id,status,joined_at) VALUES ($1,$3,'active',now()),($2,$3,'active',now())", classA, classOther, student); err != nil {
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
	if err := replaceStudentClassTx(ctx, tx1, school, student, classB); err != nil {
		t.Fatal(err)
	}

	done := make(chan error, 1)
	go func() {
		tx2, err := second.Begin(ctx)
		if err != nil {
			done <- err
			return
		}
		defer tx2.Rollback(context.Background())
		if _, err := tx2.Exec(ctx, "SET LOCAL search_path TO "+schema); err != nil {
			done <- err
			return
		}
		if err := replaceStudentClassTx(ctx, tx2, school, student, classC); err != nil {
			done <- err
			return
		}
		done <- tx2.Commit(ctx)
	}()

	// The second writer must wait while the first move is uncommitted.
	select {
	case err := <-done:
		t.Fatalf("second move finished before first committed: %v", err)
	case <-time.After(150 * time.Millisecond):
	}
	if err := tx1.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-ctx.Done():
		t.Fatalf("second class move timed out: %v", ctx.Err())
	}

	var activeCount int
	var activeClass string
	err = first.QueryRow(ctx, "SELECT count(*), min(cm.class_id::text) FROM "+schema+".class_memberships cm JOIN "+schema+".classes c ON c.id=cm.class_id WHERE cm.user_id=$1::uuid AND c.school_id=$2::uuid AND cm.status='active'", student, school).Scan(&activeCount, &activeClass)
	if err != nil {
		t.Fatal(err)
	}
	if activeCount != 1 || activeClass != classC {
		t.Fatalf("two concurrent moves must leave only final class active; count=%d final=%s expected=%s", activeCount, activeClass, classC)
	}
	var foreignCount int
	if err := first.QueryRow(ctx, "SELECT count(*) FROM "+schema+".class_memberships WHERE class_id=$1::uuid AND user_id=$2::uuid AND status='active'", classOther, student).Scan(&foreignCount); err != nil {
		t.Fatal(err)
	}
	if foreignCount != 1 {
		t.Fatalf("class membership in another school changed: %d", foreignCount)
	}
}
