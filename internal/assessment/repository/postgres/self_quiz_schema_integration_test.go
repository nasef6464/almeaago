package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	assessmentapp "github.com/nasef6464/almeaago/internal/assessment/application"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	assessmenthttp "github.com/nasef6464/almeaago/internal/assessment/transport/http"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learningapp "github.com/nasef6464/almeaago/internal/learning/application"
	learningpg "github.com/nasef6464/almeaago/internal/learning/repository/postgres"
	operationspg "github.com/nasef6464/almeaago/internal/operations/repository/postgres"
)

type selfQuizTestAuth struct{ user identity.User }

func (a selfQuizTestAuth) Authenticate(context.Context, string) (identityapp.Authenticated, error) {
	return identityapp.Authenticated{User: a.user}, nil
}
func (a selfQuizTestAuth) VerifyCSRF(_ identityapp.Authenticated, token string) error {
	if token != "test-csrf" {
		return errors.New("invalid csrf")
	}
	return nil
}

// Runs only against an explicitly supplied disposable local database. The
// full platform schema lives in a uniquely named schema, never in public.
func TestSelfQuizSchemaPreservesAttemptOwnershipAndMembership(t *testing.T) {
	dsn := os.Getenv("ASSESSMENT_SELF_SCHEMA_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("disposable local PostgreSQL required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()
	admin, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := fmt.Sprintf("self_quiz_test_%d", time.Now().UnixNano())
	quoted := pgx.Identifier{schema}.Sanitize()
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+quoted); err != nil {
		t.Fatal(err)
	}
	defer func() {
		if _, e := admin.Exec(context.Background(), "DROP SCHEMA "+quoted+" CASCADE"); e != nil {
			t.Logf("cleanup: %v", e)
		}
	}()
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema + ",public"
	cfg.MaxConns = 4
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	files, err := filepath.Glob("../../../../migrations/*.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	sort.Strings(files)
	for _, name := range files {
		if strings.Compare(filepath.Base(name), "000052_") >= 0 {
			continue
		}
		sql, e := os.ReadFile(name)
		if e != nil {
			t.Fatal(e)
		}
		if _, e = db.Exec(ctx, string(sql)); e != nil {
			t.Fatalf("apply %s: %v", filepath.Base(name), e)
		}
	}
	_, err = db.Exec(ctx, `
BEGIN;
INSERT INTO users(id,email,name,password_hash) VALUES ('00000000-0000-0000-0000-000000000101','preexisting@example.invalid','existing','test');
INSERT INTO paths(id,code,name) VALUES ('00000000-0000-0000-0000-000000000102','PREPATH','path');
INSERT INTO subjects(id,path_id,code,name) VALUES ('00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000102','PRESUB','subject');
INSERT INTO assessments(id,assessment_code) VALUES ('00000000-0000-0000-0000-000000000104','PREEXISTING');
INSERT INTO assessment_versions(assessment_id,version,title,path_id,subject_id,assessment_kind,normal_mode) VALUES ('00000000-0000-0000-0000-000000000104',1,'preexisting','00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000103','normal','exam');
INSERT INTO questions(id,question_code) VALUES ('00000000-0000-0000-0000-000000000105','PREQUESTION');
INSERT INTO question_versions(question_id,version,question_type,text_content,correct_option_index) VALUES ('00000000-0000-0000-0000-000000000105',1,'mcq','before migration',0);
INSERT INTO question_options(question_id,version,option_index,option_text) VALUES ('00000000-0000-0000-0000-000000000105',1,0,'yes');
INSERT INTO assessment_version_questions(assessment_id,assessment_version,question_id,question_version) VALUES ('00000000-0000-0000-0000-000000000104',1,'00000000-0000-0000-0000-000000000105',1);
INSERT INTO assessment_attempts(id,assessment_id,assessment_version,student_id,attempt_number) VALUES ('00000000-0000-0000-0000-000000000106','00000000-0000-0000-0000-000000000104',1,'00000000-0000-0000-0000-000000000101',1);
INSERT INTO assessment_answers(attempt_id,assessment_id,assessment_version,question_id,question_version,selected_option_index) VALUES ('00000000-0000-0000-0000-000000000106','00000000-0000-0000-0000-000000000104',1,'00000000-0000-0000-0000-000000000105',1,0);
COMMIT;`)
	if err != nil {
		t.Fatalf("preexisting prepared attempt: %v", err)
	}
	up, err := os.ReadFile("../../../../migrations/000052_self_quiz_attempts.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, string(up)); err != nil {
		t.Fatalf("apply self quiz schema: %v", err)
	}
	var oldAnswer bool
	if err = db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM assessment_answers WHERE attempt_id='00000000-0000-0000-0000-000000000106')`).Scan(&oldAnswer); err != nil || !oldAnswer {
		t.Fatalf("preexisting answer lost during upgrade: %v", err)
	}
	timingUp, err := os.ReadFile("../../../../migrations/000053_assessment_unanswered_time.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, string(timingUp)); err != nil {
		t.Fatalf("timing migration: %v", err)
	}
	aiUp, err := os.ReadFile("../../../../migrations/000054_ai_result_review_cache.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, string(aiUp)); err != nil {
		t.Fatalf("AI cache migration: %v", err)
	}
	// The taxonomy bootstrap used by the browser journey reads section data.
	// Migration 056 has no dependency on prepared-exam staging 055.
	sectionUp, err := os.ReadFile("../../../../migrations/000056_taxonomy_skill_sections.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, string(sectionUp)); err != nil {
		t.Fatalf("taxonomy skill sections migration: %v", err)
	}
	if _, err = db.Exec(ctx, `UPDATE questions SET path_id='00000000-0000-0000-0000-000000000102',subject_id='00000000-0000-0000-0000-000000000103' WHERE id='00000000-0000-0000-0000-000000000105'`); err != nil {
		t.Fatal(err)
	}
	preparedRepo := New(db, operationspg.NewAuditWriter())
	if _, err = db.Exec(ctx, `UPDATE assessment_attempts SET started_at=now()-interval '30 seconds' WHERE id='00000000-0000-0000-0000-000000000106'`); err != nil {
		t.Fatal(err)
	}
	preparedActor := identity.User{ID: "00000000-0000-0000-0000-000000000101", Roles: []identity.Role{identity.RoleStudent}}
	preparedService := assessmentapp.NewAttemptService(preparedRepo)
	if _, err = preparedRepo.RecordQuestionTime(ctx, "00000000-0000-0000-0000-000000000002", "00000000-0000-0000-0000-000000000106", "00000000-0000-0000-0000-000000000105", 17); err == nil {
		t.Fatal("other student recorded time")
	}
	if _, err = preparedRepo.RecordQuestionTime(ctx, preparedActor.ID, "00000000-0000-0000-0000-000000000106", "00000000-0000-0000-0000-000000000105", 17); err != nil {
		t.Fatalf("record prepared time: %v", err)
	}
	beforeBlank, err := preparedRepo.GetAttempt(ctx, "00000000-0000-0000-0000-000000000106")
	if err != nil || len(beforeBlank.Answers) != 1 || beforeBlank.Answers[0].SelectedOptionIndex == nil || *beforeBlank.Answers[0].SelectedOptionIndex != 0 || beforeBlank.Answers[0].TimeSpentSeconds != 17 {
		t.Fatalf("time write changed prepared answer: %+v %v", beforeBlank.Answers, err)
	}
	blank, err := preparedService.Save(ctx, preparedActor, "00000000-0000-0000-0000-000000000106", "00000000-0000-0000-0000-000000000105", assessment.AnswerWrite{TimeSpentSeconds: 17, MarkedForReview: true})
	if err != nil || len(blank.Answers) != 1 || blank.Answers[0].SelectedOptionIndex != nil || blank.Answers[0].TimeSpentSeconds != 17 {
		t.Fatalf("prepared unanswered time: %+v %v", blank.Answers, err)
	}
	capped, err := preparedRepo.RecordQuestionTime(ctx, preparedActor.ID, "00000000-0000-0000-0000-000000000106", "00000000-0000-0000-0000-000000000105", 86400)
	var wallSeconds int
	if scanErr := db.QueryRow(ctx, `SELECT EXTRACT(EPOCH FROM clock_timestamp()-started_at)::int FROM assessment_attempts WHERE id='00000000-0000-0000-0000-000000000106'`).Scan(&wallSeconds); scanErr != nil {
		t.Fatal(scanErr)
	}
	if err != nil || capped < 17 || capped > wallSeconds {
		t.Fatalf("unanswered time exceeded elapsed server time: %d %v", capped, err)
	}
	preparedResult, err := preparedService.Submit(ctx, preparedActor, "00000000-0000-0000-0000-000000000106", "prepared-blank")
	if err != nil || preparedResult.Unanswered != 1 || preparedResult.CorrectAnswers != 0 {
		t.Fatalf("prepared unanswered result: %+v %v", preparedResult, err)
	}
	preparedEvidence, err := preparedRepo.LearningSubmissionEvidence(ctx, preparedActor.ID, "00000000-0000-0000-0000-000000000106")
	if err != nil || len(preparedEvidence.Questions) != 1 || preparedEvidence.Questions[0].Answered {
		t.Fatalf("prepared unanswered evidence: %+v %v", preparedEvidence, err)
	}
	timingDown, err := os.ReadFile("../../../../migrations/000053_assessment_unanswered_time.down.sql")
	if err != nil {
		t.Fatal(err)
	}
	timingBody := strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(string(timingDown)), "BEGIN;")), "COMMIT;"))
	timingTx, err := db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = timingTx.Exec(ctx, timingBody); err == nil {
		_ = timingTx.Rollback(ctx)
		t.Fatal("timing downgrade discarded unanswered data")
	}
	_ = timingTx.Rollback(ctx)
	if _, err = db.Exec(ctx, `DELETE FROM assessment_results WHERE attempt_id='00000000-0000-0000-0000-000000000106'; UPDATE assessment_attempts SET status='in_progress',submission_key=NULL,submitted_at=NULL WHERE id='00000000-0000-0000-0000-000000000106'; UPDATE assessment_answers SET selected_option_index=0,time_spent_seconds=0,marked_for_review=false,is_correct=NULL,scored_at=NULL WHERE attempt_id='00000000-0000-0000-0000-000000000106'`); err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(ctx, `
INSERT INTO users(id,email,name,password_hash) VALUES
 ('00000000-0000-0000-0000-000000000001','owner@example.invalid','owner','test'),
 ('00000000-0000-0000-0000-000000000002','other@example.invalid','other','test');
INSERT INTO paths(id,code,name) VALUES ('00000000-0000-0000-0000-000000000003','P','path');
INSERT INTO subjects(id,path_id,code,name) VALUES ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000003','S','subject');
BEGIN;
INSERT INTO questions(id,question_code) VALUES ('00000000-0000-0000-0000-000000000005','Q1'),('00000000-0000-0000-0000-000000000006','Q2');
INSERT INTO question_versions(question_id,version,question_type,text_content,correct_option_index) VALUES
 ('00000000-0000-0000-0000-000000000005',1,'mcq','first',0),('00000000-0000-0000-0000-000000000006',1,'mcq','second',0);
INSERT INTO question_options(question_id,version,option_index,option_text) VALUES
 ('00000000-0000-0000-0000-000000000005',1,0,'yes'),('00000000-0000-0000-0000-000000000006',1,0,'yes');
COMMIT;
INSERT INTO assessment_attempts(id,student_id,attempt_kind,attempt_number) VALUES ('00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000001','self',1);
INSERT INTO self_quiz_settings(attempt_id,attempt_kind,evidence_type,question_count,time_limit_minutes,request_fingerprint) VALUES ('00000000-0000-0000-0000-000000000007','self','recheck',1,5,'fingerprint');
INSERT INTO self_quiz_questions(attempt_id,attempt_kind,question_id,question_version,path_id,subject_id,sort_order) VALUES ('00000000-0000-0000-0000-000000000007','self','00000000-0000-0000-0000-000000000005',1,'00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004',1);`)
	if err != nil {
		t.Fatalf("self setup: %v", err)
	}
	if _, err = db.Exec(ctx, `UPDATE questions SET path_id='00000000-0000-0000-0000-000000000003',subject_id='00000000-0000-0000-0000-000000000004',workflow_status='approved' WHERE id='00000000-0000-0000-0000-000000000005'`); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `UPDATE question_versions SET video_url='https://example.invalid/solution' WHERE question_id='00000000-0000-0000-0000-000000000005' AND version=1`); err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(ctx, `INSERT INTO skills(id,subject_id,code,name,kind) VALUES
 ('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000004','K1','first skill','main'),
 ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000004','K2','second skill','main');
INSERT INTO question_skill_links(question_id,skill_id,relation_type) VALUES
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000010','main'),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000011','secondary');`)
	if err != nil {
		t.Fatal(err)
	}
	// The optional full browser journey runs before these fixtures are submitted.
	// Keep their deadlines independent of a slow local browser startup.
	input := assessment.SelfQuizInput{PathID: "00000000-0000-0000-0000-000000000003", SubjectID: "00000000-0000-0000-0000-000000000004", QuestionType: "all", EvidenceType: "assessment", QuestionCount: 1, TimeLimitMinutes: 30, StartKey: "self-snapshot-key"}
	chosen := []assessment.EligibleSelfQuizQuestion{{ID: "00000000-0000-0000-0000-000000000005", Version: 1, PathID: input.PathID, SubjectID: input.SubjectID}}
	snapshotRepo := New(db, operationspg.NewAuditWriter())
	snapshotID, err := snapshotRepo.CreateSelfQuizSnapshot(ctx, "00000000-0000-0000-0000-000000000001", input, chosen)
	if err != nil || snapshotID == "" {
		t.Fatalf("create snapshot: %q %v", snapshotID, err)
	}
	learnerAttempt, err := snapshotRepo.GetAttempt(ctx, snapshotID)
	if err != nil || learnerAttempt.StudentID != "00000000-0000-0000-0000-000000000001" || learnerAttempt.ServerTime == nil || learnerAttempt.TotalQuestions != 1 || len(learnerAttempt.Questions) != 1 || learnerAttempt.Questions[0].Version != 1 || len(learnerAttempt.Questions[0].Options) != 1 {
		t.Fatalf("self attempt learner view: %+v %v", learnerAttempt, err)
	}
	payload, err := json.Marshal(learnerAttempt)
	if err != nil || strings.Contains(string(payload), "correctOption") || strings.Contains(string(payload), "explanation") || strings.Contains(string(payload), "example.invalid/solution") {
		t.Fatalf("learner payload leaked answers: %s %v", payload, err)
	}
	answer := 0
	if _, err = snapshotRepo.SaveAnswer(ctx, "00000000-0000-0000-0000-000000000002", snapshotID, chosen[0].ID, assessment.AnswerWrite{SelectedOptionIndex: &answer}); err == nil {
		t.Fatal("other student saved an answer")
	}
	if _, err = snapshotRepo.SaveAnswer(ctx, "00000000-0000-0000-0000-000000000001", snapshotID, "00000000-0000-0000-0000-000000000006", assessment.AnswerWrite{SelectedOptionIndex: &answer}); err == nil {
		t.Fatal("question outside snapshot accepted")
	}
	invalidOption := 4
	if _, err = snapshotRepo.SaveAnswer(ctx, "00000000-0000-0000-0000-000000000001", snapshotID, chosen[0].ID, assessment.AnswerWrite{SelectedOptionIndex: &invalidOption}); !errors.Is(err, assessment.ErrInvalidAnswer) {
		t.Fatalf("invalid option accepted: %v", err)
	}
	if _, err = snapshotRepo.SaveAnswer(ctx, "00000000-0000-0000-0000-000000000001", snapshotID, chosen[0].ID, assessment.AnswerWrite{TextAnswer: "unscorable"}); !errors.Is(err, assessment.ErrInvalidAnswer) {
		t.Fatalf("unscorable text accepted: %v", err)
	}
	saved, err := snapshotRepo.SaveAnswer(ctx, "00000000-0000-0000-0000-000000000001", snapshotID, chosen[0].ID, assessment.AnswerWrite{SelectedOptionIndex: &answer})
	if err != nil || len(saved.Answers) != 1 || saved.Answers[0].QuestionID != chosen[0].ID {
		t.Fatalf("self answer not saved: %+v %v", saved.Answers, err)
	}
	if _, err = snapshotRepo.RecordQuestionTime(ctx, "00000000-0000-0000-0000-000000000001", snapshotID, chosen[0].ID, 1); err != nil {
		t.Fatalf("record self time: %v", err)
	}
	stillSaved, err := snapshotRepo.GetAttempt(ctx, snapshotID)
	if err != nil || len(stillSaved.Answers) != 1 || stillSaved.Answers[0].SelectedOptionIndex == nil || *stillSaved.Answers[0].SelectedOptionIndex != answer {
		t.Fatalf("time write changed self answer: %+v %v", stillSaved.Answers, err)
	}
	if _, err = db.Exec(ctx, `INSERT INTO question_options(question_id,version,option_index,option_text) VALUES ($1::uuid,1,1,'other')`, chosen[0].ID); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `UPDATE assessment_attempts SET started_at=now()-interval '30 seconds' WHERE id=$1::uuid`, snapshotID); err != nil {
		t.Fatal(err)
	}
	concurrentWrites := make(chan error, 2)
	go func() {
		_, e := snapshotRepo.RecordQuestionTime(ctx, "00000000-0000-0000-0000-000000000001", snapshotID, chosen[0].ID, 10)
		concurrentWrites <- e
	}()
	go func() {
		choice := 1
		_, e := snapshotRepo.SaveAnswer(ctx, "00000000-0000-0000-0000-000000000001", snapshotID, chosen[0].ID, assessment.AnswerWrite{SelectedOptionIndex: &choice})
		concurrentWrites <- e
	}()
	if e := <-concurrentWrites; e != nil {
		t.Fatalf("concurrent time: %v", e)
	}
	if e := <-concurrentWrites; e != nil {
		t.Fatalf("concurrent answer: %v", e)
	}
	concurrentAttempt, err := snapshotRepo.GetAttempt(ctx, snapshotID)
	if err != nil || len(concurrentAttempt.Answers) != 1 || concurrentAttempt.Answers[0].SelectedOptionIndex == nil || *concurrentAttempt.Answers[0].SelectedOptionIndex != 1 || concurrentAttempt.Answers[0].TimeSpentSeconds < 10 {
		t.Fatalf("concurrent time lost answer: %+v %v", concurrentAttempt.Answers, err)
	}
	if _, err = snapshotRepo.SaveAnswer(ctx, "00000000-0000-0000-0000-000000000001", snapshotID, chosen[0].ID, assessment.AnswerWrite{SelectedOptionIndex: &answer}); err != nil {
		t.Fatal(err)
	}
	const sectionID = "00000000-0000-0000-0000-000000009001"
	if _, err = db.Exec(ctx, `INSERT INTO taxonomy_skill_sections(id,subject_id,name) VALUES ('00000000-0000-0000-0000-000000009001','00000000-0000-0000-0000-000000000004','first section');
		UPDATE skills SET section_id='00000000-0000-0000-0000-000000009001' WHERE id='00000000-0000-0000-0000-000000000010';
		UPDATE questions SET section_id='00000000-0000-0000-0000-000000009001' WHERE id='00000000-0000-0000-0000-000000000005'`); err != nil {
		t.Fatal(err)
	}
	liveInput := input
	liveInput.StartKey = "self-application-start"
	// The optional browser journey can take several minutes on a busy host.
	liveInput.TimeLimitMinutes = 30
	liveInput.SkillIDs = []string{"00000000-0000-0000-0000-000000000010"}
	liveInput.EvidenceType = "remediation"
	liveInput.SectionID = sectionID
	actor := identity.User{ID: "00000000-0000-0000-0000-000000000001", Roles: []identity.Role{identity.RoleStudent}}
	selfService := assessmentapp.NewSelfQuizService(snapshotRepo)
	liveAttempt, err := selfService.Start(ctx, actor, liveInput)
	if err != nil || len(liveAttempt.Questions) != 1 || liveAttempt.Questions[0].ID != chosen[0].ID {
		t.Fatalf("self application start: %+v %v", liveAttempt, err)
	}
	var storedSection string
	if err = db.QueryRow(ctx, `SELECT section_id::text FROM self_quiz_settings WHERE attempt_id=$1::uuid`, liveAttempt.ID).Scan(&storedSection); err != nil || storedSection != sectionID {
		t.Fatalf("section snapshot %q %v", storedSection, err)
	}
	if _, err = db.Exec(ctx, `UPDATE taxonomy_skill_sections SET status='archived' WHERE id=$1::uuid`, sectionID); err != nil {
		t.Fatal(err)
	}
	liveRetry, err := selfService.Start(ctx, actor, liveInput)
	if err != nil || liveRetry.ID != liveAttempt.ID {
		t.Fatalf("self application retry: %+v %v", liveRetry, err)
	}
	if _, err = db.Exec(ctx, `UPDATE taxonomy_skill_sections SET status='active' WHERE id=$1::uuid`, sectionID); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `UPDATE questions SET section_id=NULL WHERE id='00000000-0000-0000-0000-000000000005'`); err != nil {
		t.Fatal(err)
	}
	staleInput := liveInput
	staleInput.StartKey = "self-section-stale"
	if _, err = snapshotRepo.CreateSelfQuizSnapshot(ctx, actor.ID, staleInput, chosen); err == nil {
		t.Fatal("snapshot accepted a question moved outside the section")
	}
	if _, err = db.Exec(ctx, `UPDATE questions SET section_id=$1::uuid WHERE id='00000000-0000-0000-0000-000000000005'`, sectionID); err != nil {
		t.Fatal(err)
	}
	resumed, err := selfService.Resume(ctx, actor)
	if err != nil || resumed.ID != liveAttempt.ID {
		t.Fatalf("resume latest self attempt: %+v %v", resumed, err)
	}
	otherActor := identity.User{ID: "00000000-0000-0000-0000-000000000002", Roles: []identity.Role{identity.RoleStudent}}
	if _, err = selfService.Resume(ctx, otherActor); !errors.Is(err, assessment.ErrNotFound) {
		t.Fatalf("other student found attempt: %v", err)
	}
	wrongInput := input
	wrongInput.StartKey = "self-wrong-skill"
	wrongID, err := snapshotRepo.CreateSelfQuizSnapshot(ctx, actor.ID, wrongInput, chosen)
	if err != nil {
		t.Fatalf("create wrong-skill attempt: %v", err)
	}
	runSelfQuizLiveBrowser(t, ctx, db)
	if _, err = db.Exec(ctx, `DELETE FROM question_skill_links WHERE question_id='00000000-0000-0000-0000-000000000005'`); err != nil {
		t.Fatal(err)
	}
	var skillCount int
	if err = db.QueryRow(ctx, `SELECT count(*) FROM self_quiz_question_skills WHERE attempt_id=$1::uuid`, snapshotID).Scan(&skillCount); err != nil || skillCount != 2 {
		t.Fatalf("question skills did not remain frozen: %d %v", skillCount, err)
	}
	learnerSink := learningapp.NewService(learningpg.New(db), nil)
	attemptService := assessmentapp.NewAttemptServiceWithLearning(snapshotRepo, learnerSink)
	wrongChoice := 1
	if _, err = attemptService.Save(ctx, actor, wrongID, chosen[0].ID, assessment.AnswerWrite{SelectedOptionIndex: &wrongChoice}); err != nil {
		t.Fatal(err)
	}
	if _, err = attemptService.Submit(ctx, actor, wrongID, "wrong-submit"); err != nil {
		t.Fatal(err)
	}
	wrongDetail, err := attemptService.ResultDetail(ctx, actor, wrongID)
	if err != nil || wrongDetail.SkillAnalysis == nil || !wrongDetail.SkillAnalysis.Complete || len(wrongDetail.SkillAnalysis.Items) != 2 {
		t.Fatalf("wrong skill analysis: %+v %v", wrongDetail.SkillAnalysis, err)
	}
	for _, skill := range wrongDetail.SkillAnalysis.Items {
		if skill.Status != "weak" || skill.CorrectCount != 0 {
			t.Fatalf("wrong answer missed weak skill: %+v", skill)
		}
	}
	handler := assessmenthttp.NewAttempts(attemptService, selfQuizTestAuth{user: actor}, selfService)
	call := func(method, path string, input any, csrf string) *httptest.ResponseRecorder {
		body, e := json.Marshal(input)
		if e != nil {
			t.Fatal(e)
		}
		request := httptest.NewRequest(method, path, strings.NewReader(string(body)))
		request.Header.Set("X-CSRF-Token", csrf)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		return response
	}
	if response := call(http.MethodPost, "/self", liveInput, ""); response.Code != http.StatusForbidden {
		t.Fatalf("self start csrf: %d", response.Code)
	}
	if response := call(http.MethodPost, "/self", liveInput, "test-csrf"); response.Code != http.StatusOK || !strings.Contains(response.Body.String(), liveAttempt.ID) {
		t.Fatalf("self HTTP retry: %d %s", response.Code, response.Body.String())
	}
	if response := call(http.MethodPut, "/"+liveAttempt.ID+"/answers/"+chosen[0].ID, assessment.AnswerWrite{SelectedOptionIndex: &answer}, "test-csrf"); response.Code != http.StatusOK {
		t.Fatalf("self HTTP save: %d %s", response.Code, response.Body.String())
	}
	timePath := "/" + liveAttempt.ID + "/questions/" + chosen[0].ID + "/time"
	if response := call(http.MethodPut, timePath, map[string]int{"timeSpentSeconds": 1}, ""); response.Code != http.StatusForbidden {
		t.Fatalf("self time csrf: %d", response.Code)
	}
	if response := call(http.MethodPut, timePath, map[string]int{"timeSpentSeconds": 1}, "test-csrf"); response.Code != http.StatusOK {
		t.Fatalf("self time HTTP: %d %s", response.Code, response.Body.String())
	}
	if response := call(http.MethodPut, timePath, map[string]int{"timeSpentSeconds": -1}, "test-csrf"); response.Code != http.StatusBadRequest {
		t.Fatalf("negative time HTTP: %d", response.Code)
	}
	otherHandler := assessmenthttp.NewAttempts(attemptService, selfQuizTestAuth{user: identity.User{ID: "00000000-0000-0000-0000-000000000002", Roles: []identity.Role{identity.RoleStudent}}}, selfService)
	otherRequest := httptest.NewRequest(http.MethodPut, timePath, strings.NewReader(`{"timeSpentSeconds":1}`))
	otherRequest.Header.Set("X-CSRF-Token", "test-csrf")
	otherResponse := httptest.NewRecorder()
	otherHandler.ServeHTTP(otherResponse, otherRequest)
	if otherResponse.Code != http.StatusNotFound {
		t.Fatalf("other student time HTTP: %d %s", otherResponse.Code, otherResponse.Body.String())
	}
	for i := 0; i < 2; i++ {
		if response := call(http.MethodPost, "/"+liveAttempt.ID+"/submit", map[string]string{"submissionKey": "application-submit"}, "test-csrf"); response.Code != http.StatusOK {
			t.Fatalf("self HTTP submit: %d %s", response.Code, response.Body.String())
		}
	}
	liveDetail, err := attemptService.ResultDetail(ctx, actor, liveAttempt.ID)
	if err != nil || liveDetail.SkillAnalysis == nil || !liveDetail.SkillAnalysis.Complete || len(liveDetail.SkillAnalysis.Items) != 2 {
		t.Fatalf("self application analysis: %+v %v", liveDetail.SkillAnalysis, err)
	}
	retryID, err := snapshotRepo.CreateSelfQuizSnapshot(ctx, "00000000-0000-0000-0000-000000000001", input, nil)
	if err != nil || retryID != snapshotID {
		t.Fatalf("idempotent retry: %q %v", retryID, err)
	}
	if _, err = snapshotRepo.CreateSelfQuizSnapshot(ctx, "00000000-0000-0000-0000-000000000002", input, chosen); !errors.Is(err, assessment.ErrConflict) {
		t.Fatalf("other student reused key: %v", err)
	}
	different := input
	different.QuestionCount = 2
	if _, err = snapshotRepo.CreateSelfQuizSnapshot(ctx, "00000000-0000-0000-0000-000000000001", different, chosen); !errors.Is(err, assessment.ErrConflict) {
		t.Fatalf("different request reused key: %v", err)
	}
	bad := input
	bad.StartKey = "invalid-version-key"
	invalid := append([]assessment.EligibleSelfQuizQuestion(nil), chosen...)
	invalid[0].Version = 2
	if _, err = snapshotRepo.CreateSelfQuizSnapshot(ctx, "00000000-0000-0000-0000-000000000001", bad, invalid); err == nil {
		t.Fatal("invalid question version accepted")
	}
	var leaked bool
	if err = db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM assessment_attempts WHERE start_key='invalid-version-key')`).Scan(&leaked); err != nil || leaked {
		t.Fatalf("failed snapshot was partially persisted: %v", err)
	}
	_, err = db.Exec(ctx, `BEGIN;
INSERT INTO questions(id,question_code,path_id,subject_id,workflow_status) VALUES ('00000000-0000-0000-0000-000000000012','NOOPTION','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','approved');
INSERT INTO question_versions(question_id,version,question_type,text_content,correct_option_index) VALUES ('00000000-0000-0000-0000-000000000012',1,'mcq','missing answer option',0);
COMMIT;`)
	if err != nil {
		t.Fatal(err)
	}
	missingOption := input
	missingOption.StartKey = "missing-option-key"
	missingCandidate := append([]assessment.EligibleSelfQuizQuestion(nil), chosen...)
	missingCandidate[0].ID = "00000000-0000-0000-0000-000000000012"
	if _, err = snapshotRepo.CreateSelfQuizSnapshot(ctx, "00000000-0000-0000-0000-000000000001", missingOption, missingCandidate); !errors.Is(err, assessment.ErrConflict) {
		t.Fatalf("question without correct option accepted: %v", err)
	}
	race := input
	race.StartKey = "self-race-key"
	type startResult struct {
		id  string
		err error
	}
	results := make(chan startResult, 2)
	for i := 0; i < 2; i++ {
		go func() {
			id, e := snapshotRepo.CreateSelfQuizSnapshot(ctx, "00000000-0000-0000-0000-000000000001", race, chosen)
			results <- startResult{id, e}
		}()
	}
	first, second := <-results, <-results
	if first.err != nil || second.err != nil || first.id == "" || first.id != second.id {
		t.Fatalf("concurrent retry diverged: %+v %+v", first, second)
	}
	if _, err = snapshotRepo.SaveAnswer(ctx, "00000000-0000-0000-0000-000000000001", first.id, chosen[0].ID, assessment.AnswerWrite{MarkedForReview: true}); err != nil {
		t.Fatalf("mark unanswered for review: %v", err)
	}
	unmarked, err := snapshotRepo.SaveAnswer(ctx, "00000000-0000-0000-0000-000000000001", first.id, chosen[0].ID, assessment.AnswerWrite{})
	if err != nil || len(unmarked.Answers) != 1 || unmarked.Answers[0].MarkedForReview {
		t.Fatalf("unmark unanswered question: %+v %v", unmarked.Answers, err)
	}
	if _, err = snapshotRepo.SaveAnswer(ctx, "00000000-0000-0000-0000-000000000001", first.id, chosen[0].ID, assessment.AnswerWrite{MarkedForReview: true}); err != nil {
		t.Fatalf("mark again: %v", err)
	}
	if _, err = db.Exec(ctx, `UPDATE assessment_attempts SET started_at=now()-interval '2 minutes',expires_at=now()-interval '1 minute' WHERE id=$1::uuid`, first.id); err != nil {
		t.Fatal(err)
	}
	if _, err = snapshotRepo.SaveAnswer(ctx, "00000000-0000-0000-0000-000000000001", first.id, chosen[0].ID, assessment.AnswerWrite{SelectedOptionIndex: &answer}); !errors.Is(err, assessment.ErrAttemptExpired) {
		t.Fatalf("late answer was not rejected as expired: %v", err)
	}
	var expiredStatus string
	if err = db.QueryRow(ctx, `SELECT status FROM assessment_attempts WHERE id=$1::uuid`, first.id).Scan(&expiredStatus); err != nil || expiredStatus != "expired" {
		t.Fatalf("expiry was not persisted: %q %v", expiredStatus, err)
	}
	if _, err = snapshotRepo.SaveAnswer(ctx, "00000000-0000-0000-0000-000000000001", first.id, chosen[0].ID, assessment.AnswerWrite{SelectedOptionIndex: &answer}); !errors.Is(err, assessment.ErrAttemptExpired) {
		t.Fatalf("expired retry changed meaning: %v", err)
	}
	if _, err = snapshotRepo.RecordQuestionTime(ctx, "00000000-0000-0000-0000-000000000001", first.id, chosen[0].ID, 1); !errors.Is(err, assessment.ErrAttemptExpired) {
		t.Fatalf("expired time retry changed meaning: %v", err)
	}
	if _, err = New(db, nil).CreateSelfQuizSnapshot(ctx, "00000000-0000-0000-0000-000000000001", assessment.SelfQuizInput{PathID: input.PathID, SubjectID: input.SubjectID, QuestionCount: 1, TimeLimitMinutes: 5, StartKey: "missing-audit-key"}, chosen); err == nil {
		t.Fatal("snapshot accepted without audit")
	}
	if err = db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM assessment_attempts WHERE start_key='missing-audit-key')`).Scan(&leaked); err != nil || leaked {
		t.Fatalf("audit failure left an attempt: %v", err)
	}
	_, err = db.Exec(ctx, `BEGIN;
