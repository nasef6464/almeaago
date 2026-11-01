package postgres

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	commerceapp "github.com/nasef6464/almeaago/internal/commerce/application"
)

// This boundary was previously optional at runtime and silently hid every
// course offer when the taxonomy repository did not implement it.
var _ commerceapp.PublicCatalogScopeResolver = (*Repository)(nil)

func TestPublicCommerceScopeLifecyclePostgres(t *testing.T) {
	if os.Getenv("PUBLIC_COMMERCE_SCOPE_DB_TEST") != "1" || os.Getenv("DATABASE_URL") == "" {
		t.Skip("PUBLIC_COMMERCE_SCOPE_DB_TEST=1 and dedicated loopback DATABASE_URL required")
	}
	dsn, err := url.Parse(os.Getenv("DATABASE_URL"))
	if err != nil || dsn.Hostname() != "127.0.0.1" || dsn.Port() != "55439" || dsn.Path != "/almeaa_owner_verify_20261101" || dsn.RawQuery != "sslmode=disable" {
		t.Fatal("refusing database outside the dedicated loopback verification instance")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	admin, err := pgxpool.New(ctx, dsn.String())
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := fmt.Sprintf("public_commerce_scope_%d", time.Now().UnixNano())
	quotedSchema := pgx.Identifier{schema}.Sanitize()
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+quotedSchema); err != nil {
		t.Fatal(err)
	}
	defer func() {
		cleanup, stop := context.WithTimeout(context.Background(), 10*time.Second)
		defer stop()
		if _, err := admin.Exec(cleanup, "DROP SCHEMA "+quotedSchema+" CASCADE"); err != nil {
			t.Errorf("cleanup: %v", err)
		}
	}()
	cfg, err := pgxpool.ParseConfig(dsn.String())
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema + ",public"
	cfg.MaxConns = 2
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	// Clone the migrated table shape and checks into our own schema. Foreign
	// level/path disagreement is intentional: a reference can outlive reassignment.
	for _, table := range []string{"paths", "levels", "subjects"} {
		if _, err := db.Exec(ctx, "CREATE TABLE "+table+" (LIKE public."+table+" INCLUDING ALL)"); err != nil {
			t.Fatal(err)
		}
	}
	const root = "20000000-0000-4000-8000-000000000001"
	const child = "20000000-0000-4000-8000-000000000002"
	const other = "20000000-0000-4000-8000-000000000003"
	const level = "20000000-0000-4000-8000-000000000004"
	const subject = "20000000-0000-4000-8000-000000000005"
	const noLevel = "20000000-0000-4000-8000-000000000006"
	if _, err := db.Exec(ctx, `
		INSERT INTO paths(id,code,name,parent_path_id,presentation) VALUES
		('20000000-0000-4000-8000-000000000001','ROOT','Root',NULL,'{"showInNavbar":false}'),
		('20000000-0000-4000-8000-000000000002','CHILD','Child','20000000-0000-4000-8000-000000000001','{}'),
		('20000000-0000-4000-8000-000000000003','OTHER','Other',NULL,'{}');
		INSERT INTO levels(id,path_id,code,name) VALUES ('20000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000002','LEVEL','Level');
		INSERT INTO subjects(id,path_id,level_id,code,name) VALUES
		('20000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000004','LEVELED','Leveled'),
		('20000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000002',NULL,'NOLEVEL','No level');
	`); err != nil {
		t.Fatal(err)
	}
	repo := New(db)
	assertScope := func(t *testing.T, pathID, subjectID string, want bool) {
		t.Helper()
		got, err := repo.PublicCommerceScopeVisible(ctx, pathID, subjectID)
		if err != nil || got != want {
			t.Fatalf("public scope path=%q subject=%q got=%v want=%v err=%v", pathID, subjectID, got, want, err)
		}
	}
	assertScope(t, root, "", true) // showInNavbar=false must not hide storefront scope.
	assertScope(t, child, "", true)
	assertScope(t, child, subject, true)
	assertScope(t, "", subject, true)
	assertScope(t, child, noLevel, true)
	assertScope(t, other, subject, false)
	assertScope(t, "", "", false)
	assertScope(t, "unknown", "", false)
	assertScope(t, child, "unknown", false)
	for _, status := range []string{"inactive", "archived"} {
		t.Run("ancestor_"+status, func(t *testing.T) {
			if _, err := db.Exec(ctx, `UPDATE paths SET status=$1 WHERE id=$2::uuid`, status, root); err != nil {
				t.Fatal(err)
			}
			assertScope(t, root, "", false)
			assertScope(t, child, "", false)
			assertScope(t, child, subject, false)
			assertScope(t, "", noLevel, false)
			if _, err := db.Exec(ctx, `UPDATE paths SET status='active' WHERE id=$1::uuid`, root); err != nil {
				t.Fatal(err)
			}
		})
		t.Run("level_"+status, func(t *testing.T) {
			if _, err := db.Exec(ctx, `UPDATE levels SET status=$1 WHERE id=$2::uuid`, status, level); err != nil {
				t.Fatal(err)
			}
			assertScope(t, child, subject, false)
			assertScope(t, "", subject, false)
			assertScope(t, child, noLevel, true)
			if _, err := db.Exec(ctx, `UPDATE levels SET status='active' WHERE id=$1::uuid`, level); err != nil {
				t.Fatal(err)
			}
		})
		t.Run("subject_"+status, func(t *testing.T) {
			if _, err := db.Exec(ctx, `UPDATE subjects SET status=$1 WHERE id=$2::uuid`, status, subject); err != nil {
				t.Fatal(err)
			}
			assertScope(t, child, subject, false)
			if _, err := db.Exec(ctx, `UPDATE subjects SET status='active' WHERE id=$1::uuid`, subject); err != nil {
				t.Fatal(err)
			}
		})
	}
	if _, err := db.Exec(ctx, `UPDATE levels SET path_id=$1::uuid WHERE id=$2::uuid`, other, level); err != nil {
		t.Fatal(err)
	}
	assertScope(t, child, subject, false)
	assertScope(t, "", subject, false)
	assertScope(t, child, noLevel, true)
}
