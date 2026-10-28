package postgres

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPublicCommerceScopePostgresArchivedTaxonomyHidesPublishedCourse(t *testing.T) {
	if os.Getenv("TAXONOMY_TEST_DB") != "1" || os.Getenv("DATABASE_URL") == "" {
		t.Skip("TAXONOMY_TEST_DB=1 and isolated migrated DATABASE_URL required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	admin, err := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := fmt.Sprintf("public_commerce_scope_%d", time.Now().UnixNano())
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	defer admin.Exec(context.Background(), "DROP SCHEMA "+schema+" CASCADE")
	cfg, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema + ",public"
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	for _, table := range []string{"paths", "levels", "subjects", "courses"} {
		if _, err = db.Exec(ctx, "CREATE TABLE "+table+" (LIKE public."+table+" INCLUDING ALL)"); err != nil {
			t.Fatal(err)
		}
	}
	var root, path, other, subject, course, level string
	readID := func(target *string, sql string, args ...any) {
		t.Helper()
		if err := db.QueryRow(ctx, sql, args...).Scan(target); err != nil {
			t.Fatal(err)
		}
	}
	readID(&root, `INSERT INTO paths(code,name)VALUES('R','Root')RETURNING id::text`)
	readID(&path, `INSERT INTO paths(code,name,parent_path_id)VALUES('P','Child',$1::uuid)RETURNING id::text`, root)
	readID(&other, `INSERT INTO paths(code,name)VALUES('O','Other')RETURNING id::text`)
	readID(&subject, `INSERT INTO subjects(code,name,path_id)VALUES('S','Subject',$1::uuid)RETURNING id::text`, path)
	readID(&course, `INSERT INTO courses(path_id,subject_id,title,workflow_status,is_published,is_visible)VALUES($1::uuid,$2::uuid,'Still published','approved',true,true)RETURNING id::text`, path, subject)
	repo := New(db)
	check := func(pathID, subjectID string, want bool) {
		t.Helper()
		got, err := repo.PublicCommerceScopeVisible(ctx, pathID, subjectID)
		if err != nil || got != want {
			t.Fatalf("scope %q/%q got=%v want=%v err=%v", pathID, subjectID, got, want, err)
		}
	}
	check(path, "", true)
	check("", subject, true)
	check(path, subject, true)
	check(other, subject, false)
	check("", "", false)
	for _, status := range []string{"inactive", "archived"} {
		if _, err = db.Exec(ctx, `UPDATE paths SET status=$1 WHERE id=$2::uuid`, status, root); err != nil {
			t.Fatal(err)
		}
		check(path, "", false)
		check("", subject, false)
		check(path, subject, false)
		// The narrower public read port does not silently rewrite the purchase scope contract.
		if valid, err := repo.ValidCommerceScope(ctx, path, subject); err != nil || !valid {
			t.Fatalf("purchase contract changed: %v %v", valid, err)
		}
	}
	if _, err = db.Exec(ctx, `UPDATE paths SET status='active' WHERE id=$1::uuid`, root); err != nil {
		t.Fatal(err)
	}
	check(path, subject, true)
	if _, err = db.Exec(ctx, `UPDATE paths SET status='archived' WHERE id=$1::uuid`, path); err != nil {
		t.Fatal(err)
	}
	check(path, "", false)
	check("", subject, false)
	check(path, subject, false)
	if _, err = db.Exec(ctx, `UPDATE paths SET status='active' WHERE id=$1::uuid`, path); err != nil {
		t.Fatal(err)
	}
	readID(&level, `INSERT INTO levels(path_id,code,name)VALUES($1::uuid,'L','Level')RETURNING id::text`, path)
	if _, err = db.Exec(ctx, `UPDATE subjects SET level_id=$1::uuid WHERE id=$2::uuid`, level, subject); err != nil {
		t.Fatal(err)
	}
	check(path, subject, true)
	check("", subject, true)
	for _, status := range []string{"inactive", "archived"} {
		if _, err = db.Exec(ctx, `UPDATE levels SET status=$1 WHERE id=$2::uuid`, status, level); err != nil {
			t.Fatal(err)
		}
		check(path, "", true)
		check(path, subject, false)
		check("", subject, false)
		if valid, err := repo.ValidCommerceScope(ctx, path, subject); err != nil || !valid {
			t.Fatalf("level visibility changed purchase scope: %v %v", valid, err)
		}
	}
	if _, err = db.Exec(ctx, `UPDATE levels SET status='active',path_id=$1::uuid WHERE id=$2::uuid`, other, level); err != nil {
		t.Fatal(err)
	}
	check(path, subject, false)
	check("", subject, false)
	// An unscoped subject level remains allowed, matching public taxonomy behavior.
	if _, err = db.Exec(ctx, `UPDATE subjects SET level_id=NULL WHERE id=$1::uuid`, subject); err != nil {
		t.Fatal(err)
	}
	check(path, subject, true)
	check("", subject, true)
	if _, err = db.Exec(ctx, `UPDATE subjects SET status='archived' WHERE id=$1::uuid`, subject); err != nil {
		t.Fatal(err)
	}
	check(path, "", true)
	check("", subject, false)
	check(path, subject, false)
	var stillPublished bool
	if err = db.QueryRow(ctx, `SELECT workflow_status='approved' AND is_published AND is_visible FROM courses WHERE id=$1::uuid`, course).Scan(&stillPublished); err != nil || !stillPublished {
		t.Fatalf("course flags unexpectedly changed: %v %v", stillPublished, err)
	}
}
