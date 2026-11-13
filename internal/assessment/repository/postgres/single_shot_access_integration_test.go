package postgres

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

func TestSingleShotAccessLookupPostgres(t *testing.T) {
	dsn := os.Getenv("ASSESSMENT_ATTEMPT_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("use disposable local PostgreSQL")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	cfg.MaxConns = 1
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	conn, err := db.Acquire(ctx)
	if err != nil {
		t.Fatal(err)
	}
	_, err = conn.Exec(ctx, `
CREATE TEMP TABLE paths(id uuid,parent_path_id uuid,status text,presentation jsonb);
CREATE TEMP TABLE subjects(id uuid,path_id uuid,status text,presentation jsonb,level_id uuid);
CREATE TEMP TABLE levels(id uuid,path_id uuid,status text,presentation jsonb);
CREATE TEMP TABLE assessments(id uuid,assessment_code text,published_version int,workflow_status text,is_published bool,is_visible bool);
CREATE TEMP TABLE assessment_versions(assessment_id uuid,version int,assessment_kind text,access_type text,path_id uuid,subject_id uuid,mock_presentation_mode text,mock_strict_section_lock bool);
CREATE TEMP TABLE assessment_attempts(id uuid,student_id uuid,assessment_id uuid,status text,submission_key text,start_key text);
INSERT INTO paths VALUES ('00000000-0000-0000-0000-000000000001',NULL,'active','{}');
INSERT INTO assessments VALUES ('00000000-0000-0000-0000-000000000011','CODE-A',1,'approved',true,true),('00000000-0000-0000-0000-000000000012','CODE-B',1,'approved',true,true);
INSERT INTO assessment_versions VALUES ('00000000-0000-0000-0000-000000000011',1,'mock','free','00000000-0000-0000-0000-000000000001',NULL,'qiyas_strict',true),('00000000-0000-0000-0000-000000000012',1,'normal','paid','00000000-0000-0000-0000-000000000001',NULL,NULL,NULL);
INSERT INTO assessment_attempts VALUES ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000011','in_progress',NULL,'key-a');`)
	conn.Release()
	if err != nil {
		t.Fatal(err)
	}
	repo := New(db, nil)
	scope, strict, err := repo.GetSingleShotAccessContext(ctx, "CODE-A")
	if err != nil || scope.AssessmentID != "00000000-0000-0000-0000-000000000011" || !strict {
		t.Fatalf("code lookup scope=%+v strict=%v err=%v", scope, strict, err)
	}
	if _, found, err := repo.FindSingleShotResult(ctx, "00000000-0000-0000-0000-000000000031", "CODE-A", "key-a"); err != nil || found {
		t.Fatalf("in-progress key: found=%v err=%v", found, err)
	}
	if _, _, err := repo.FindSingleShotResult(ctx, "00000000-0000-0000-0000-000000000031", "CODE-B", "key-a"); !errors.Is(err, assessment.ErrConflict) {
		t.Fatalf("cross-assessment collision: %v", err)
	}
	if _, _, err := repo.FindSingleShotResult(ctx, "00000000-0000-0000-0000-000000000032", "CODE-A", "key-a"); !errors.Is(err, assessment.ErrConflict) {
		t.Fatalf("cross-student collision: %v", err)
	}
	if _, err = db.Exec(ctx, `ALTER TABLE assessment_attempts DROP COLUMN student_id`); err != nil {
		t.Fatal(err)
	}
	if _, _, err = repo.FindSingleShotResult(ctx, "00000000-0000-0000-0000-000000000031", "CODE-A", "key-a"); err == nil {
		t.Fatal("database failure was ignored")
	}
}
