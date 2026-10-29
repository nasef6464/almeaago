package postgres

import (
    "context"
    "fmt"
    "os"
    "testing"
    "time"

    "github.com/jackc/pgx/v5/pgxpool"
)

// TestAdminVisibilityReachesLearnerPostgres covers the admin change -> persisted
// taxonomy -> public bootstrap and learner goal/study-plan read contracts.
// A disposable schema is used; no production data or shared fixtures are touched.
func TestAdminVisibilityReachesLearnerPostgres(t *testing.T) {
    if os.Getenv("TAXONOMY_VISIBILITY_DB_TEST") != "1" || os.Getenv("DATABASE_URL") == "" {
        t.Skip("TAXONOMY_VISIBILITY_DB_TEST=1 and disposable DATABASE_URL required")
    }
    ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
    defer cancel()
    url := os.Getenv("DATABASE_URL")
    admin, err := pgxpool.New(ctx, url)
    if err != nil { t.Fatal(err) }
    defer admin.Close()
    schema := fmt.Sprintf("taxonomy_visibility_%d", time.Now().UnixNano())
    if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil { t.Fatal(err) }
    defer func() {
        c, done := context.WithTimeout(context.Background(), 5*time.Second)
        defer done()
        _, _ = admin.Exec(c, "DROP SCHEMA "+schema+" CASCADE")
    }()
    cfg, err := pgxpool.ParseConfig(url)
    if err != nil { t.Fatal(err) }
    cfg.ConnConfig.RuntimeParams["search_path"] = schema
    db, err := pgxpool.NewWithConfig(ctx, cfg)
    if err != nil { t.Fatal(err) }
    defer db.Close()

    for _, ddl := range []string{
        `CREATE TABLE paths (
            id uuid PRIMARY KEY, code text NOT NULL, name text NOT NULL,
            parent_path_id uuid, description text NOT NULL DEFAULT '',
            sort_order integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'active'
        )`,
        `CREATE TABLE levels (
            id uuid PRIMARY KEY, path_id uuid NOT NULL REFERENCES paths(id),
            code text NOT NULL, name text NOT NULL, sort_order integer NOT NULL DEFAULT 0,
            status text NOT NULL DEFAULT 'active'
        )`,
        `CREATE TABLE subjects (
            id uuid PRIMARY KEY, path_id uuid NOT NULL REFERENCES paths(id),
            level_id uuid REFERENCES levels(id), code text NOT NULL, name text NOT NULL,
            sort_order integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'active'
        )`,
        `CREATE TABLE skills (
            id uuid PRIMARY KEY, subject_id uuid NOT NULL REFERENCES subjects(id),
            parent_skill_id uuid REFERENCES skills(id), code text NOT NULL,
            name text NOT NULL, description text NOT NULL DEFAULT '',
            kind text NOT NULL, sort_order integer NOT NULL DEFAULT 0,
            status text NOT NULL DEFAULT 'active'
        )`,
    } {
        if _, err := db.Exec(ctx, ddl); err != nil { t.Fatal(err) }
    }

    const (
        path = "01900000-0000-7000-8000-000000009101"
        levelActive = "01900000-0000-7000-8000-000000009102"
        levelInactive = "01900000-0000-7000-8000-000000009103"
        subjectActive = "01900000-0000-7000-8000-000000009104"
        subjectInactiveLevel = "01900000-0000-7000-8000-000000009105"
        subjectNoLevel = "01900000-0000-7000-8000-000000009106"
        mainInactive = "01900000-0000-7000-8000-000000009107"
        subOrphan = "01900000-0000-7000-8000-000000009108"
        mainActive = "01900000-0000-7000-8000-000000009109"
        subActive = "01900000-0000-7000-8000-000000009110"
    )
    for _, stmt := range []struct{ sql string; args []any }{
        {`INSERT INTO paths(id,code,name) VALUES($1,'PATH','Path')`, []any{path}},
        {`INSERT INTO levels(id,path_id,code,name,status) VALUES
            ($1,$3,'ACTIVE','Active','active'),($2,$3,'INACTIVE','Inactive','inactive')`,
            []any{levelActive,levelInactive,path}},
        {`INSERT INTO subjects(id,path_id,level_id,code,name) VALUES
            ($1,$4,$5,'SA','Active subject'),
            ($2,$4,$6,'SI','Inactive level subject'),
            ($3,$4,NULL,'SN','No level subject')`,
            []any{subjectActive,subjectInactiveLevel,subjectNoLevel,path,levelActive,levelInactive}},
        {`INSERT INTO skills(id,subject_id,parent_skill_id,code,name,kind,status) VALUES
            ($1,$5,NULL,'MI','Inactive main','main','inactive'),
            ($2,$5,$1,'SO','Orphaned sub','sub','active'),
            ($3,$5,NULL,'MA','Active main','main','active'),
            ($4,$5,$3,'SA','Active sub','sub','active')`,
            []any{mainInactive,subOrphan,mainActive,subActive,subjectActive}},
    } {
        if _, err := db.Exec(ctx, stmt.sql, stmt.args...); err != nil { t.Fatal(err) }
    }

    r := New(db)
    hasSubject := func(id string) bool {
        bootstrap, err := r.PublicBootstrap(ctx, true)
        if err != nil { t.Fatal(err) }
        for _, s := range bootstrap.Subjects { if s.ID == id { return true } }
        return false
    }
    hasSkill := func(id string) bool {
        bootstrap, err := r.PublicBootstrap(ctx, true)
        if err != nil { t.Fatal(err) }
        for _, s := range bootstrap.Skills { if s.ID == id { return true } }
        return false
    }
    if !hasSubject(subjectActive) || !hasSubject(subjectNoLevel) || hasSubject(subjectInactiveLevel) {
        t.Fatal("public subjects must respect the admin level state")
    }
    if !hasSkill(mainActive) || !hasSkill(subActive) {
        t.Fatal("active main and sub skills must remain visible")
    }
    if hasSkill(subOrphan) {
        t.Fatal("active sub-skill must be hidden while its main skill is inactive")
    }

    ok, err := r.ValidateMasteryGoalScope(ctx, path, subjectInactiveLevel)
    if err != nil { t.Fatal(err) }
    if ok { t.Fatal("inactive level must be rejected for learner mastery goal") }
    ok, err = r.ValidateStudyPlanScope(ctx, path, []string{subjectActive, subjectInactiveLevel})
    if err != nil { t.Fatal(err) }
    if ok { t.Fatal("inactive level must be rejected for learner study plan") }
    for _, subject := range []string{subjectActive,subjectNoLevel} {
        ok, err = r.ValidateMasteryGoalScope(ctx, path, subject)
        if err != nil || !ok { t.Fatalf("active subject %s should be valid for goal: %v %v", subject, ok, err) }
        ok, err = r.ValidateStudyPlanScope(ctx, path, []string{subject})
        if err != nil || !ok { t.Fatalf("active subject %s should be valid for plan: %v %v", subject, ok, err) }
    }
    ok, err = r.ValidateMasteryGoalScope(ctx, path, "")
    if err != nil || !ok { t.Fatalf("path-only goal must remain valid: %v %v", ok, err) }
    ok, err = r.ValidateStudyPlanScope(ctx, path, nil)
    if err != nil || !ok { t.Fatalf("empty subject selection remains valid: %v %v", ok, err) }

    // The same admin records are changed and re-read: no stale Go cache or
    // phantom client-side entitlement. This is a read-scope check, not RBAC.
    if _, err := db.Exec(ctx, "UPDATE levels SET status='active' WHERE id=$1", levelInactive); err != nil { t.Fatal(err) }
    if !hasSubject(subjectInactiveLevel) { t.Fatal("activated level must reveal its subject") }
    ok, err = r.ValidateMasteryGoalScope(ctx, path, subjectInactiveLevel)
    if err != nil || !ok { t.Fatalf("activated level must permit goal: %v %v", ok, err) }
    ok, err = r.ValidateStudyPlanScope(ctx, path, []string{subjectInactiveLevel})
    if err != nil || !ok { t.Fatalf("activated level must permit plan: %v %v", ok, err) }
    if _, err := db.Exec(ctx, "UPDATE skills SET status='active' WHERE id=$1", mainInactive); err != nil { t.Fatal(err) }
    if !hasSkill(subOrphan) { t.Fatal("activating main skill must reveal its sub-skill") }
    if _, err := db.Exec(ctx, "UPDATE skills SET status='inactive' WHERE id=$1", mainInactive); err != nil { t.Fatal(err) }
    if hasSkill(subOrphan) { t.Fatal("deactivating main skill must hide its sub-skill again") }
}
