package postgres

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

func TestSelfQuizCandidatesCompleteVisibleAndScopedPostgres(t *testing.T) {
	dsn := os.Getenv("ASSESSMENT_SELF_SCHEMA_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("disposable local PostgreSQL required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	admin, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := pgx.Identifier{fmt.Sprintf("self_candidates_%d", time.Now().UnixNano())}.Sanitize()
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	defer admin.Exec(context.Background(), "DROP SCHEMA "+schema+" CASCADE")
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema + ",public"
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	_, err = db.Exec(ctx, `
CREATE TABLE paths(id uuid PRIMARY KEY,parent_path_id uuid,status text,presentation jsonb);
CREATE TABLE levels(id uuid,path_id uuid,status text,presentation jsonb);
CREATE TABLE subjects(id uuid PRIMARY KEY,path_id uuid,level_id uuid,status text,presentation jsonb);
CREATE TABLE skills(id uuid PRIMARY KEY,subject_id uuid,status text);
CREATE TABLE questions(id uuid PRIMARY KEY,current_version int,path_id uuid,subject_id uuid,workflow_status text,owner_type text);
CREATE TABLE question_versions(question_id uuid,version int,question_type text,difficulty text,correct_option_index int);
CREATE TABLE question_options(question_id uuid,version int,option_index int);
CREATE TABLE question_skill_links(question_id uuid,skill_id uuid);
INSERT INTO paths VALUES (md5('p')::uuid,NULL,'active','{}'),(md5('hidden')::uuid,NULL,'active','{"isVisible":false}'),(md5('child')::uuid,md5('hidden')::uuid,'active','{}');
INSERT INTO subjects VALUES (md5('s')::uuid,md5('p')::uuid,NULL,'active','{}'),(md5('s2')::uuid,md5('p')::uuid,NULL,'active','{}'),(md5('sh')::uuid,md5('child')::uuid,NULL,'active','{}');
INSERT INTO skills VALUES (md5('skill')::uuid,md5('s')::uuid,'active'),(md5('skill2')::uuid,md5('s2')::uuid,'active'),(md5('hidden-skill')::uuid,md5('sh')::uuid,'active');
INSERT INTO questions SELECT md5('q'||n)::uuid,1,md5('p')::uuid,md5('s')::uuid,'approved','platform' FROM generate_series(1,1201) n;
INSERT INTO question_versions SELECT id,1,'mcq','medium',0 FROM questions;
INSERT INTO question_options SELECT id,1,0 FROM questions;
INSERT INTO question_skill_links SELECT id,md5('skill')::uuid FROM questions;
INSERT INTO questions VALUES
 (md5('infer')::uuid,1,NULL,NULL,'approved','platform'),
 (md5('ambiguous')::uuid,1,NULL,NULL,'approved','platform'),
 (md5('hidden-q')::uuid,1,md5('child')::uuid,md5('sh')::uuid,'approved','platform'),
 (md5('teacher')::uuid,1,md5('p')::uuid,md5('s')::uuid,'approved','teacher'),
 (md5('draft')::uuid,1,md5('p')::uuid,md5('s')::uuid,'draft','platform'),
 (md5('bad-option')::uuid,1,md5('p')::uuid,md5('s')::uuid,'approved','platform'),
 (md5('old-version')::uuid,2,md5('p')::uuid,md5('s')::uuid,'approved','platform');
INSERT INTO question_versions SELECT id,current_version,'mcq','medium',0 FROM questions WHERE id IN (md5('infer')::uuid,md5('ambiguous')::uuid,md5('hidden-q')::uuid,md5('teacher')::uuid,md5('draft')::uuid,md5('bad-option')::uuid,md5('old-version')::uuid);
INSERT INTO question_options SELECT id,current_version,0 FROM questions WHERE id IN (md5('infer')::uuid,md5('ambiguous')::uuid,md5('hidden-q')::uuid,md5('teacher')::uuid,md5('draft')::uuid,md5('old-version')::uuid);
DELETE FROM question_options WHERE question_id=md5('bad-option')::uuid;
INSERT INTO question_skill_links VALUES (md5('infer')::uuid,md5('skill')::uuid),(md5('ambiguous')::uuid,md5('skill')::uuid),(md5('ambiguous')::uuid,md5('skill2')::uuid);
`)
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(ctx, `ALTER TABLE skills ADD COLUMN section_id uuid, ADD COLUMN parent_skill_id uuid;
		ALTER TABLE questions ADD COLUMN section_id uuid;
		CREATE TABLE taxonomy_skill_sections(id uuid PRIMARY KEY,subject_id uuid,status text);
		INSERT INTO taxonomy_skill_sections VALUES (md5('section')::uuid,md5('s')::uuid,'active'),(md5('archived')::uuid,md5('s')::uuid,'archived');
		UPDATE skills SET section_id=md5('section')::uuid WHERE id=md5('skill')::uuid;
		UPDATE questions SET section_id=md5('section')::uuid WHERE id=md5('q1')::uuid`)
	if err != nil {
		t.Fatal(err)
	}
	repo := New(db, nil)
	input := assessment.SelfQuizInput{QuestionCount: 10, TimeLimitMinutes: 10, StartKey: "candidate-test"}
	list, err := repo.ListSelfQuizCandidates(ctx, input)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1203 {
		t.Fatalf("got %d candidates, want all 1203", len(list))
	}
	var inferred, versioned bool
	var inferID, versionID string
	if err = db.QueryRow(ctx, `SELECT md5('infer')::uuid::text,md5('old-version')::uuid::text`).Scan(&inferID, &versionID); err != nil {
		t.Fatal(err)
	}
	for _, q := range list {
		if q.ID == inferID {
			inferred = q.PathID != "" && q.SubjectID != "" && len(q.SkillIDs) == 1
		}
		if q.ID == versionID {
			versioned = q.Version == 2
		}
	}
	if !inferred || !versioned {
		t.Fatalf("inference %v current version %v", inferred, versioned)
	}
	var skill, hidden string
	if err = db.QueryRow(ctx, `SELECT md5('skill')::uuid::text,md5('hidden-skill')::uuid::text`).Scan(&skill, &hidden); err != nil {
		t.Fatal(err)
	}
	scopes, err := repo.ResolveSelfQuizSkills(ctx, []string{skill})
	if err != nil || len(scopes) != 1 || !scopes[0].Active {
		t.Fatalf("scope %+v %v", scopes, err)
	}
	if _, err = repo.ResolveSelfQuizSkills(ctx, []string{hidden}); err != assessment.ErrSelfQuizScopeMismatch {
		t.Fatalf("hidden skill accepted: %v", err)
	}
	var section, path, subject, otherSubject, archived string
	if err = db.QueryRow(ctx, `SELECT md5('section')::uuid::text,md5('p')::uuid::text,md5('s')::uuid::text,md5('s2')::uuid::text,md5('archived')::uuid::text`).Scan(&section, &path, &subject, &otherSubject, &archived); err != nil {
		t.Fatal(err)
	}
	input.SectionID, input.PathID, input.SubjectID = section, path, subject
	if err = repo.ValidateSelfQuizSection(ctx, input); err != nil {
		t.Fatal(err)
	}
	sectionCandidates, err := repo.ListSelfQuizCandidates(ctx, input)
	if err != nil || len(sectionCandidates) != 1 || sectionCandidates[0].SectionID != section {
		t.Fatalf("section selection: %+v %v", sectionCandidates, err)
	}
	input.SubjectID = otherSubject
	if err = repo.ValidateSelfQuizSection(ctx, input); err != assessment.ErrSelfQuizScopeMismatch {
		t.Fatalf("wrong subject: %v", err)
	}
	input.SubjectID, input.SectionID = subject, archived
	if err = repo.ValidateSelfQuizSection(ctx, input); err != assessment.ErrSelfQuizScopeMismatch {
		t.Fatalf("archived section: %v", err)
	}
}
