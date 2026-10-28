package postgres

import (
	"context"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	taxonomyapp "github.com/nasef6464/almeaago/internal/taxonomy/application"
	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
	"os"
	"testing"
	"time"
)

func TestDisplayPostgresSaveReloadAndAuditRollback(t *testing.T) {
	if os.Getenv("TAXONOMY_TEST_DB") != "1" || os.Getenv("DATABASE_URL") == "" {
		t.Skip("TAXONOMY_TEST_DB=1 and isolated DATABASE_URL required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	admin, err := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := fmt.Sprintf("taxonomy_display_%d", time.Now().UnixNano())
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	defer admin.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE")
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
	for _, table := range []string{"users", "paths", "levels", "subjects", "skills", "audit_logs"} {
		if _, err = db.Exec(ctx, "CREATE TABLE "+table+" (LIKE public."+table+" INCLUDING ALL)"); err != nil {
			t.Fatal(err)
		}
	}
	// Schema-local tables isolate all mutations and rollback injection from existing data.
	actor := "00000000-0000-0000-0000-000000000001"
	// The audit writer resolves the actor from the schema-local users table.
	if _, err = db.Exec(ctx, `INSERT INTO users(id,email,name,password_hash) VALUES($1,'display@example.test','display','test')`, actor); err != nil {
		t.Fatal(err)
	}
	repo := New(db)
	no := false
	yes := true
	icon, color := "🧪", "#abcdef"
	stage, label := "required", "المرحلة"
	p, err := repo.CreatePath(ctx, actor, taxonomy.PathWrite{Code: "DISPLAY", Name: "عرض", ShowInNavbar: &no, ShowInHome: &no, Settings: &taxonomy.PathSettings{ShowMockExamCard: &no, StageSelection: &stage, StageLabel: &label}})
	if err != nil {
		t.Fatal(err)
	}
	sub, err := repo.CreateSubject(ctx, actor, taxonomy.SubjectWrite{PathID: p.ID, Code: "S", Name: "مادة", Icon: &icon, Color: &color})
	if err != nil {
		t.Fatal(err)
	}
	b, err := repo.PublicBootstrap(ctx, false)
	if err != nil {
		t.Fatal(err)
	}
	if len(b.Paths) != 1 || b.Paths[0].ShowInNavbar == nil || *b.Paths[0].ShowInNavbar || *b.Paths[0].Settings.ShowMockExamCard || b.Subjects[0].Icon != icon || b.Paths[0].ShowInHome == nil || *b.Paths[0].ShowInHome || b.Paths[0].Settings.StageSelection == nil || *b.Paths[0].Settings.StageSelection != "required" {
		t.Fatalf("reload lost presentation: %+v", b)
	}
	if _, err = db.Exec(ctx, `UPDATE paths SET presentation=presentation || '{"other":"keep"}'::jsonb || jsonb_build_object('settings',presentation->'settings' || '{"other":true}'::jsonb)`); err != nil {
		t.Fatal(err)
	}
	if _, err = repo.UpdatePath(ctx, actor, p.ID, taxonomy.PathPatch{ShowInNavbar: &yes}); err != nil {
		t.Fatal(err)
	}
	empty := ""
	if _, err = repo.UpdateSubject(ctx, actor, sub.ID, taxonomy.SubjectPatch{Icon: &empty, Color: &empty}); err != nil {
		t.Fatal(err)
	}
	b, err = repo.AdminBootstrap(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if b.Subjects[0].Icon != "" || b.Subjects[0].Color != "" || *b.Paths[0].Settings.ShowMockExamCard {
		t.Fatalf("empty/omitted semantics lost: %+v", b)
	}
	var kept bool
	if err = db.QueryRow(ctx, `SELECT presentation->>'other'='keep' AND presentation->'settings'->>'other'='true' FROM paths`).Scan(&kept); err != nil || !kept {
		t.Fatalf("unknown fields lost %v", err)
	}
	if _, err = db.Exec(ctx, `ALTER TABLE audit_logs ADD CONSTRAINT reject_display_audit CHECK (action <> 'taxonomy.path.update') NOT VALID`); err != nil {
		t.Fatal(err)
	}
	if _, err = repo.UpdatePath(ctx, actor, p.ID, taxonomy.PathPatch{ShowInNavbar: &no}); err == nil {
		t.Fatal("audit rejection must fail mutation")
	}
	b, err = repo.PublicBootstrap(ctx, false)
	if err != nil {
		t.Fatal(err)
	}
	if !*b.Paths[0].ShowInNavbar {
		t.Fatal("failed audit committed presentation")
	}
	// Source staff projection has no inactive/archived predicate; public remains active-only.
	service := taxonomyapp.NewService(repo)
	for _, status := range []string{"inactive", "archived"} {
		if _, err = db.Exec(ctx, `UPDATE paths SET status=$1 WHERE id=$2::uuid`, status, p.ID); err != nil {
			t.Fatal(err)
		}
		public, privileged, err := service.NavigationBootstrap(ctx, "core", identity.User{ID: actor, Roles: []identity.Role{identity.RoleStudent}})
		if err != nil || privileged || len(public.Paths) != 0 || len(public.Subjects) != 0 || len(public.Levels) != 0 {
			t.Fatalf("public scope leak for %s: %+v %v", status, public, err)
		}
		staff, privileged, err := service.NavigationBootstrap(ctx, "core", identity.User{ID: actor, Roles: []identity.Role{identity.RoleTeacher}})
		if err != nil || !privileged || len(staff.Paths) != 1 || len(staff.Subjects) != 1 || string(staff.Paths[0].Status) != status {
			t.Fatalf("staff structure lost %s: %+v %v", status, staff, err)
		}
	}

}
