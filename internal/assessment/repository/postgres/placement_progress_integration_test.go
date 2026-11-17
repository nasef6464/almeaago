package postgres

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

// This fixture uses temporary tables on a single connection; only a disposable
// local PostgreSQL instance should be supplied through the opt-in test URL.
func TestSubjectPlacementProgressPostgres(t *testing.T) {
	dsn := os.Getenv("ASSESSMENT_ATTEMPT_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("ASSESSMENT_ATTEMPT_TEST_DATABASE_URL required: use disposable local PostgreSQL")
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
	_, err = db.Exec(ctx, `
CREATE TEMP TABLE assessments(id uuid, workflow_status text, is_published boolean, is_visible boolean);
CREATE TEMP TABLE assessment_versions(assessment_id uuid, version integer);
CREATE TEMP TABLE assessment_learning_placements(id uuid, assessment_id uuid, assessment_version integer, path_id uuid, subject_id uuid, slot text, is_visible boolean);
CREATE TEMP TABLE assessment_attempts(placement_id uuid, student_id uuid, status text);
INSERT INTO assessments VALUES
 ('00000000-0000-0000-0000-000000000001','approved',true,true),
 ('00000000-0000-0000-0000-000000000002','approved',false,true),
 ('00000000-0000-0000-0000-000000000003','draft',true,true),
 ('00000000-0000-0000-0000-000000000004','approved',true,false);
INSERT INTO assessment_versions SELECT id,1 FROM assessments;
INSERT INTO assessment_learning_placements
 SELECT md5('placement-' || n::text)::uuid,'00000000-0000-0000-0000-000000000001',1,
 '00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000011','training',true
 FROM generate_series(1,55) AS n;
INSERT INTO assessment_learning_placements VALUES
 (md5('hidden')::uuid,'00000000-0000-0000-0000-000000000001',1,'00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000011','training',false),
 (md5('unpublished')::uuid,'00000000-0000-0000-0000-000000000002',1,'00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000011','training',true),
 (md5('draft')::uuid,'00000000-0000-0000-0000-000000000003',1,'00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000011','training',true),
 (md5('hidden-assessment')::uuid,'00000000-0000-0000-0000-000000000004',1,'00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000011','training',true),
 (md5('other-subject')::uuid,'00000000-0000-0000-0000-000000000001',1,'00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000012','training',true),
 (md5('other-path')::uuid,'00000000-0000-0000-0000-000000000001',1,'00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000011','training',true),
 (md5('other-slot')::uuid,'00000000-0000-0000-0000-000000000001',1,'00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000011','tests',true);
INSERT INTO assessment_attempts VALUES
 (md5('placement-1')::uuid,'00000000-0000-0000-0000-000000000021','submitted'),
 (md5('placement-1')::uuid,'00000000-0000-0000-0000-000000000021','submitted'),
 (md5('placement-55')::uuid,'00000000-0000-0000-0000-000000000021','submitted'),
 (md5('placement-2')::uuid,'00000000-0000-0000-0000-000000000021','in_progress'),
 (md5('placement-3')::uuid,'00000000-0000-0000-0000-000000000021','abandoned'),
 (md5('placement-4')::uuid,'00000000-0000-0000-0000-000000000021','expired'),
 (md5('placement-5')::uuid,'00000000-0000-0000-0000-000000000022','submitted'),
 (md5('hidden')::uuid,'00000000-0000-0000-0000-000000000021','submitted'),
 (md5('unpublished')::uuid,'00000000-0000-0000-0000-000000000021','submitted'),
 (md5('other-subject')::uuid,'00000000-0000-0000-0000-000000000021','submitted');`)
	if err != nil {
		t.Fatal(err)
	}
	repo := New(db, nil)
	q := assessment.LearnerPlacementQuery{PathID: "00000000-0000-0000-0000-000000000010", SubjectID: "00000000-0000-0000-0000-000000000011", Slot: assessment.PlacementTraining}
	got, err := repo.CountLearnerPlacementProgress(ctx, "00000000-0000-0000-0000-000000000021", q)
	if err != nil || got.Total != 55 || got.Completed != 2 {
		t.Fatalf("student one: got %+v, error %v; want 55 visible cards and 2 submitted cards", got, err)
	}
	got, err = repo.CountLearnerPlacementProgress(ctx, "00000000-0000-0000-0000-000000000022", q)
	if err != nil || got.Total != 55 || got.Completed != 1 {
		t.Fatalf("student two isolation: got %+v, error %v; want 55/1", got, err)
	}
	q.SubjectID = "00000000-0000-0000-0000-000000000012"
	got, err = repo.CountLearnerPlacementProgress(ctx, "00000000-0000-0000-0000-000000000021", q)
	if err != nil || got.Total != 1 || got.Completed != 1 {
		t.Fatalf("other subject: got %+v, error %v; want 1/1", got, err)
	}
	q.SubjectID = "00000000-0000-0000-0000-000000000099"
	got, err = repo.CountLearnerPlacementProgress(ctx, "00000000-0000-0000-0000-000000000021", q)
	if err != nil || got.Total != 0 || got.Completed != 0 {
		t.Fatalf("empty subject: got %+v, error %v; want 0/0", got, err)
	}
}
