package postgres

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

type zeroScoreAudit struct{}

func (zeroScoreAudit) WriteTx(context.Context, pgx.Tx, operations.AuditEvent) error { return nil }

func TestSubmitZeroScorePostgres(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	admin, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := fmt.Sprintf("zero_score_%d", time.Now().UnixNano())
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	defer admin.Exec(context.Background(), "DROP SCHEMA "+schema+" CASCADE")
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	_, err = db.Exec(ctx, `
CREATE TABLE assessment_attempts(id uuid,student_id uuid,assessment_id uuid,assessment_version int,status text,expires_at timestamptz,submission_key text,submitted_at timestamptz,updated_at timestamptz);
CREATE TABLE assessment_versions(assessment_id uuid,version int,passing_score float8);
CREATE TABLE assessment_version_questions(assessment_id uuid,assessment_version int,question_id uuid,question_version int,points float8);
CREATE TABLE question_versions(question_id uuid,version int,correct_option_index int);
CREATE TABLE assessment_answers(attempt_id uuid,question_id uuid,question_version int,selected_option_index int,is_correct bool,scored_at timestamptz,time_spent_seconds int);
CREATE TABLE assessment_results(attempt_id uuid,assessment_id uuid,assessment_version int,student_id uuid,score float8,total_questions int,correct_answers int,wrong_answers int,unanswered int,passed bool,time_spent_seconds int,finalized_at timestamptz DEFAULT now());
INSERT INTO assessment_versions VALUES ('00000000-0000-0000-0000-000000000003',1,50);
INSERT INTO assessment_version_questions VALUES ('00000000-0000-0000-0000-000000000003',1,'00000000-0000-0000-0000-000000000004',1,1);
INSERT INTO question_versions VALUES ('00000000-0000-0000-0000-000000000004',1,1);
INSERT INTO assessment_attempts(id,student_id,assessment_id,assessment_version,status) VALUES
('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003',1,'in_progress'),
('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003',1,'in_progress'),
('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003',1,'in_progress');
INSERT INTO assessment_answers(attempt_id,question_id,question_version,selected_option_index,time_spent_seconds) VALUES
('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000004',1,0,1),
('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000004',1,1,1);`)
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		id                         string
		score                      float64
		correct, wrong, unanswered int
	}{
		{"00000000-0000-0000-0000-000000000010", 0, 0, 0, 1},
		{"00000000-0000-0000-0000-000000000011", 0, 0, 1, 0},
		{"00000000-0000-0000-0000-000000000012", 100, 1, 0, 0},
	} {
		result, err := New(db, zeroScoreAudit{}).Submit(ctx, "00000000-0000-0000-0000-000000000001", tc.id, "test-key")
		if err != nil {
			t.Fatalf("submit %s: %v", tc.id, err)
		}
		if result.Score != tc.score || result.CorrectAnswers != tc.correct || result.WrongAnswers != tc.wrong || result.Unanswered != tc.unanswered {
			t.Fatalf("unexpected result: %+v", result)
		}
	}
	if _, err = db.Exec(ctx, `INSERT INTO assessment_attempts(id,student_id,assessment_id,assessment_version,status,expires_at) VALUES
('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003',1,'in_progress',now()-interval '1 minute'),
('00000000-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003',1,'expired',now()-interval '1 minute');
INSERT INTO assessment_answers(attempt_id,question_id,question_version,selected_option_index,time_spent_seconds) VALUES
('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000004',1,1,1),
('00000000-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000004',1,1,1);`); err != nil {
		t.Fatal(err)
	}
	for _, id := range []string{"00000000-0000-0000-0000-000000000013", "00000000-0000-0000-0000-000000000014"} {
		result, err := New(db, zeroScoreAudit{}).Submit(ctx, "00000000-0000-0000-0000-000000000001", id, "expired-"+id)
		if err != nil || result.Score != 100 {
			t.Fatalf("expired attempt must score saved answers: %+v %v", result, err)
		}
		retry, err := New(db, zeroScoreAudit{}).Submit(ctx, "00000000-0000-0000-0000-000000000001", id, "expired-"+id)
		if err != nil || retry.AttemptID != result.AttemptID {
			t.Fatalf("retry must be idempotent: %+v %v", retry, err)
		}
	}
}