INSERT INTO question_versions(question_id,version,question_type,text_content,correct_option_index) VALUES ('00000000-0000-0000-0000-000000000005',2,'mcq','new version',0);
INSERT INTO question_options(question_id,version,option_index,option_text) VALUES ('00000000-0000-0000-0000-000000000005',2,0,'new answer');
UPDATE questions SET current_version=2 WHERE id='00000000-0000-0000-0000-000000000005';
COMMIT;`)
	if err != nil {
		t.Fatal(err)
	}
	var snapshotVersion int
	if err = db.QueryRow(ctx, `SELECT question_version FROM self_quiz_questions WHERE attempt_id=$1::uuid`, snapshotID).Scan(&snapshotVersion); err != nil || snapshotVersion != 1 {
		t.Fatalf("question snapshot changed after edit: version=%d err=%v", snapshotVersion, err)
	}
	if _, err = snapshotRepo.Submit(ctx, "00000000-0000-0000-0000-000000000002", snapshotID, "submit-key"); err == nil {
		t.Fatal("other student submitted the attempt")
	}
	selfResult, err := snapshotRepo.Submit(ctx, "00000000-0000-0000-0000-000000000001", snapshotID, "submit-key")
	if err != nil || selfResult.Score != 100 || selfResult.TotalQuestions != 1 || selfResult.CorrectAnswers != 1 || !selfResult.Passed {
		t.Fatalf("self result: %+v %v", selfResult, err)
	}
	detail, err := snapshotRepo.GetResultDetail(ctx, "00000000-0000-0000-0000-000000000001", snapshotID)
	if err != nil || len(detail.Questions) != 1 || detail.Questions[0].QuestionVersion != 1 || !detail.Questions[0].Correct || detail.Questions[0].CorrectOptionIndex == nil || len(detail.Questions[0].Options) != 2 {
		t.Fatalf("self result review: %+v %v", detail, err)
	}
	if _, err = snapshotRepo.GetResultDetail(ctx, "00000000-0000-0000-0000-000000000002", snapshotID); err == nil {
		t.Fatal("other student read self result")
	}
	page, err := snapshotRepo.ListResults(ctx, "00000000-0000-0000-0000-000000000001", 1, 20)
	if err != nil {
		t.Fatalf("self result list: %v", err)
	}
	foundSelf := false
	for _, item := range page.Items {
		if item.AttemptID == snapshotID {
			foundSelf = true
		}
	}
	if !foundSelf {
		t.Fatal("self attempt missing from result list")
	}
	event, err := snapshotRepo.LearningSubmissionEvidence(ctx, "00000000-0000-0000-0000-000000000001", snapshotID)
	if err != nil || event.SourceKind != "self" || len(event.Questions) != 1 || !event.Questions[0].Answered || !event.Questions[0].Correct || len(event.Questions[0].SkillIDs) != 2 {
		t.Fatalf("self evidence did not use frozen skills: %+v %v", event, err)
	}
	if _, err = snapshotRepo.LearningSubmissionEvidence(ctx, "00000000-0000-0000-0000-000000000002", snapshotID); err == nil {
		t.Fatal("other student read evidence")
	}
	sink := learningapp.NewService(learningpg.New(db), nil)
	if err = sink.ApplyAssessmentSubmission(ctx, event); err != nil {
		t.Fatalf("apply self evidence: %v", err)
	}
	if err = sink.ApplyAssessmentSubmission(ctx, event); err != nil {
		t.Fatalf("repeat self evidence: %v", err)
	}
	var evidenceCount int
	if err = db.QueryRow(ctx, `SELECT count(*) FROM mastery_evidence WHERE self_attempt_id=$1::uuid`, snapshotID).Scan(&evidenceCount); err != nil || evidenceCount != 1 {
		t.Fatalf("duplicate evidence: %d %v", evidenceCount, err)
	}
	detail, err = snapshotRepo.GetResultDetail(ctx, "00000000-0000-0000-0000-000000000001", snapshotID)
	if err != nil || detail.SkillAnalysis == nil || !detail.SkillAnalysis.Complete || len(detail.SkillAnalysis.Items) != 2 {
		t.Fatalf("self skill analysis: %+v %v", detail.SkillAnalysis, err)
	}
	if _, err = db.Exec(ctx, `DELETE FROM mastery_evidence_skills WHERE evidence_id IN (SELECT id FROM mastery_evidence WHERE self_attempt_id=$1::uuid) AND skill_id='00000000-0000-0000-0000-000000000010'`, snapshotID); err != nil {
		t.Fatal(err)
	}
	detail, err = snapshotRepo.GetResultDetail(ctx, "00000000-0000-0000-0000-000000000001", snapshotID)
	if err != nil || detail.SkillAnalysis == nil || detail.SkillAnalysis.Complete || len(detail.SkillAnalysis.Items) != 0 {
		t.Fatalf("incomplete skill snapshot should not be reported: %+v %v", detail.SkillAnalysis, err)
	}
	retried, err := snapshotRepo.Submit(ctx, "00000000-0000-0000-0000-000000000001", snapshotID, "submit-key")
	if err != nil || retried.Score != selfResult.Score {
		t.Fatalf("submit retry: %+v %v", retried, err)
	}
	if _, err = snapshotRepo.Submit(ctx, "00000000-0000-0000-0000-000000000001", snapshotID, "different-key"); !errors.Is(err, assessment.ErrAttemptSubmitted) {
		t.Fatalf("different submit key accepted: %v", err)
	}
	if _, err = New(db, nil).Submit(ctx, "00000000-0000-0000-0000-000000000001", first.id, "failed-audit"); err == nil {
		t.Fatal("submission without audit succeeded")
	}
	var leakedResult bool
	if err = db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM assessment_results WHERE attempt_id=$1::uuid)`, first.id).Scan(&leakedResult); err != nil || leakedResult {
		t.Fatalf("failed audit left result: %v %v", leakedResult, err)
	}
	type submitResult struct {
		result assessment.Result
		err    error
	}
	concurrentSubmits := make(chan submitResult, 2)
	for i := 0; i < 2; i++ {
		go func() {
			result, e := snapshotRepo.Submit(ctx, "00000000-0000-0000-0000-000000000001", first.id, "expired-submit")
			concurrentSubmits <- submitResult{result, e}
		}()
	}
	for i := 0; i < 2; i++ {
		timed := <-concurrentSubmits
		if timed.err != nil || timed.result.TotalQuestions != 1 || timed.result.Unanswered != 1 || timed.result.Score != 0 || timed.result.Passed {
			t.Fatalf("expired concurrent submit: %+v %v", timed.result, timed.err)
		}
	}
	timedEvidence, err := snapshotRepo.LearningSubmissionEvidence(ctx, "00000000-0000-0000-0000-000000000001", first.id)
	if err != nil || len(timedEvidence.Questions) != 1 || timedEvidence.Questions[0].Answered {
		t.Fatalf("review flag counted as answer: %+v %v", timedEvidence, err)
	}
	for _, sql := range []string{
		`DELETE FROM review_card_skills WHERE review_card_id IN (SELECT id FROM review_cards WHERE student_id='00000000-0000-0000-0000-000000000001')`,
		`DELETE FROM review_cards WHERE student_id='00000000-0000-0000-0000-000000000001'`,
		`DELETE FROM skill_progress WHERE student_id='00000000-0000-0000-0000-000000000001'`,
		`DELETE FROM mastery_evidence_skills WHERE evidence_id IN (SELECT id FROM mastery_evidence WHERE self_attempt_id IN ($1::uuid,$2::uuid,$3::uuid))`,
		`DELETE FROM mastery_evidence WHERE self_attempt_id IN ($1::uuid,$2::uuid,$3::uuid)`,
	} {
		if strings.Contains(sql, "$1") {
			_, err = db.Exec(ctx, sql, snapshotID, liveAttempt.ID, wrongID)
		} else {
			_, err = db.Exec(ctx, sql)
		}
		if err != nil {
			t.Fatalf("cleanup learning evidence: %v", err)
		}
	}
	for _, id := range []string{snapshotID, first.id, liveAttempt.ID, wrongID} {
		for _, sql := range []string{`DELETE FROM assessment_results WHERE self_attempt_id=$1::uuid`, `DELETE FROM assessment_answers WHERE self_attempt_id=$1::uuid`, `DELETE FROM self_quiz_question_skills WHERE attempt_id=$1::uuid`, `DELETE FROM self_quiz_questions WHERE attempt_id=$1::uuid`, `DELETE FROM self_quiz_target_skills WHERE attempt_id=$1::uuid`, `DELETE FROM self_quiz_settings WHERE attempt_id=$1::uuid`, `DELETE FROM assessment_attempts WHERE id=$1::uuid`} {
			if _, err = db.Exec(ctx, sql, id); err != nil {
				t.Fatal(err)
			}
		}
	}
	badAnswers := []string{
		`INSERT INTO assessment_answers(attempt_id,question_id,question_version,selected_option_index) VALUES ('00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000005',1,0)`,
		`INSERT INTO assessment_answers(attempt_id,self_attempt_id,question_id,question_version,selected_option_index) VALUES ('00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000006',1,0)`,
	}
	for _, sql := range badAnswers {
		if _, err = db.Exec(ctx, sql); err == nil {
			t.Fatalf("invalid answer accepted: %s", sql)
		}
	}
	if _, err = db.Exec(ctx, `INSERT INTO assessment_answers(attempt_id,self_attempt_id,question_id,question_version,selected_option_index) VALUES ('00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000005',1,0)`); err != nil {
		t.Fatalf("valid answer: %v", err)
	}
	result := `INSERT INTO assessment_results(attempt_id,self_attempt_id,self_attempt_kind,student_id,score,total_questions,correct_answers,wrong_answers,unanswered,passed) VALUES ('00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000007','self',$1::uuid,100,1,1,0,0,true)`
	if _, err = db.Exec(ctx, result, "00000000-0000-0000-0000-000000000002"); err == nil {
		t.Fatal("another student owned the result")
	}
	if _, err = db.Exec(ctx, result, "00000000-0000-0000-0000-000000000001"); err != nil {
		t.Fatalf("valid result: %v", err)
	}
	evidence := `INSERT INTO mastery_evidence(student_id,evidence_type,source_attempt_id,self_attempt_id,self_attempt_kind,question_id,question_version,path_id,subject_id,answered,is_correct,occurred_at) VALUES ($1::uuid,$2,$3::uuid,'00000000-0000-0000-0000-000000000007','self',$4::uuid,1,'00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004',true,true,now())`
	owner, other := "00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002"
	attempt, firstQuestion, otherQuestion := "00000000-0000-0000-0000-000000000007", "00000000-0000-0000-0000-000000000005", "00000000-0000-0000-0000-000000000006"
	for _, tc := range []struct {
		student, kind string
		source        any
		question      string
	}{
		{owner, "recheck", nil, firstQuestion},
		{other, "recheck", attempt, firstQuestion},
		{owner, "remediation", attempt, firstQuestion},
		{owner, "recheck", attempt, otherQuestion},
	} {
		if _, err = db.Exec(ctx, evidence, tc.student, tc.kind, tc.source, tc.question); err == nil {
			t.Fatalf("invalid evidence accepted: %+v", tc)
		}
	}
	if _, err = db.Exec(ctx, evidence, owner, "recheck", attempt, firstQuestion); err != nil {
		t.Fatalf("valid self evidence: %v", err)
	}
	_, err = db.Exec(ctx, `
BEGIN;
INSERT INTO assessments(id,assessment_code) VALUES ('00000000-0000-0000-0000-000000000008','PREPARED');
INSERT INTO assessment_versions(assessment_id,version,title,path_id,subject_id,assessment_kind,normal_mode) VALUES ('00000000-0000-0000-0000-000000000008',1,'prepared','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','normal','exam');
INSERT INTO assessment_version_questions(assessment_id,assessment_version,question_id,question_version) VALUES ('00000000-0000-0000-0000-000000000008',1,'00000000-0000-0000-0000-000000000006',1);
COMMIT;
INSERT INTO assessment_attempts(id,assessment_id,assessment_version,student_id,attempt_number) VALUES ('00000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000008',1,'00000000-0000-0000-0000-000000000001',1);
INSERT INTO assessment_answers(attempt_id,assessment_id,assessment_version,question_id,question_version,selected_option_index) VALUES ('00000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000008',1,'00000000-0000-0000-0000-000000000006',1,0);`)
	if err != nil {
		t.Fatalf("prepared assessment regressed: %v", err)
	}
	if _, err = db.Exec(ctx, string(timingDown)); err != nil {
		t.Fatalf("timing downgrade after restore: %v", err)
	}
	down, err := os.ReadFile("../../../../migrations/000052_self_quiz_attempts.down.sql")
	if err != nil {
		t.Fatal(err)
	}
	// A rollback must never discard a user's self attempt. Execute its body in
	// a transaction so the expected exception cannot poison the pool.
	downBody := strings.TrimSpace(string(down))
	downBody = strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(strings.TrimPrefix(downBody, "BEGIN;")), "COMMIT;"))
	tx, err := db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = tx.Exec(ctx, downBody); err == nil {
		_ = tx.Rollback(ctx)
		t.Fatal("down migration accepted existing self attempts")
	}
	if err = tx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	var exists bool
	if err = db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM assessment_attempts WHERE id='00000000-0000-0000-0000-000000000007')`).Scan(&exists); err != nil || !exists {
		t.Fatalf("self attempt lost after refused rollback: %v", err)
	}
	_, err = db.Exec(ctx, `
DELETE FROM mastery_evidence WHERE self_attempt_id='00000000-0000-0000-0000-000000000007';
DELETE FROM assessment_results WHERE self_attempt_id='00000000-0000-0000-0000-000000000007';
DELETE FROM assessment_answers WHERE self_attempt_id='00000000-0000-0000-0000-000000000007';
DELETE FROM self_quiz_questions WHERE attempt_id='00000000-0000-0000-0000-000000000007';
DELETE FROM self_quiz_settings WHERE attempt_id='00000000-0000-0000-0000-000000000007';
DELETE FROM assessment_attempts WHERE id='00000000-0000-0000-0000-000000000007';`)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, string(down)); err != nil {
		t.Fatalf("down migration without self attempts: %v", err)
	}
	if err = db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM assessment_answers WHERE attempt_id='00000000-0000-0000-0000-000000000009')`).Scan(&exists); err != nil || !exists {
		t.Fatalf("prepared answer lost on rollback: %v", err)
	}
	if err = db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM assessment_answers WHERE attempt_id='00000000-0000-0000-0000-000000000106')`).Scan(&oldAnswer); err != nil || !oldAnswer {
		t.Fatalf("preexisting answer lost on rollback: %v", err)
	}
}
