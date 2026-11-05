package postgres

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
)

// TestTaxonomyLearnerScopeFollowsLevelVisibilityPostgres checks the manager-to-
// learner contract using real PostgreSQL queries. All fixtures live in session-
// local shadow tables; no production or persistent taxonomy rows are written.
func TestTaxonomyLearnerScopeFollowsLevelVisibilityPostgres(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL required for PostgreSQL integration")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	config.MaxConns = 1 // TEMP tables must remain on the same PostgreSQL session.
	db, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	for _, table := range []string{"paths", "levels", "subjects"} {
		if _, err := db.Exec(ctx, "CREATE TEMP TABLE "+table+" (LIKE public."+table+" INCLUDING DEFAULTS INCLUDING CONSTRAINTS)"); err != nil {
			t.Fatalf("create temporary %s: %v", table, err)
		}
	}

	// Shadow the mutation audit tables so real Go transactions remain isolated.
	for _, statement := range []string{
		"CREATE TEMP TABLE users (id uuid PRIMARY KEY)",
		"CREATE TEMP TABLE audit_logs (actor_user_id uuid, action text, resource_type text, resource_id text, status text, metadata jsonb)",
		"INSERT INTO users(id) VALUES ('00000000-0000-0000-0000-000000000899')",
	} {
		if _, err := db.Exec(ctx, statement); err != nil {
			t.Fatal(err)
		}
	}
	const actor = "00000000-0000-0000-0000-000000000899"
	const path = "00000000-0000-0000-0000-000000000801"
	const otherPath = "00000000-0000-0000-0000-000000000802"
	const childPath = "00000000-0000-0000-0000-000000000807"
	const childSubject = "00000000-0000-0000-0000-000000000808"
	const level = "00000000-0000-0000-0000-000000000803"
	const leveledSubject = "00000000-0000-0000-0000-000000000804"
	const noLevelSubject = "00000000-0000-0000-0000-000000000805"
	const otherSubject = "00000000-0000-0000-0000-000000000806"
	fixtures := []string{
		`INSERT INTO paths(id,code,name,status) VALUES
          ('` + path + `','SCOPE-PATH','مسار','active'),
          ('` + otherPath + `','SCOPE-OTHER','مسار آخر','active'),
          ('` + childPath + `','SCOPE-CHILD','مسار فرعي','active')`,
		`INSERT INTO levels(id,path_id,code,name,status) VALUES
          ('` + level + `','` + path + `','L1','المرحلة','active')`,
		`INSERT INTO subjects(id,path_id,level_id,code,name,status) VALUES
          ('` + leveledSubject + `','` + path + `','` + level + `','LEVELED','مادة بمرحلة','active'),
          ('` + noLevelSubject + `','` + path + `',NULL,'NOLEVEL','مادة بدون مرحلة','active'),
          ('` + otherSubject + `','` + otherPath + `',NULL,'OTHER','مادة خارج المسار','active'),
          ('` + childSubject + `','` + childPath + `',NULL,'CHILD','مادة فرعية','active')`,
	}
	for _, query := range fixtures {
		if _, err := db.Exec(ctx, query); err != nil {
			t.Fatal(err)
		}
	}
	repo := New(db)

	assertScope := func(status string, expectedLeveled bool) {
		t.Helper()
		bootstrap, err := repo.PublicBootstrap(ctx, false)
		if err != nil {
			t.Fatal(err)
		}
		visible := false
		for _, subject := range bootstrap.Subjects {
			if subject.ID == leveledSubject {
				visible = true
			}
		}
		if visible != expectedLeveled {
			t.Fatalf("level=%s public bootstrap visibility=%v want=%v", status, visible, expectedLeveled)
		}
		goal, err := repo.ValidateMasteryGoalScope(ctx, path, leveledSubject)
		if err != nil {
			t.Fatal(err)
		}
		plan, err := repo.ValidateStudyPlanScope(ctx, path, []string{leveledSubject})
		if err != nil {
			t.Fatal(err)
		}
		if goal != expectedLeveled || plan != expectedLeveled {
			t.Fatalf("level=%s learner goal=%v study plan=%v; public visibility=%v", status, goal, plan, expectedLeveled)
		}
		for _, check := range []struct {
			label string
			fn    func() (bool, error)
		}{
			{"no-level goal", func() (bool, error) { return repo.ValidateMasteryGoalScope(ctx, path, noLevelSubject) }},
			{"no-level plan", func() (bool, error) { return repo.ValidateStudyPlanScope(ctx, path, []string{noLevelSubject}) }},
			{"path-only goal", func() (bool, error) { return repo.ValidateMasteryGoalScope(ctx, path, "") }},
			{"all-active-subjects plan", func() (bool, error) { return repo.ValidateStudyPlanScope(ctx, path, nil) }},
		} {
			ok, err := check.fn()
			if err != nil || !ok {
				t.Fatalf("level=%s %s should remain allowed, ok=%v err=%v", status, check.label, ok, err)
			}
		}
		if ok, err := repo.ValidateStudyPlanScope(ctx, path, []string{noLevelSubject, leveledSubject}); err != nil || ok != expectedLeveled {
			t.Fatalf("level=%s mixed selection ok=%v err=%v want=%v", status, ok, err, expectedLeveled)
		}
		if ok, err := repo.ValidateStudyPlanScope(ctx, path, []string{otherSubject}); err != nil || ok {
			t.Fatalf("cross-path subject accepted: ok=%v err=%v", ok, err)
		}
	}

	// Archiving a parent path or subject must hide learner content without
	// deleting the canonical child rows. Restoring the same UUIDs must make
	// existing relationships visible again (no destructive recreation).
	assertHierarchy := func(label string, wantVisible bool) {
		t.Helper()
		bootstrap, err := repo.PublicBootstrap(ctx, false)
		if err != nil {
			t.Fatal(err)
		}
		visible := false
		for _, subject := range bootstrap.Subjects {
			if subject.ID == leveledSubject {
				visible = true
			}
		}
		if visible != wantVisible {
			t.Fatalf("%s subject visible=%v want=%v", label, visible, wantVisible)
		}
		goal, err := repo.ValidateMasteryGoalScope(ctx, path, leveledSubject)
		if err != nil || goal != wantVisible {
			t.Fatalf("%s goal allowed=%v err=%v want=%v", label, goal, err, wantVisible)
		}
		plan, err := repo.ValidateStudyPlanScope(ctx, path, []string{leveledSubject})
		if err != nil || plan != wantVisible {
			t.Fatalf("%s plan allowed=%v err=%v want=%v", label, plan, err, wantVisible)
		}
		// Admin must retain the same canonical entities and exact archived status
		// even while the public learner bootstrap hides them. This is essential
		// for restoring the existing record instead of recreating children.
		admin, err := repo.AdminBootstrap(ctx)
		if err != nil {
			t.Fatal(err)
		}
		var foundPath, foundSubject bool
		for _, row := range admin.Paths {
			if row.ID == path {
				foundPath = true
				var status string
				if err := db.QueryRow(ctx, "SELECT status FROM paths WHERE id=$1::uuid", path).Scan(&status); err != nil {
					t.Fatal(err)
				}
				if string(row.Status) != status {
					t.Fatalf("%s admin path status=%s persisted=%s", label, row.Status, status)
				}
			}
		}
		for _, row := range admin.Subjects {
			if row.ID == leveledSubject {
				foundSubject = true
				if row.PathID != path || row.LevelID != level {
					t.Fatalf("%s admin subject relationship changed: %+v", label, row)
				}
				var status string
				if err := db.QueryRow(ctx, "SELECT status FROM subjects WHERE id=$1::uuid", leveledSubject).Scan(&status); err != nil {
					t.Fatal(err)
				}
				if string(row.Status) != status {
					t.Fatalf("%s admin subject status=%s persisted=%s", label, row.Status, status)
				}
			}
		}
		if !foundPath || !foundSubject {
			t.Fatalf("%s admin lost archived entities: path=%v subject=%v", label, foundPath, foundSubject)
		}
		var parentID, levelID string
		if err := db.QueryRow(ctx, "SELECT path_id::text, level_id::text FROM subjects WHERE id=$1::uuid", leveledSubject).Scan(&parentID, &levelID); err != nil {
			t.Fatal(err)
		}
		if parentID != path || levelID != level {
			t.Fatalf("%s archive/restore changed subject relationships: path=%s level=%s", label, parentID, levelID)
		}
	}
	assertHierarchy("initial", true)
	for _, target := range []struct{ table, id string }{{"subjects", leveledSubject}, {"paths", path}} {
		for _, status := range []taxonomy.Status{taxonomy.StatusArchived, taxonomy.StatusActive} {
			if target.table == "subjects" {
				if _, err := repo.UpdateSubject(ctx, actor, target.id, taxonomy.SubjectPatch{Status: &status}); err != nil {
					t.Fatalf("UpdateSubject %s: %v", status, err)
				}
			} else {
				if _, err := repo.UpdatePath(ctx, actor, target.id, taxonomy.PathPatch{Status: &status}); err != nil {
					t.Fatalf("UpdatePath %s: %v", status, err)
				}
			}
			assertHierarchy(target.table+" "+string(status), status == taxonomy.StatusActive)
		}
	}
	var auditCount int
	if err := db.QueryRow(ctx, "SELECT count(*) FROM audit_logs WHERE actor_user_id=$1::uuid AND action IN ('taxonomy.path.update','taxonomy.subject.update')", actor).Scan(&auditCount); err != nil || auditCount != 4 {
		t.Fatalf("archive/restore audit writes=%d err=%v want=4", auditCount, err)
	}

	// An active nested path must disappear from all learner surfaces while its
	// ancestor is archived, without deleting its own row or child subject.
	if _, err := db.Exec(ctx, "UPDATE paths SET parent_path_id=$1::uuid WHERE id=$2::uuid", path, childPath); err != nil {
		t.Fatal(err)
	}
	assertChild := func(want bool) {
		t.Helper()
		bootstrap, err := repo.PublicBootstrap(ctx, true)
		if err != nil {
			t.Fatal(err)
		}
		var visiblePath, visibleSubject bool
		for _, row := range bootstrap.Paths {
			if row.ID == childPath {
				visiblePath = true
			}
		}
		for _, row := range bootstrap.Subjects {
			if row.ID == childSubject {
				visibleSubject = true
			}
		}
		if visiblePath != want || visibleSubject != want {
			t.Fatalf("nested path visibility: path=%v subject=%v want=%v", visiblePath, visibleSubject, want)
		}
		allowed, err := repo.ValidateMasteryGoalScope(ctx, childPath, childSubject)
		if err != nil || allowed != want {
			t.Fatalf("nested mastery scope=%v err=%v want=%v", allowed, err, want)
		}
		allowed, err = repo.ValidateStudyPlanScope(ctx, childPath, []string{childSubject})
		if err != nil || allowed != want {
			t.Fatalf("nested study plan scope=%v err=%v want=%v", allowed, err, want)
		}
		admin, err := repo.AdminBootstrap(ctx)
		if err != nil {
			t.Fatal(err)
		}
		var retained bool
		for _, row := range admin.Paths {
			if row.ID == childPath {
				retained = row.ParentPathID == path
			}
		}
		if !retained {
			t.Fatal("admin lost nested path parent relationship")
		}
	}
	assertChild(true)
	// Exercise the production repository mutation, not a direct SQL shortcut:
	// both archive and restore must retain nested path/subject references.
	for _, status := range []taxonomy.Status{taxonomy.StatusArchived, taxonomy.StatusActive} {
		updated, err := repo.UpdatePath(ctx, actor, path, taxonomy.PathPatch{Status: &status})
		if err != nil {
			t.Fatalf("nested parent UpdatePath %s: %v", status, err)
		}
		if updated.ID != path || updated.Status != status {
			t.Fatalf("nested parent update returned %+v, want id=%s status=%s", updated, path, status)
		}
		assertChild(status == taxonomy.StatusActive)
	}
	if err := db.QueryRow(ctx, "SELECT count(*) FROM audit_logs WHERE actor_user_id=$1::uuid AND action='taxonomy.path.update'", actor).Scan(&auditCount); err != nil || auditCount != 4 {
		t.Fatalf("nested archive/restore path audit writes=%d err=%v want=4", auditCount, err)
	}

	assertScope("active", true)
	for _, status := range []string{"inactive", "archived", "active"} {
		if _, err := db.Exec(ctx, "UPDATE levels SET status=$1 WHERE id=$2::uuid", status, level); err != nil {
			t.Fatal(err)
		}
		assertScope(status, status == "active")
	}
}
