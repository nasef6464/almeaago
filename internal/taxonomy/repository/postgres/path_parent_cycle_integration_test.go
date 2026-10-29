package postgres

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
)

// Runs only against a disposable PostgreSQL database. Each test owns its schema.
// A self-parent CHECK does not reject multi-node cycles in the admin path tree.
func TestAdminPathParentCyclePostgres(t *testing.T) {
	if os.Getenv("TAXONOMY_PATH_DB_TEST") != "1" || os.Getenv("DATABASE_URL") == "" {
		t.Skip("TAXONOMY_PATH_DB_TEST=1 and isolated DATABASE_URL required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	url := os.Getenv("DATABASE_URL")
	admin, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := fmt.Sprintf("taxonomy_cycle_%d", time.Now().UnixNano())
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	defer func() {
		c, done := context.WithTimeout(context.Background(), 5*time.Second)
		defer done()
		_, _ = admin.Exec(c, "DROP SCHEMA "+schema+" CASCADE")
	}()
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	cfg.MaxConns = 4
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	for _, ddl := range []string{
		`CREATE TABLE users(id uuid PRIMARY KEY)`,
		`CREATE TABLE paths(
			id uuid PRIMARY KEY, code text NOT NULL, name text NOT NULL,
			parent_path_id uuid REFERENCES paths(id), description text NOT NULL DEFAULT '',
			sort_order integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'active',
			updated_at timestamptz NOT NULL DEFAULT now(),
			CONSTRAINT paths_parent_not_self CHECK(parent_path_id IS NULL OR parent_path_id <> id))`,
		`CREATE TABLE audit_logs(actor_user_id uuid, action text, resource_type text,
			resource_id text, status text, metadata jsonb)`,
	} {
		if _, err = db.Exec(ctx, ddl); err != nil {
			t.Fatal(err)
		}
	}
	const (
		actor = "01900000-0000-7000-8000-000000009000"
		a = "01900000-0000-7000-8000-000000009001"
		b = "01900000-0000-7000-8000-000000009002"
		c = "01900000-0000-7000-8000-000000009003"
		d = "01900000-0000-7000-8000-000000009004"
	)
	if _, err = db.Exec(ctx, `INSERT INTO users(id) VALUES($1)`, actor); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `INSERT INTO paths(id,code,name,parent_path_id) VALUES
		($1,'A','A',NULL),($2,'B','B',$1),($3,'C','C',$2),($4,'D','D',NULL)`, a, b, c, d); err != nil {
		t.Fatal(err)
	}
	repo := New(db)
	parent := func(id string) *string { return &id }
	if _, err = repo.UpdatePath(ctx, actor, a, taxonomy.PathPatch{ParentPathID: parent(c)}); !errors.Is(err, taxonomy.ErrConflict) {
		t.Fatalf("descendant parent must conflict, got %v", err)
	}
	if _, err = repo.UpdatePath(ctx, actor, a, taxonomy.PathPatch{ParentPathID: parent(a)}); !errors.Is(err, taxonomy.ErrConflict) {
		t.Fatalf("self parent must conflict, got %v", err)
	}
	var original string
	if err = db.QueryRow(ctx, `SELECT COALESCE(parent_path_id::text,'') FROM paths WHERE id=$1`, a).Scan(&original); err != nil || original != "" {
		t.Fatalf("failed writes must preserve root: parent=%q err=%v", original, err)
	}
	if _, err = repo.UpdatePath(ctx, actor, a, taxonomy.PathPatch{ParentPathID: parent(d)}); err != nil {
		t.Fatalf("valid reparent should succeed: %v", err)
	}
	if _, err = repo.UpdatePath(ctx, actor, a, taxonomy.PathPatch{ParentPathID: parent("")}); err != nil {
		t.Fatalf("clear parent should succeed: %v", err)
	}
	var count int
	if err = db.QueryRow(ctx, `SELECT count(*) FROM audit_logs WHERE action='taxonomy.path.update'`).Scan(&count); err != nil || count != 2 {
		t.Fatalf("only committed writes may be audited: count=%d err=%v", count, err)
	}

	// Two independent roots: opposite concurrent reparent operations must not
	// both commit a cycle. This catches a check-then-update race.
	var wg sync.WaitGroup
	results := make(chan error, 2)
	for _, pair := range [][2]string{{a, d}, {d, a}} {
		wg.Add(1)
		go func(child, newParent string) {
			defer wg.Done()
			_, e := repo.UpdatePath(ctx, actor, child, taxonomy.PathPatch{ParentPathID: parent(newParent)})
			results <- e
		}(pair[0], pair[1])
	}
	wg.Wait()
	close(results)
	success, conflict := 0, 0
	for e := range results {
		switch {
		case e == nil:
			success++
		case errors.Is(e, taxonomy.ErrConflict):
			conflict++
		default:
			t.Fatalf("unexpected concurrent reparent error: %v", e)
		}
	}
	if success != 1 || conflict != 1 {
		t.Fatalf("concurrent opposing parent changes: successes=%d conflicts=%d", success, conflict)
	}
}
