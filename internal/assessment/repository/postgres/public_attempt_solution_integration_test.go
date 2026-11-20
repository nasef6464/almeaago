package postgres

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPublicAttemptDoesNotExposeSolutionVideoPostgres(t *testing.T) {
	dsn := os.Getenv("ASSESSMENT_ATTEMPT_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("requires isolated PostgreSQL")
	}
	ctx := context.Background()
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
CREATE TEMP TABLE assessment_public_attempts(id uuid,session_id uuid,assessment_id uuid,assessment_version int,attempt_number int,status text,started_at timestamptz,expires_at timestamptz,participant_key_hash bytea);
CREATE TEMP TABLE assessment_sessions(id uuid,session_code text);
CREATE TEMP TABLE assessment_versions(assessment_id uuid,version int,title text,show_progress_bar bool,require_answer_before_next bool,option_layout text,randomize_questions bool,randomize_options bool);
CREATE TEMP TABLE assessment_version_questions(assessment_id uuid,assessment_version int,question_id uuid,question_version int,section_id uuid,sort_order int,points numeric);
CREATE TEMP TABLE question_versions(question_id uuid,version int,question_type text,text_content text,image_asset_id uuid,image_alt text,options_embedded_in_image bool,video_url text,difficulty text,source_meta jsonb);
CREATE TEMP TABLE assets(id uuid,public_url text);
CREATE TEMP TABLE question_options(question_id uuid,version int,option_index int,option_text text,asset_id uuid);
INSERT INTO assessment_sessions VALUES ('00000000-0000-0000-0000-000000000001','code');
INSERT INTO assessment_versions VALUES ('00000000-0000-0000-0000-000000000002',1,'exam',true,false,'auto',false,false);
INSERT INTO assessment_public_attempts VALUES ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',1,1,'in_progress',now(),NULL,decode('aabb','hex'));
INSERT INTO assessment_version_questions VALUES ('00000000-0000-0000-0000-000000000002',1,'00000000-0000-0000-0000-000000000004',1,NULL,1,1);
INSERT INTO question_versions VALUES ('00000000-0000-0000-0000-000000000004',1,'mcq','question',NULL,'',false,'https://example.invalid/solution','easy','{}');
INSERT INTO question_options VALUES ('00000000-0000-0000-0000-000000000004',1,0,'yes',NULL);`)
	if err != nil {
		t.Fatal(err)
	}
	attempt, err := New(db, nil).getPublicAttempt(ctx, "00000000-0000-0000-0000-000000000003", []byte{0xaa, 0xbb})
	if err != nil {
		t.Fatal(err)
	}
	body, err := json.Marshal(attempt)
	if err != nil || len(attempt.Questions) != 1 || strings.Contains(string(body), "example.invalid/solution") {
		t.Fatalf("solution leaked: %s %v", body, err)
	}
}
