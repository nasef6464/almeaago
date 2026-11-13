package postgres

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
)

func TestTaxonomyDeleteProtectsReferences(t *testing.T) {
	raw := os.Getenv("COMMERCE_JOURNEY_TEST_DATABASE_URL")
	if raw == "" {
		t.Skip("requires isolated local test database")
	}
	u, err := url.Parse(raw)
	if err != nil || u.Hostname() != "127.0.0.1" || u.Port() != "56561" || u.Path != "/almeaa_package_journey" {
		t.Fatal("requires dedicated local database")
	}
	ctx := context.Background()
	admin, err := pgxpool.New(ctx, raw)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := fmt.Sprintf("taxonomy_delete_%d", time.Now().UnixNano())
	quoted := pgx.Identifier{schema}.Sanitize()
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+quoted); err != nil {
		t.Fatal(err)
	}
	defer admin.Exec(ctx, "DROP SCHEMA "+quoted+" CASCADE")
	cfg, err := pgxpool.ParseConfig(raw)
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema + ",public"
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	_, err = db.Exec(ctx, `CREATE TABLE paths(id uuid PRIMARY KEY);
CREATE TABLE levels(id uuid PRIMARY KEY, path_id uuid REFERENCES paths(id) ON DELETE CASCADE, UNIQUE(id,path_id));
CREATE TABLE navigation_stages(level_id uuid, path_id uuid, FOREIGN KEY(level_id,path_id) REFERENCES levels(id,path_id));
CREATE TABLE subjects(id uuid PRIMARY KEY, level_id uuid REFERENCES levels(id) ON DELETE SET NULL);
CREATE TABLE student_records(id uuid PRIMARY KEY, subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE);
CREATE TABLE users(id uuid PRIMARY KEY);
CREATE TABLE audit_logs(actor_user_id uuid, action text, resource_type text, resource_id text, status text, metadata jsonb);
INSERT INTO users VALUES ('00000000-0000-0000-0000-000000000010');
INSERT INTO paths VALUES ('00000000-0000-0000-0000-000000000001');
INSERT INTO levels VALUES ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001');
INSERT INTO subjects VALUES ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002');
INSERT INTO student_records VALUES ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000003');`)
	if err != nil {
		t.Fatal(err)
	}
	r := New(db)
	actor := "00000000-0000-0000-0000-000000000010"
	ids := []string{"00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002", "00000000-0000-0000-0000-000000000003"}
	for i, kind := range []string{"path", "level", "subject"} {
		if err = r.DeleteTaxonomy(ctx, actor, kind, ids[i]); !errors.Is(err, taxonomy.ErrHasDependencies) {
			t.Fatalf("%s: %v", kind, err)
		}
	}
	if _, err = db.Exec(ctx, "DELETE FROM student_records"); err != nil {
		t.Fatal(err)
	}
	for i, kind := range []string{"subject", "level", "path"} {
		if err = r.DeleteTaxonomy(ctx, actor, kind, ids[2-i]); err != nil {
			t.Fatalf("delete %s: %v", kind, err)
		}
	}
	var audits int
	if err = db.QueryRow(ctx, "SELECT count(*) FROM audit_logs").Scan(&audits); err != nil || audits != 3 {
		t.Fatalf("audits %d: %v", audits, err)
	}
}
