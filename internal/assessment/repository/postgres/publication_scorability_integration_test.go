package postgres

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPublicationRejectsUnscorableQuestionPostgres(t *testing.T) {
	dsn := os.Getenv("ASSESSMENT_ATTEMPT_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("disposable local PostgreSQL required")
	}
	ctx := context.Background()
	admin, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := fmt.Sprintf("publication_guard_%d", time.Now().UnixNano())
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	defer admin.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE")
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
 CREATE TABLE assessments(id uuid PRIMARY KEY,revision int,current_version int,workflow_status text,is_published boolean,published_version int,updated_at timestamptz);
 CREATE TABLE assessment_version_questions(assessment_id uuid,assessment_version int,question_id uuid,question_version int);
 CREATE TABLE question_versions(question_id uuid,version int,correct_option_index int);
 CREATE TABLE question_options(question_id uuid,version int,option_index int,option_text text);
 INSERT INTO assessments VALUES ('00000000-0000-0000-0000-000000000001',1,1,'approved',false,NULL,now());
 INSERT INTO assessment_version_questions VALUES ('00000000-0000-0000-0000-000000000001',1,'00000000-0000-0000-0000-000000000002',1);
 INSERT INTO question_versions VALUES ('00000000-0000-0000-0000-000000000002',1,NULL);`)
	if err != nil {
		t.Fatal(err)
	}
	_, err = New(db, nil).SetPublication(ctx, "00000000-0000-0000-0000-000000000003", "00000000-0000-0000-0000-000000000001", 1, true)
	if err == nil || !strings.Contains(err.Error(), "غير قابل للتصحيح") {
		t.Fatalf("expected informative unscorable error, got %v", err)
	}
	var published bool
	var rev int
	if err = db.QueryRow(ctx, `SELECT is_published,revision FROM assessments`).Scan(&published, &rev); err != nil || published || rev != 1 {
		t.Fatalf("failed publication must rollback: published=%v revision=%d err=%v", published, rev, err)
	}
}

// An index without its matching question_options row is not answerable,
// including image questions whose labels have no text but still need rows.
func TestPublicationRejectsMissingCorrectOptionPostgres(t *testing.T) {
	dsn := os.Getenv("ASSESSMENT_ATTEMPT_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("disposable local PostgreSQL required")
	}
	ctx := context.Background()
	admin, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := fmt.Sprintf("publication_options_%d", time.Now().UnixNano())
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	defer admin.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE")
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
 CREATE TABLE assessments(id uuid PRIMARY KEY,revision int,current_version int,workflow_status text,is_published boolean,published_version int,updated_at timestamptz);
 CREATE TABLE assessment_version_questions(assessment_id uuid,assessment_version int,question_id uuid,question_version int);
 CREATE TABLE question_versions(question_id uuid,version int,correct_option_index int);
 CREATE TABLE question_options(question_id uuid,version int,option_index int,option_text text);
 INSERT INTO assessments VALUES ('00000000-0000-0000-0000-000000000001',1,1,'approved',false,NULL,now());
 INSERT INTO assessment_version_questions VALUES ('00000000-0000-0000-0000-000000000001',1,'00000000-0000-0000-0000-000000000002',1);
 INSERT INTO question_versions VALUES ('00000000-0000-0000-0000-000000000002',1,1);`)
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct{ name, optionSQL string }{
		{"no option rows", ""},
		{"only other option exists", `INSERT INTO question_options VALUES ('00000000-0000-0000-0000-000000000002',1,0,'')`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if tc.optionSQL != "" {
				if _, err = db.Exec(ctx, tc.optionSQL); err != nil {
					t.Fatal(err)
				}
			}
			_, err = New(db, nil).SetPublication(ctx, "00000000-0000-0000-0000-000000000003", "00000000-0000-0000-0000-000000000001", 1, true)
			if err == nil || !strings.Contains(err.Error(), "غير قابل للتصحيح") {
				t.Fatalf("expected informative unscorable error, got %v", err)
			}
			var published bool
			var rev int
			if err = db.QueryRow(ctx, `SELECT is_published,revision FROM assessments`).Scan(&published, &rev); err != nil || published || rev != 1 {
				t.Fatalf("failed publication must rollback: published=%v revision=%d err=%v", published, rev, err)
			}
		})
	}
}
