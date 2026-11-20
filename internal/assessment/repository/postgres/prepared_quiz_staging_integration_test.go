package postgres

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

type preparedAudit struct{}

func (preparedAudit) WriteTx(context.Context, pgx.Tx, operations.AuditEvent) error { return nil }

func TestPreparedQuizStageIsAtomicAndCannotBeEnabled(t *testing.T) {
	dsn := os.Getenv("ASSESSMENT_SELF_SCHEMA_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("requires disposable local PostgreSQL")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	admin, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := fmt.Sprintf("prepared_stage_%d", time.Now().UnixNano())
	quoted := pgx.Identifier{schema}.Sanitize()
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+quoted); err != nil {
		t.Fatal(err)
	}
	defer admin.Exec(context.Background(), "DROP SCHEMA "+quoted+" CASCADE")
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
	_, err = db.Exec(ctx, `CREATE FUNCTION uuidv7() RETURNS uuid LANGUAGE SQL VOLATILE AS 'SELECT gen_random_uuid()';
CREATE TABLE users(id uuid PRIMARY KEY,name text NOT NULL DEFAULT '',email text NOT NULL DEFAULT ''); CREATE TABLE assessments(id uuid PRIMARY KEY,current_version int NOT NULL,published_version int,workflow_status text NOT NULL DEFAULT 'approved',is_published boolean NOT NULL DEFAULT true,is_visible boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE paths(id uuid PRIMARY KEY,parent_path_id uuid,status text NOT NULL DEFAULT 'active',presentation jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE levels(id uuid PRIMARY KEY,path_id uuid,status text NOT NULL DEFAULT 'active',presentation jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE subjects(id uuid PRIMARY KEY,name text NOT NULL,path_id uuid,level_id uuid,status text NOT NULL DEFAULT 'active',presentation jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE TABLE assessment_versions(assessment_id uuid NOT NULL,version int NOT NULL,assessment_kind text NOT NULL,title text NOT NULL,version_status text NOT NULL,subject_id uuid,path_id uuid, PRIMARY KEY(assessment_id,version));
CREATE TABLE assessment_version_questions(assessment_id uuid NOT NULL,assessment_version int NOT NULL,question_id uuid NOT NULL,question_version int NOT NULL);
CREATE TABLE question_versions(question_id uuid NOT NULL,version int NOT NULL,PRIMARY KEY(question_id,version));
CREATE TABLE assessment_attempts(id integer GENERATED ALWAYS AS IDENTITY,assessment_id uuid,assessment_version int,student_id uuid,source text);
CREATE TABLE assessment_public_attempts(id integer GENERATED ALWAYS AS IDENTITY,assessment_id uuid,assessment_version int);
INSERT INTO users(id,name,email) VALUES ('00000000-0000-0000-0000-000000000001','admin','admin@example.invalid'),('00000000-0000-0000-0000-000000000002','student','student@example.invalid');
INSERT INTO assessments(id,current_version,published_version) VALUES ('00000000-0000-0000-0000-000000000003',1,1);
INSERT INTO paths(id) VALUES ('00000000-0000-0000-0000-000000000007');
INSERT INTO subjects(id,name,path_id) VALUES ('00000000-0000-0000-0000-000000000006','فيزياء','00000000-0000-0000-0000-000000000007');
INSERT INTO assessment_versions(assessment_id,version,assessment_kind,title,version_status,subject_id,path_id) VALUES ('00000000-0000-0000-0000-000000000003',1,'normal','اختبار','published','00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000007');
INSERT INTO question_versions VALUES ('00000000-0000-0000-0000-000000000005',1);
INSERT INTO assessment_version_questions VALUES ('00000000-0000-0000-0000-000000000003',1,'00000000-0000-0000-0000-000000000005',1);`)
	if err != nil {
		t.Fatal(err)
	}
	migration, err := os.ReadFile("../../../../migrations/000055_prepared_quiz_staging.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, string(migration)); err != nil {
		t.Fatal(err)
	}
	guardMigration, err := os.ReadFile("../../../../migrations/000057_prepared_quiz_start_guards.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, string(guardMigration)); err != nil {
		t.Fatal(err)
	}
	// Self quizzes and unrelated public sessions keep their existing behavior.
	if _, err = db.Exec(ctx, `INSERT INTO assessment_attempts(assessment_id,assessment_version,student_id,source) VALUES(NULL,NULL,'00000000-0000-0000-0000-000000000001','self'); INSERT INTO assessment_public_attempts(assessment_id,assessment_version) VALUES('00000000-0000-0000-0000-000000000099',1)`); err != nil {
		t.Fatalf("unrelated attempts: %v", err)
	}
	repo := New(db, preparedAudit{})
	id := "00000000-0000-0000-0000-000000000003"
	actor := "00000000-0000-0000-0000-000000000001"
	if err = repo.StagePreparedQuiz(ctx, actor, id, assessment.PreparedQuizStage{Mode: "saher", AudienceType: "targeted", UserIDs: []string{"00000000-0000-0000-0000-000000000002"}}); err != nil {
		t.Fatal(err)
	}
	stage, err := repo.GetPreparedQuizStage(ctx, id)
	if err != nil || stage.Mode != "saher" || len(stage.UserIDs) != 1 || stage.UserIDs[0] != "00000000-0000-0000-0000-000000000002" || len(stage.TargetUsers) != 1 || stage.TargetUsers[0].Name != "student" || stage.TargetUsers[0].Email != "student@example.invalid" {
		t.Fatalf("read stage: %+v %v", stage, err)
	}
	// A missing group must roll back the preceding metadata and target delete.
	if err = repo.StagePreparedQuiz(ctx, actor, id, assessment.PreparedQuizStage{Mode: "central", AudienceType: "targeted", GroupIDs: []string{"00000000-0000-0000-0000-000000000004"}}); err == nil {
		t.Fatal("accepted missing group")
	}
	var mode string
	var count int
	if err = db.QueryRow(ctx, `SELECT mode,(SELECT count(*) FROM prepared_quiz_target_users WHERE assessment_id=$1::uuid) FROM prepared_quiz_distributions WHERE assessment_id=$1::uuid`, id).Scan(&mode, &count); err != nil || mode != "saher" || count != 1 {
		t.Fatalf("rollback: %s %d %v", mode, count, err)
	}
	if _, err = db.Exec(ctx, `INSERT INTO assessment_attempts(assessment_id,assessment_version,student_id,source) VALUES($1::uuid,1,$2::uuid,'disabled')`, id, actor); err != nil {
		t.Fatalf("disabled student stage: %v", err)
	}
	if _, err = db.Exec(ctx, `INSERT INTO assessment_public_attempts(assessment_id,assessment_version) VALUES($1::uuid,1)`, id); err != nil {
		t.Fatalf("disabled public stage: %v", err)
	}
	if _, err = db.Exec(ctx, `UPDATE prepared_quiz_distributions SET enabled=true WHERE assessment_id=$1::uuid`, id); err == nil {
		t.Fatal("unsafe activation succeeded")
	}
	group, err := repo.CreatePreparedQuizGroup(ctx, actor, assessment.PreparedQuizGroup{Name: "مجموعة تجريبية", GroupType: "PRIVATE_GROUP", LegacyID: "old-group"})
	if err != nil {
		t.Fatal(err)
	}
	student := "00000000-0000-0000-0000-000000000002"
	if err = repo.SetPreparedQuizGroupMember(ctx, actor, group.ID, student, true); err != nil {
		t.Fatal(err)
	}
	if err = repo.SetPreparedQuizGroupMember(ctx, actor, group.ID, student, true); err != nil {
		t.Fatal(err)
	}
	members, err := repo.ListPreparedQuizGroupMembers(ctx, group.ID)
	if err != nil || len(members) != 1 || members[0] != student {
		t.Fatalf("members: %v %v", members, err)
	}
	details, err := repo.ListPreparedQuizGroupMemberDetails(ctx, group.ID)
	if err != nil || len(details) != 1 || details[0].ID != student || details[0].Name != "student" || details[0].Email != "student@example.invalid" {
		t.Fatalf("member details: %+v %v", details, err)
	}
	if err = repo.StagePreparedQuiz(ctx, actor, id, assessment.PreparedQuizStage{Mode: "central", AudienceType: "targeted", GroupIDs: []string{group.ID}}); err != nil {
		t.Fatal(err)
	}
	stage, err = repo.GetPreparedQuizStage(ctx, id)
	if err != nil || len(stage.GroupIDs) != 1 || stage.GroupIDs[0] != group.ID || len(stage.UserIDs) != 0 {
		t.Fatalf("group stage: %+v %v", stage, err)
	}
	cards, err := repo.ListPreparedQuizzes(ctx, student)
	if err != nil || len(cards) != 0 {
		t.Fatalf("disabled distribution listed: %+v %v", cards, err)
	}
	// Simulate future activation in the isolated schema only. The real 055
	// migration keeps it blocked until transactional start guards exist.
	if _, err = db.Exec(ctx, `ALTER TABLE prepared_quiz_distributions DROP CONSTRAINT prepared_quiz_distributions_enabled_check; UPDATE prepared_quiz_distributions SET enabled=true`); err != nil {
		t.Fatal(err)
	}
	cards, err = repo.ListPreparedQuizzes(ctx, student)
	if err != nil || len(cards) != 1 || cards[0].QuestionCount != 1 || cards[0].SubjectName != "فيزياء" {
		t.Fatalf("eligible group student: %+v %v", cards, err)
	}
	if _, err = db.Exec(ctx, `UPDATE prepared_quiz_distributions SET enabled=false`); err != nil {
		t.Fatal(err)
	}
	cards, err = repo.ListPreparedQuizzes(ctx, student)
	if err != nil || len(cards) != 0 {
		t.Fatalf("disabled formerly active distribution listed: %+v %v", cards, err)
	}
	if _, err = db.Exec(ctx, `INSERT INTO assessment_attempts(assessment_id,assessment_version,student_id,source) VALUES($1::uuid,1,$2::uuid,'direct')`, id, student); err == nil {
		t.Fatal("disabled formerly active distribution allowed direct start")
	}
	if _, err = db.Exec(ctx, `INSERT INTO assessment_public_attempts(assessment_id,assessment_version) VALUES($1::uuid,1)`, id); err == nil {
		t.Fatal("disabled formerly active distribution allowed public start")
	}
	if _, err = db.Exec(ctx, `DELETE FROM prepared_quiz_target_groups WHERE assessment_id=$1::uuid`, id); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `DELETE FROM prepared_quiz_distributions WHERE assessment_id=$1::uuid`, id); err == nil {
		t.Fatal("deleted distribution could bypass the disabled guard")
	}
	if _, err = db.Exec(ctx, `INSERT INTO prepared_quiz_target_groups(assessment_id,group_id) VALUES($1::uuid,$2::uuid)`, id, group.ID); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `UPDATE prepared_quiz_distributions SET enabled=true,was_enabled=false`); err != nil {
		t.Fatal(err)
	}
	var wasEnabled bool
	if err = db.QueryRow(ctx, `SELECT was_enabled FROM prepared_quiz_distributions WHERE assessment_id=$1::uuid`, id).Scan(&wasEnabled); err != nil || !wasEnabled {
		t.Fatalf("activation history was lost: %v %v", wasEnabled, err)
	}
	if _, err = db.Exec(ctx, `INSERT INTO paths(id) VALUES ('00000000-0000-0000-0000-000000000008'); UPDATE paths SET parent_path_id='00000000-0000-0000-0000-000000000008' WHERE id='00000000-0000-0000-0000-000000000007'; INSERT INTO levels(id,path_id) VALUES ('00000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000007'); UPDATE subjects SET level_id='00000000-0000-0000-0000-000000000009'`); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct{ name, hide, show string }{
		{"path", `UPDATE paths SET presentation='{"isVisible":false}' WHERE id='00000000-0000-0000-0000-000000000007'`, `UPDATE paths SET presentation='{}' WHERE id='00000000-0000-0000-0000-000000000007'`},
		{"parent path", `UPDATE paths SET presentation='{"isVisible":false}' WHERE id='00000000-0000-0000-0000-000000000008'`, `UPDATE paths SET presentation='{}' WHERE id='00000000-0000-0000-0000-000000000008'`},
		{"subject", `UPDATE subjects SET presentation='{"isVisible":false}'`, `UPDATE subjects SET presentation='{}'`},
		{"level", `UPDATE levels SET presentation='{"isVisible":false}'`, `UPDATE levels SET presentation='{}'`},
	} {
		if _, err = db.Exec(ctx, tc.hide); err != nil {
			t.Fatal(err)
		}
		cards, err = repo.ListPreparedQuizzes(ctx, student)
		if err != nil || len(cards) != 0 {
			t.Fatalf("hidden %s listed: %+v %v", tc.name, cards, err)
		}
		if _, err = db.Exec(ctx, `INSERT INTO assessment_attempts(assessment_id,assessment_version,student_id,source) VALUES($1::uuid,1,$2::uuid,'assignment')`, id, student); err == nil {
			t.Fatalf("hidden %s allowed start", tc.name)
		}
		if _, err = db.Exec(ctx, tc.show); err != nil {
			t.Fatal(err)
		}
	}
	if _, err = db.Exec(ctx, `UPDATE assessment_versions SET subject_id=NULL`); err != nil {
		t.Fatal(err)
	}
	cards, err = repo.ListPreparedQuizzes(ctx, student)
	if err != nil || len(cards) != 1 || cards[0].SubjectName != "" {
		t.Fatalf("quiz without subject: %+v %v", cards, err)
	}
	for _, source := range []string{"direct", "placement", "assignment", "single_shot", "live"} {
		if _, err = db.Exec(ctx, `INSERT INTO assessment_attempts(assessment_id,assessment_version,student_id,source) VALUES($1::uuid,1,$2::uuid,$3)`, id, student, source); err != nil {
			t.Fatalf("allowed %s: %v", source, err)
		}
		if _, err = db.Exec(ctx, `INSERT INTO assessment_attempts(assessment_id,assessment_version,student_id,source) VALUES($1::uuid,1,$2::uuid,$3)`, id, actor, source); !errors.Is(mapError(err), assessment.ErrPreparedQuizAccessDenied) {
			t.Fatalf("unauthorized %s: %v", source, err)
		}
	}
	if _, err = db.Exec(ctx, `INSERT INTO assessment_public_attempts(assessment_id,assessment_version) VALUES($1::uuid,1)`, id); !errors.Is(mapError(err), assessment.ErrPreparedQuizAccessDenied) {
		t.Fatalf("public start: %v", err)
	}
	// Revocation holds the same group lock as the start guard. An insert that
	// starts while revocation is uncommitted must observe the committed removal.
	revoke, err := db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = revoke.Exec(ctx, `SELECT id FROM prepared_quiz_groups WHERE id=$1::uuid FOR UPDATE`, group.ID); err != nil {
		t.Fatal(err)
	}
	if _, err = revoke.Exec(ctx, `DELETE FROM prepared_quiz_group_members WHERE group_id=$1::uuid AND user_id=$2::uuid`, group.ID, student); err != nil {
		t.Fatal(err)
	}
	started := make(chan error, 1)
	go func() {
		_, e := db.Exec(ctx, `INSERT INTO assessment_attempts(assessment_id,assessment_version,student_id,source) VALUES($1::uuid,1,$2::uuid,'race')`, id, student)
		started <- e
	}()
	select {
	case e := <-started:
		t.Fatalf("start bypassed revocation lock: %v", e)
	case <-time.After(100 * time.Millisecond):
	}
	if err = revoke.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	if err = <-started; !errors.Is(mapError(err), assessment.ErrPreparedQuizAccessDenied) {
		t.Fatalf("start after revoked membership: %v", err)
	}
	if err = repo.SetPreparedQuizGroupMember(ctx, actor, group.ID, student, true); err != nil {
		t.Fatal(err)
	}
	cards, err = repo.ListPreparedQuizzes(ctx, actor)
	if err != nil || len(cards) != 0 {
		t.Fatalf("unrelated student: %+v %v", cards, err)
	}
	if _, err = db.Exec(ctx, `UPDATE prepared_quiz_distributions SET due_exclusive=now()-interval '1 second'`); err != nil {
		t.Fatal(err)
	}
	cards, err = repo.ListPreparedQuizzes(ctx, student)
	if err != nil || len(cards) != 0 {
		t.Fatalf("expired listed: %+v %v", cards, err)
	}
	if _, err = db.Exec(ctx, `UPDATE prepared_quiz_distributions SET due_exclusive=NULL,audience_type='public'`); err != nil {
		t.Fatal(err)
	}
	cards, err = repo.ListPreparedQuizzes(ctx, actor)
	if err != nil || len(cards) != 1 {
		t.Fatalf("public distribution: %+v %v", cards, err)
	}
	if _, err = db.Exec(ctx, `DELETE FROM assessment_version_questions`); err != nil {
		t.Fatal(err)
	}
	cards, err = repo.ListPreparedQuizzes(ctx, actor)
	if err != nil || len(cards) != 0 {
		t.Fatalf("empty quiz listed: %+v %v", cards, err)
	}
	if _, err = db.Exec(ctx, `INSERT INTO assessment_version_questions VALUES ('00000000-0000-0000-0000-000000000003',1,'00000000-0000-0000-0000-000000000005',1); UPDATE assessments SET is_published=false`); err != nil {
		t.Fatal(err)
	}
	cards, err = repo.ListPreparedQuizzes(ctx, actor)
	if err != nil || len(cards) != 0 {
		t.Fatalf("unpublished quiz listed: %+v %v", cards, err)
	}
	if err = repo.SetPreparedQuizGroupMember(ctx, actor, group.ID, student, false); err != nil {
		t.Fatal(err)
	}
	members, err = repo.ListPreparedQuizGroupMembers(ctx, group.ID)
	if err != nil || len(members) != 0 {
		t.Fatalf("remove member: %v %v", members, err)
	}
}
