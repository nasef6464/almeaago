package postgres

import (
    "context"
    "os"
    "testing"
    "time"

    "github.com/jackc/pgx/v5/pgxpool"
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

    const path = "00000000-0000-0000-0000-000000000801"
    const otherPath = "00000000-0000-0000-0000-000000000802"
    const level = "00000000-0000-0000-0000-000000000803"
    const leveledSubject = "00000000-0000-0000-0000-000000000804"
    const noLevelSubject = "00000000-0000-0000-0000-000000000805"
    const otherSubject = "00000000-0000-0000-0000-000000000806"
    fixtures := []string{
        `INSERT INTO paths(id,code,name,status) VALUES
          ('` + path + `','SCOPE-PATH','مسار','active'),
          ('` + otherPath + `','SCOPE-OTHER','مسار آخر','active')`,
        `INSERT INTO levels(id,path_id,code,name,status) VALUES
          ('` + level + `','` + path + `','L1','المرحلة','active')`,
        `INSERT INTO subjects(id,path_id,level_id,code,name,status) VALUES
          ('` + leveledSubject + `','` + path + `','` + level + `','LEVELED','مادة بمرحلة','active'),
          ('` + noLevelSubject + `','` + path + `',NULL,'NOLEVEL','مادة بدون مرحلة','active'),
          ('` + otherSubject + `','` + otherPath + `',NULL,'OTHER','مادة خارج المسار','active')`,
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
            fn func() (bool, error)
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

    assertScope("active", true)
    for _, status := range []string{"inactive", "archived", "active"} {
        if _, err := db.Exec(ctx, "UPDATE levels SET status=$1 WHERE id=$2::uuid", status, level); err != nil {
            t.Fatal(err)
        }
        assertScope(status, status == "active")
    }
}
