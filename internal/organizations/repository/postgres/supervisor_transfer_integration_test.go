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
	audit "github.com/nasef6464/almeaago/internal/operations/repository/postgres"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func TestSupervisorTransferScopeAndPersistencePostgres(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL required for PostgreSQL integration")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	schema := fmt.Sprintf("supervisor_transfer_%d", time.Now().UnixNano())
	admin, err := pgx.Connect(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close(context.Background())
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	defer admin.Exec(context.Background(), "DROP SCHEMA "+schema+" CASCADE")
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	config.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()

	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	exec(`CREATE TABLE users (id uuid PRIMARY KEY, status text);
		CREATE TABLE schools (id uuid PRIMARY KEY, status text);
		CREATE TABLE classes (id uuid PRIMARY KEY, school_id uuid REFERENCES schools, status text);
		CREATE TABLE school_memberships (school_id uuid REFERENCES schools, user_id uuid REFERENCES users, role text, status text);
		CREATE TABLE school_supervisor_scopes (school_id uuid REFERENCES schools, supervisor_user_id uuid REFERENCES users, scope_type text, class_id uuid REFERENCES classes, status text);
		CREATE TABLE class_memberships (class_id uuid REFERENCES classes, user_id uuid REFERENCES users, status text, joined_at timestamptz DEFAULT now(), left_at timestamptz, PRIMARY KEY (class_id, user_id));
		CREATE TABLE audit_logs (actor_user_id uuid REFERENCES users, action text, resource_type text, resource_id text, status text, metadata jsonb);`)

	const actor = "00000000-0000-0000-0000-000000000001"
	const student = "00000000-0000-0000-0000-000000000002"
	const hiddenStudent = "00000000-0000-0000-0000-000000000003"
	const school = "00000000-0000-0000-0000-000000000011"
	const otherSchool = "00000000-0000-0000-0000-000000000012"
	const from = "00000000-0000-0000-0000-000000000021"
	const destination = "00000000-0000-0000-0000-000000000022"
	const hidden = "00000000-0000-0000-0000-000000000023"
	const foreign = "00000000-0000-0000-0000-000000000024"
	exec("INSERT INTO users VALUES ($1,'active'),($2,'active'),($3,'active')", actor, student, hiddenStudent)
	exec("INSERT INTO schools VALUES ($1,'active'),($2,'active')", school, otherSchool)
	exec("INSERT INTO classes VALUES ($1,$5,'active'),($2,$5,'active'),($3,$5,'active'),($4,$6,'active')", from, destination, hidden, foreign, school, otherSchool)
	exec("INSERT INTO school_memberships VALUES ($1,$2,'student','active'),($1,$3,'student','active')", school, student, hiddenStudent)
	exec("INSERT INTO school_memberships VALUES ($1,$2,'supervisor','active')", school, actor)
	exec("INSERT INTO class_memberships (class_id, user_id, status) VALUES ($1,$2,'active'),($3,$4,'active')", from, student, hidden, hiddenStudent)
	exec("INSERT INTO school_supervisor_scopes VALUES ($1,$2,'class',$3,'active'),($1,$2,'class',$4,'active')", school, actor, from, destination)
	repo := New(pool, audit.NewAuditWriter())
	move := func(id, source, target string) (bool, error) {
		return repo.SupervisorMoveStudent(ctx, actor, school, id, org.SupervisorClassMove{FromClassID: source, ClassID: target})
	}
	for _, denied := range []struct{ student, source, target string }{
		{student, from, hidden}, {student, from, foreign}, {hiddenStudent, from, destination},
	} {
		if _, err := move(denied.student, denied.source, denied.target); !errors.Is(err, org.ErrForbidden) {
			t.Fatalf("scope check did not reject transfer: %v", err)
		}
	}
	exec("INSERT INTO class_memberships (class_id, user_id, status) VALUES ($1,$2,'active')", hidden, student)
	if _, err := move(student, from, destination); !errors.Is(err, org.ErrConflict) {
		t.Fatalf("ambiguous enrollment did not reject transfer: %v", err)
	}
	exec("UPDATE class_memberships SET status='inactive' WHERE class_id=$1 AND user_id=$2", hidden, student)
	results := make(chan bool, 2)
	errs := make(chan error, 2)
	for range 2 {
		go func() {
			retried, err := move(student, from, destination)
			results <- retried
			errs <- err
		}()
	}
	if first, second := <-errs, <-errs; first != nil || second != nil {
		t.Fatalf("parallel transfers failed: %v, %v", first, second)
	}
	if <-results == <-results {
		t.Fatal("exactly one transfer must be an idempotent retry")
	}
	var current string
	var active, events int
	if err := pool.QueryRow(ctx, "SELECT count(*), min(class_id::text) FROM class_memberships WHERE user_id=$1 AND status='active'", student).Scan(&active, &current); err != nil || active != 1 || current != destination {
		t.Fatalf("persisted enrollment: active=%d class=%s err=%v", active, current, err)
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM audit_logs WHERE action='schools.supervisor.student.move_class' AND metadata->>'fromClassId'=$1 AND metadata->>'classId'=$2`, from, destination).Scan(&events); err != nil || events != 1 {
		t.Fatalf("persisted audit: events=%d err=%v", events, err)
	}
	exec("UPDATE school_supervisor_scopes SET status='revoked' WHERE class_id=$1", from)
	if _, err := move(student, destination, from); !errors.Is(err, org.ErrForbidden) {
		t.Fatalf("revocation did not block move: %v", err)
	}
	exec("INSERT INTO school_supervisor_scopes VALUES ($1,$2,'school',NULL,'active')", school, actor)
	if retry, err := move(student, destination, from); err != nil || retry {
		t.Fatalf("school-wide grant did not allow move: retry=%t err=%v", retry, err)
	}
	exec("UPDATE school_memberships SET status='revoked' WHERE school_id=$1 AND user_id=$2", school, actor)
	if _, err := move(student, from, destination); !errors.Is(err, org.ErrForbidden) {
		t.Fatalf("revoked school membership did not block move: %v", err)
	}
}
