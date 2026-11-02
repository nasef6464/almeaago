package postgres

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestLearningEvidencePathMockNullableSubjectPostgres(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	admin, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := fmt.Sprintf("mock_evidence_%d", time.Now().UnixNano())
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
	const student = "00000000-0000-0000-0000-000000000001"
	const attempt = "00000000-0000-0000-0000-000000000002"
	const assessment = "00000000-0000-0000-0000-000000000003"
	const path = "00000000-0000-0000-0000-000000000004"
	statements := []string{
		`CREATE TABLE assessment_attempts(id uuid,student_id uuid,assessment_id uuid,assessment_version int,status text);
 CREATE TABLE assessment_results(attempt_id uuid,finalized_at timestamptz);
 CREATE TABLE assessment_versions(assessment_id uuid,version int,path_id uuid,subject_id uuid);
 CREATE TABLE assessment_version_questions(assessment_id uuid,assessment_version int,question_id uuid,question_version int,sort_order int);
 CREATE TABLE assessment_answers(attempt_id uuid,question_id uuid,is_correct bool);
 CREATE TABLE questions(id uuid,path_id uuid,subject_id uuid);
 CREATE TABLE subjects(id uuid,path_id uuid);
 CREATE TABLE skills(id uuid,subject_id uuid);
 CREATE TABLE question_skill_links(question_id uuid,skill_id uuid);`,
		`INSERT INTO assessment_attempts VALUES('` + attempt + `','` + student + `','` + assessment + `',1,'submitted');
 INSERT INTO assessment_results VALUES('` + attempt + `',now());
 INSERT INTO assessment_versions VALUES('` + assessment + `',1,'` + path + `',NULL);`,
		`INSERT INTO subjects VALUES ('00000000-0000-0000-0000-000000000011','` + path + `'),('00000000-0000-0000-0000-000000000012','` + path + `');
 INSERT INTO questions VALUES ('00000000-0000-0000-0000-000000000021','` + path + `','00000000-0000-0000-0000-000000000011'),('00000000-0000-0000-0000-000000000022','` + path + `','00000000-0000-0000-0000-000000000012');
 INSERT INTO assessment_version_questions SELECT '` + assessment + `',1,id,1,1 FROM questions;
 INSERT INTO assessment_answers VALUES('` + attempt + `','00000000-0000-0000-0000-000000000021',true);
 INSERT INTO skills VALUES('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000011'),('00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-000000000012');
 INSERT INTO question_skill_links VALUES ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000031'),('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000032');`,
	}
	for _, sql := range statements {
		if _, err = db.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	event, err := New(db, nil).LearningSubmissionEvidence(ctx, student, attempt)
	if err != nil {
		t.Fatalf("path-level mock evidence must load with nullable assessment subject: %v", err)
	}
	if event.SubjectID != "" || len(event.Questions) != 2 {
		t.Fatalf("unexpected mock evidence: %+v", event)
	}
	for i, question := range event.Questions {
		wantSubject := fmt.Sprintf("00000000-0000-0000-0000-%012d", 11+i)
		if question.PathID != path || question.SubjectID != wantSubject || len(question.SkillIDs) != 1 {
			t.Fatalf("wrong per-question source scope: %+v", question)
		}
		if question.Answered != (i == 0) || question.Correct != (i == 0) {
			t.Fatalf("incorrect answer evidence: %+v", question)
		}
	}
	if _, err = New(db, nil).LearningSubmissionEvidence(ctx, "00000000-0000-0000-0000-000000000099", attempt); err == nil {
		t.Fatal("other student's attempt evidence must be rejected")
	}
	if _, err = db.Exec(ctx, `UPDATE skills SET subject_id='00000000-0000-0000-0000-000000000012' WHERE id='00000000-0000-0000-0000-000000000031'`); err != nil {
		t.Fatal(err)
	}
	if _, err = New(db, nil).LearningSubmissionEvidence(ctx, student, attempt); err == nil {
		t.Fatal("foreign subject skill evidence must be rejected")
	}
}
