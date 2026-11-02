package postgres

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestResultSkillAnalysisSnapshotPostgres(t *testing.T) {
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
	schema := fmt.Sprintf("result_skills_%d", time.Now().UnixNano())
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
CREATE TABLE assessment_attempts(id uuid,student_id uuid,assessment_id uuid,assessment_version int,status text,attempt_number int);
CREATE TABLE assessment_versions(assessment_id uuid,version int,path_id uuid,title text,allow_question_review bool,show_answers bool,show_explanations bool,show_results_report bool,randomize_questions bool,randomize_options bool);
CREATE TABLE assessment_results(attempt_id uuid,student_id uuid,score float8,total_questions int,correct_answers int,wrong_answers int,unanswered int,passed bool,time_spent_seconds int,finalized_at timestamptz);
CREATE TABLE assessment_version_questions(assessment_id uuid,assessment_version int,question_id uuid,question_version int);
CREATE TABLE mastery_evidence(id uuid,student_id uuid,source_attempt_id uuid,evidence_type text,assessment_id uuid,assessment_version int,question_id uuid,question_version int,path_id uuid,subject_id uuid,answered bool,is_correct bool);
CREATE TABLE mastery_evidence_skills(evidence_id uuid,skill_id uuid);
CREATE TABLE paths(id uuid,status text);
CREATE TABLE subjects(id uuid,path_id uuid,name text,status text DEFAULT 'active');
CREATE TABLE skills(id uuid,subject_id uuid,name text);
CREATE TABLE foundation_topics(id uuid,path_id uuid,subject_id uuid,title text,is_locked bool,status text,is_visible bool,sort_order int);
CREATE TABLE topic_skill_links(topic_id uuid,skill_id uuid);
INSERT INTO assessment_attempts VALUES ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003',1,'submitted',1);
INSERT INTO assessment_versions VALUES ('00000000-0000-0000-0000-000000000003',1,'00000000-0000-0000-0000-000000000004','Test',false,true,true,true,false,false);
INSERT INTO assessment_results VALUES ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',50,2,1,0,1,true,0,now());
INSERT INTO assessment_version_questions VALUES ('00000000-0000-0000-0000-000000000003',1,'00000000-0000-0000-0000-000000000011',1),('00000000-0000-0000-0000-000000000003',1,'00000000-0000-0000-0000-000000000012',1);
INSERT INTO paths VALUES ('00000000-0000-0000-0000-000000000004','active');
INSERT INTO subjects(id,path_id,name) VALUES ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000004','Subject A'),('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000004','Subject B');
INSERT INTO skills VALUES ('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000005','Skill A'),('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000006','Skill B');
INSERT INTO mastery_evidence VALUES
('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','assessment','00000000-0000-0000-0000-000000000003',1,'00000000-0000-0000-0000-000000000011',1,'00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005',true,true),
('00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','assessment','00000000-0000-0000-0000-000000000003',1,'00000000-0000-0000-0000-000000000012',1,'00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000006',false,false);
INSERT INTO mastery_evidence_skills VALUES ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000020'),('00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-000000000021');`)
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(ctx, `
INSERT INTO foundation_topics VALUES
('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005','Topic A',false,'active',true,0),
('00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005','Locked topic',true,'active',true,1),
('00000000-0000-0000-0000-000000000043','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005','Hidden topic',false,'active',false,2),
('00000000-0000-0000-0000-000000000044','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000006','Foreign subject',false,'active',true,3),
('00000000-0000-0000-0000-000000000045','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005','Archived',false,'archived',true,4);
INSERT INTO topic_skill_links SELECT id,'00000000-0000-0000-0000-000000000020' FROM foundation_topics;`)
	if err != nil {
		t.Fatal(err)
	}
	repo := New(db, nil)
	const student = "00000000-0000-0000-0000-000000000002"
	const attempt = "00000000-0000-0000-0000-000000000001"
	detail, err := repo.GetResultDetail(ctx, student, attempt)
	if err != nil {
		t.Fatal(err)
	}
	if detail.SkillAnalysis == nil || !detail.SkillAnalysis.Complete || len(detail.SkillAnalysis.Items) != 2 {
		t.Fatalf("expected two scoped skills: %+v", detail.SkillAnalysis)
	}
	a, b := detail.SkillAnalysis.Items[0], detail.SkillAnalysis.Items[1]
	if a.SkillName != "Skill A" || a.Status != "strong" || a.Mastery != 100 || b.SkillName != "Skill B" || b.Status != "weak" || b.QuestionCount != 1 || b.CorrectCount != 0 {
		t.Fatalf("unexpected scoped results: %+v", detail.SkillAnalysis.Items)
	}
	if len(a.FoundationTopics) != 2 || a.FoundationTopics[0].Title != "Topic A" || a.FoundationTopics[0].IsLocked || a.FoundationTopics[1].Title != "Locked topic" || !a.FoundationTopics[1].IsLocked || len(b.FoundationTopics) != 0 {
		t.Fatalf("unexpected foundation mapping scope or visibility: %+v %+v", a.FoundationTopics, b.FoundationTopics)
	}
	// The second unanswered question remains in the denominator. Skill links
	// added after the attempt are deliberately irrelevant to this projection.
	if _, err = db.Exec(ctx, `
CREATE TABLE question_skill_links(question_id uuid,skill_id uuid);
INSERT INTO question_skill_links VALUES ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000021');
UPDATE mastery_evidence SET subject_id='00000000-0000-0000-0000-000000000005' WHERE id='00000000-0000-0000-0000-000000000032';
UPDATE mastery_evidence_skills SET skill_id='00000000-0000-0000-0000-000000000020' WHERE evidence_id='00000000-0000-0000-0000-000000000032';`); err != nil {
		t.Fatal(err)
	}
	detail, err = repo.GetResultDetail(ctx, student, attempt)
	if err != nil || detail.SkillAnalysis == nil || len(detail.SkillAnalysis.Items) != 1 || detail.SkillAnalysis.Items[0].Mastery != 50 || detail.SkillAnalysis.Items[0].QuestionCount != 2 || detail.SkillAnalysis.Items[0].CorrectCount != 1 {
		t.Fatalf("unanswered denominator or snapshot changed: %+v %v", detail.SkillAnalysis, err)
	}
	if _, err = db.Exec(ctx, `INSERT INTO mastery_evidence SELECT '00000000-0000-0000-0000-000000000039',student_id,source_attempt_id,evidence_type,assessment_id,assessment_version,question_id,question_version,path_id,subject_id,answered,is_correct FROM mastery_evidence WHERE id='00000000-0000-0000-0000-000000000031'`); err != nil {
		t.Fatal(err)
	}
	duplicate, err := repo.resultSkillAnalysis(ctx, student, attempt, 2)
	if err != nil || duplicate.Complete || len(duplicate.Items) != 0 {
		t.Fatalf("duplicate evidence accepted: %+v %v", duplicate, err)
	}
	if _, err = db.Exec(ctx, `DELETE FROM mastery_evidence WHERE id='00000000-0000-0000-0000-000000000039'`); err != nil {
		t.Fatal(err)
	}
	if _, err = repo.GetResultDetail(ctx, "00000000-0000-0000-0000-000000000099", attempt); err == nil {
		t.Fatal("other student can read result")
	}
	if _, err = db.Exec(ctx, `UPDATE assessment_versions SET show_results_report=false`); err != nil {
		t.Fatal(err)
	}
	detail, err = repo.GetResultDetail(ctx, student, attempt)
	if err != nil || detail.SkillAnalysis != nil {
		t.Fatalf("hidden report exposed analysis: %+v %v", detail.SkillAnalysis, err)
	}
	if _, err = db.Exec(ctx, `UPDATE assessment_versions SET show_results_report=true; DELETE FROM mastery_evidence WHERE question_id='00000000-0000-0000-0000-000000000012'`); err != nil {
		t.Fatal(err)
	}
	detail, err = repo.GetResultDetail(ctx, student, attempt)
	if err != nil || detail.SkillAnalysis == nil || detail.SkillAnalysis.Complete || len(detail.SkillAnalysis.Items) != 0 {
		t.Fatalf("incomplete evidence presented as complete: %+v %v", detail.SkillAnalysis, err)
	}
	if _, err = db.Exec(ctx, `UPDATE skills SET subject_id='00000000-0000-0000-0000-000000000006' WHERE id='00000000-0000-0000-0000-000000000020'`); err != nil {
		t.Fatal(err)
	}
	analysis, err := repo.resultSkillAnalysis(ctx, student, attempt, 2)
	if err != nil || analysis.Complete || len(analysis.Items) != 0 {
		t.Fatalf("out-of-scope skill presented: %+v %v", analysis, err)
	}
}
