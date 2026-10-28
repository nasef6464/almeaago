package navigation

import (
	"context"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"reflect"
	"testing"
	"time"
)

func TestPostgresSaveReloadIsolationForeignLevelAndAuditRollback(t *testing.T) {
	if os.Getenv("NAVIGATION_TEST_DB") != "1" || os.Getenv("DATABASE_URL") == "" {
		t.Skip("NAVIGATION_TEST_DB=1 and isolated DATABASE_URL required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	admin, err := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := fmt.Sprintf("learning_navigation_%d", time.Now().UnixNano())
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
	for _, table := range []string{"users", "paths", "levels", "audit_logs"} {
		if _, err = db.Exec(ctx, "CREATE TABLE "+table+" (LIKE public."+table+" INCLUDING ALL)"); err != nil {
			t.Fatal(err)
		}
	}
	migration, err := os.ReadFile("../../../migrations/000046_learning_navigation_preferences.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	down, err := os.ReadFile("../../../migrations/000046_learning_navigation_preferences.down.sql")
	if err != nil {
		t.Fatal(err)
	}
	for _, sql := range [][]byte{migration, down, migration} {
		if _, err = db.Exec(ctx, string(sql)); err != nil {
			t.Fatal(err)
		}
	}
	const actor = "00000000-0000-0000-0000-000000000001"
	const other = "00000000-0000-0000-0000-000000000002"
	const path = "00000000-0000-0000-0000-000000000003"
	const foreignPath = "00000000-0000-0000-0000-000000000004"
	const level = "00000000-0000-0000-0000-000000000005"
	const foreignLevel = "00000000-0000-0000-0000-000000000006"
	if _, err = db.Exec(ctx, `INSERT INTO users(id,email,name,password_hash) VALUES($1,'nav@test','nav','test'),($2,'other@test','other','test')`, actor, other); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `INSERT INTO paths(id,code,name) VALUES($1,'p','p'),($2,'q','q')`, path, foreignPath); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `INSERT INTO levels(id,path_id,code,name) VALUES($1,$2,'l','l'),($3,$4,'m','m')`, level, path, foreignLevel, foreignPath); err != nil {
		t.Fatal(err)
	}
	repo := NewPostgres(db)
	ids := []string{path}
	stages := []Stage{{path, level}}
	want, err := repo.Patch(ctx, actor, true, Patch{&ids, &stages})
	if err != nil {
		t.Fatal(err)
	}
	got, err := NewPostgres(db).Get(ctx, actor)
	if err != nil || !reflect.DeepEqual(got, want) {
		t.Fatalf("reload: %+v %v", got, err)
	}
	isolated, err := repo.Get(ctx, other)
	if err != nil || len(isolated.EnrolledPaths) > 0 {
		t.Fatalf("actor leak: %+v %v", isolated, err)
	}
	bad := []Stage{{path, foreignLevel}}
	if _, err = repo.Patch(ctx, actor, true, Patch{PathStageSelections: &bad}); err == nil {
		t.Fatal("foreign stage accepted")
	}
	got, _ = repo.Get(ctx, actor)
	if !reflect.DeepEqual(got, want) {
		t.Fatal("foreign stage failure changed saved state")
	}
	// Composite FK independently enforces path/level relation beneath service validation.
	if _, err = db.Exec(ctx, `UPDATE learning_navigation_stages SET level_id=$1 WHERE user_id=$2`, foreignLevel, actor); err == nil {
		t.Fatal("foreign stage bypassed FK")
	}

	// Only selectable public levels constrain a new auto-stage choice; existing
	// persisted inactive selections remain roundtrippable without forced backfill.
	if _, err = db.Exec(ctx, `UPDATE levels SET status='inactive' WHERE id=$1`, level); err != nil {
		t.Fatal(err)
	}
	if _, err = repo.Patch(ctx, actor, true, Patch{EnrolledPaths: &ids, PathStageSelections: &stages}); err != nil {
		t.Fatalf("unchanged inactive stage rejected: %v", err)
	}
	if _, err = repo.Patch(ctx, other, true, Patch{EnrolledPaths: &ids, PathStageSelections: &stages}); err == nil {
		t.Fatal("new inactive stage accepted")
	}
	if got, err = repo.Patch(ctx, other, true, Patch{EnrolledPaths: &ids}); err != nil || len(got.PathStageSelections) != 0 {
		t.Fatalf("auto path without selectable levels must enroll without a stage: %+v %v", got, err)
	}
	if _, err = db.Exec(ctx, `UPDATE levels SET status='active' WHERE id=$1`, level); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `ALTER TABLE audit_logs ADD CONSTRAINT reject_navigation_audit CHECK(action <> 'learning.navigation_preferences.updated') NOT VALID`); err != nil {
		t.Fatal(err)
	}
	none := []string{}
	if _, err = repo.Patch(ctx, actor, true, Patch{EnrolledPaths: &none}); err == nil {
		t.Fatal("audit failure accepted")
	}
	got, _ = repo.Get(ctx, actor)
	if !reflect.DeepEqual(got, want) {
		t.Fatal("audit failure committed state")
	}
}
