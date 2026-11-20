package postgres

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

func TestMockAttemptSectionsAndOrderingPostgres(t *testing.T) {
	dsn := os.Getenv("ASSESSMENT_ATTEMPT_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("ASSESSMENT_ATTEMPT_TEST_DATABASE_URL required: use disposable local PostgreSQL")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()
	admin, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := fmt.Sprintf("mock_attempt_%d", time.Now().UnixNano())
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
CREATE TABLE assessment_attempts(id uuid,assessment_id uuid,assessment_version int,student_id uuid,attempt_number int,status text,started_at timestamptz,expires_at timestamptz,submitted_at timestamptz,section_state jsonb NOT NULL DEFAULT '{}'::jsonb,updated_at timestamptz DEFAULT now());
CREATE TABLE assessment_versions(assessment_id uuid,version int,title text,show_progress_bar boolean,require_answer_before_next boolean,allow_question_review boolean,randomize_options boolean,show_results_report boolean,randomize_questions boolean,assessment_kind text,mock_presentation_mode text,mock_strict_section_lock boolean);
CREATE TABLE assessment_sections(id uuid,assessment_id uuid,assessment_version int,title text,subject_id uuid,sort_order int,time_limit_seconds int,domain text,strict_lock boolean);
CREATE TABLE assessment_version_questions(assessment_id uuid,assessment_version int,question_id uuid,question_version int,section_id uuid,sort_order int,points numeric);
CREATE TABLE question_versions(question_id uuid,version int,question_type text,text_content text,image_asset_id uuid,image_alt text,options_embedded_in_image boolean,video_url text,source_meta jsonb,difficulty text);
CREATE TABLE assets(id uuid,public_url text);
CREATE TABLE question_options(question_id uuid,version int,option_index int,option_text text,asset_id uuid);
CREATE TABLE assessment_answers(attempt_id uuid,assessment_id uuid,assessment_version int,question_id uuid,question_version int,selected_option_index int,text_answer text,time_spent_seconds int NOT NULL DEFAULT 0,marked_for_review boolean NOT NULL DEFAULT false,last_saved_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(attempt_id,question_id));
INSERT INTO assessment_versions VALUES ('00000000-0000-0000-0000-000000000001',1,'Mock',true,false,true,false,true,true,'mock','flexible',false);
INSERT INTO assessment_attempts(id,assessment_id,assessment_version,student_id,attempt_number,status,started_at) VALUES ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',1,'00000000-0000-0000-0000-000000000003',1,'in_progress',now());
INSERT INTO assessment_sections VALUES
 ('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001',1,'First',NULL,1,60,'quantitative',false),
 ('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000001',1,'Second',NULL,2,120,'verbal',false);
INSERT INTO assessment_version_questions VALUES
 ('00000000-0000-0000-0000-000000000001',1,'00000000-0000-0000-0000-000000000101',1,'00000000-0000-0000-0000-000000000010',1,1),
 ('00000000-0000-0000-0000-000000000001',1,'00000000-0000-0000-0000-000000000102',1,'00000000-0000-0000-0000-000000000010',2,1),
 ('00000000-0000-0000-0000-000000000001',1,'00000000-0000-0000-0000-000000000103',1,'00000000-0000-0000-0000-000000000020',1,1),
 ('00000000-0000-0000-0000-000000000001',1,'00000000-0000-0000-0000-000000000104',1,'00000000-0000-0000-0000-000000000020',2,1);
INSERT INTO question_versions SELECT question_id,question_version,'text','question',NULL,'',false,'','{}'::jsonb,'easy' FROM assessment_version_questions;
`)
	if err != nil {
		t.Fatal(err)
	}
	attempt, err := New(db, nil).GetAttempt(ctx, "00000000-0000-0000-0000-000000000002")
	if err != nil {
		t.Fatal(err)
	}
	if attempt.Kind != "mock" || attempt.MockPresentationMode != "flexible" || attempt.MockStrictSectionLock == nil || *attempt.MockStrictSectionLock {
		t.Fatalf("wrong mock settings: %+v", attempt)
	}
	if len(attempt.Sections) != 2 || attempt.Sections[0].Title != "First" || attempt.Sections[1].TimeLimitSeconds == nil || *attempt.Sections[1].TimeLimitSeconds != 120 {
		t.Fatalf("bad sections: %+v", attempt.Sections)
	}
	if len(attempt.Questions) != 4 {
		t.Fatalf("questions %d", len(attempt.Questions))
	}
	for i, q := range attempt.Questions {
		if q.SectionID != attempt.Sections[i/2].ID {
			t.Fatalf("question order crosses sections: %+v", attempt.Questions)
		}
	}
	again, err := New(db, nil).GetAttempt(ctx, attempt.ID)
	if err != nil {
		t.Fatal(err)
	}
	for i, q := range attempt.Questions {
		if q.ID != again.Questions[i].ID {
			t.Fatal("random order must be stable after reload")
		}
	}
	// Normal tests with the sequential rule must enforce the same shuffled
	// ordering on the server, not merely hide the next button in the client.
	if _, err = db.Exec(ctx, `UPDATE assessment_versions SET assessment_kind='normal',require_answer_before_next=true;
		INSERT INTO question_options SELECT question_id,question_version,0,'answer',NULL FROM assessment_version_questions`); err != nil {
		t.Fatal(err)
	}
	sequentialAttempt, err := New(db, nil).GetAttempt(ctx, attempt.ID)
	if err != nil || len(sequentialAttempt.Questions) != 4 {
		t.Fatalf("normal order: %+v %v", sequentialAttempt, err)
	}
	repo := New(db, nil)
	studentID := "00000000-0000-0000-0000-000000000003"
	firstID, secondID := sequentialAttempt.Questions[0].ID, sequentialAttempt.Questions[1].ID
	firstChoice := 0
	if _, err = repo.SaveAnswer(ctx, studentID, attempt.ID, secondID, assessment.AnswerWrite{SelectedOptionIndex: &firstChoice}); !errors.Is(err, assessment.ErrConflict) {
		t.Fatalf("later answer before first must be rejected: %v", err)
	}
	if _, err = repo.RecordQuestionTime(ctx, studentID, attempt.ID, firstID, 1); err != nil {
		t.Fatalf("time checkpoint: %v", err)
	}
	if _, err = repo.SaveAnswer(ctx, studentID, attempt.ID, secondID, assessment.AnswerWrite{SelectedOptionIndex: &firstChoice}); !errors.Is(err, assessment.ErrConflict) {
		t.Fatalf("time-only row must not count as an answer: %v", err)
	}
	if _, err = repo.SaveAnswer(ctx, studentID, attempt.ID, firstID, assessment.AnswerWrite{SelectedOptionIndex: &firstChoice}); err != nil {
		t.Fatalf("first answer: %v", err)
	}
	if _, err = repo.SaveAnswer(ctx, studentID, attempt.ID, secondID, assessment.AnswerWrite{SelectedOptionIndex: &firstChoice}); err != nil {
		t.Fatalf("second answer after first: %v", err)
	}
	if _, err = repo.SaveAnswer(ctx, studentID, attempt.ID, firstID, assessment.AnswerWrite{SelectedOptionIndex: &firstChoice}); err != nil {
		t.Fatalf("editing earlier answer: %v", err)
	}
	if _, err = db.Exec(ctx, `DELETE FROM assessment_answers; UPDATE assessment_versions SET assessment_kind='mock',mock_presentation_mode='flexible',require_answer_before_next=true`); err != nil {
		t.Fatal(err)
	}
	mock, err := repo.GetAttempt(ctx, attempt.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = repo.SaveAnswer(ctx, studentID, attempt.ID, mock.Questions[1].ID, assessment.AnswerWrite{SelectedOptionIndex: &firstChoice}); err != nil {
		t.Fatalf("legacy mock is not constrained by the normal rule: %v", err)
	}
	if _, err = db.Exec(ctx, `DELETE FROM assessment_answers; DELETE FROM question_options WHERE option_text='answer'`); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `UPDATE assessment_versions SET mock_presentation_mode='qiyas_strict',mock_strict_section_lock=true`); err != nil {
		t.Fatal(err)
	}
	strict, err := New(db, nil).GetAttempt(ctx, attempt.ID)
	if err != nil || strict.MockPresentationMode != "qiyas_strict" || strict.MockStrictSectionLock == nil || !*strict.MockStrictSectionLock {
		t.Fatalf("strict settings missing: %+v (%v)", strict, err)
	}
	if strict.SectionProgress == nil || strict.SectionProgress.CurrentSectionID != strict.Sections[0].ID || len(strict.Questions) != 2 {
		t.Fatalf("strict attempt exposed questions outside the active section: %+v", strict)
	}
	if strict.TotalQuestions != 4 {
		t.Fatalf("strict attempt must report the whole test size without exposing later questions: %d", strict.TotalQuestions)
	}
	const student = "00000000-0000-0000-0000-000000000003"
	const otherStudent = "00000000-0000-0000-0000-000000000099"
	if _, err = New(db, nil).RecordQuestionTime(ctx, student, attempt.ID, "00000000-0000-0000-0000-000000000101", 1); err != nil {
		t.Fatalf("current section rejected time: %v", err)
	}
	if _, err = New(db, nil).SaveAnswer(ctx, student, attempt.ID, "00000000-0000-0000-0000-000000000103", assessment.AnswerWrite{}); err == nil {
		t.Fatal("saving a future section answer must fail")
	}
	if _, err = New(db, nil).RecordQuestionTime(ctx, student, attempt.ID, "00000000-0000-0000-0000-000000000103", 1); !errors.Is(err, assessment.ErrConflict) {
		t.Fatalf("future section accepted time: %v", err)
	}
	if _, err = New(db, nil).AdvanceStrictSection(ctx, otherStudent, attempt.ID, strict.Sections[0].ID); err == nil {
		t.Fatal("another student cannot advance the section")
	}
	if _, err = New(db, nil).AdvanceStrictSection(ctx, student, attempt.ID, strict.Sections[1].ID); err == nil {
		t.Fatal("a future section cannot be used to skip ahead")
	}
	type advanceResult struct {
		attempt assessment.Attempt
		err     error
	}
	results := make(chan advanceResult, 2)
	for i := 0; i < 2; i++ {
		go func() {
			a, e := New(db, nil).AdvanceStrictSection(ctx, student, attempt.ID, strict.Sections[0].ID)
			results <- advanceResult{a, e}
		}()
	}
	firstAdvance, secondAdvance := <-results, <-results
	next, err := firstAdvance.attempt, firstAdvance.err
	if err != nil || next.SectionProgress == nil || next.SectionProgress.CurrentSectionID != strict.Sections[1].ID || len(next.Questions) != 2 {
		t.Fatalf("advance to second section: %+v %v", next, err)
	}
	if secondAdvance.err != nil || secondAdvance.attempt.SectionProgress == nil || secondAdvance.attempt.SectionProgress.CurrentSectionID != strict.Sections[1].ID {
		t.Fatalf("concurrent retry skipped a section: %+v %v", secondAdvance.attempt, secondAdvance.err)
	}
	retry, err := New(db, nil).AdvanceStrictSection(ctx, student, attempt.ID, strict.Sections[0].ID)
	if err != nil || retry.SectionProgress.CurrentSectionID != strict.Sections[1].ID {
		t.Fatalf("retry changed section: %+v %v", retry, err)
	}
	if _, err = New(db, nil).SaveAnswer(ctx, student, attempt.ID, "00000000-0000-0000-0000-000000000101", assessment.AnswerWrite{}); err == nil {
		t.Fatal("locked previous section must reject answers")
	}
	if _, err = New(db, nil).RecordQuestionTime(ctx, student, attempt.ID, "00000000-0000-0000-0000-000000000101", 1); !errors.Is(err, assessment.ErrConflict) {
		t.Fatalf("locked section accepted time: %v", err)
	}
	if _, err = db.Exec(ctx, `UPDATE assessment_attempts SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1::uuid`, attempt.ID); err != nil {
		t.Fatal(err)
	}
	expired, err := New(db, nil).GetAttempt(ctx, attempt.ID)
	if err != nil || len(expired.Questions) != 0 {
		t.Fatalf("expired strict attempt must not expose questions: %+v %v", expired, err)
	}
	if _, err = New(db, nil).SaveAnswer(ctx, student, attempt.ID, "00000000-0000-0000-0000-000000000103", assessment.AnswerWrite{}); !errors.Is(err, assessment.ErrAttemptExpired) {
		t.Fatalf("answer after deadline must be rejected: %v", err)
	}
	if _, err = db.Exec(ctx, `UPDATE assessment_attempts SET expires_at=NULL,status='in_progress' WHERE id=$1::uuid`, attempt.ID); err != nil {
		t.Fatal(err)
	}
	finished, err := New(db, nil).AdvanceStrictSection(ctx, student, attempt.ID, strict.Sections[1].ID)
	if err != nil || finished.SectionProgress == nil || !finished.SectionProgress.Finished || finished.Questions == nil {
		t.Fatalf("finished attempt must contain an empty questions array: %+v %v", finished, err)
	}
	// Normal assessments must keep their established global ordering.
	if _, err = db.Exec(ctx, `UPDATE assessment_versions SET assessment_kind='normal',mock_presentation_mode=NULL,mock_strict_section_lock=NULL,randomize_questions=false`); err != nil {
		t.Fatal(err)
	}
	normal, err := New(db, nil).GetAttempt(ctx, attempt.ID)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"00000000-0000-0000-0000-000000000101", "00000000-0000-0000-0000-000000000103", "00000000-0000-0000-0000-000000000102", "00000000-0000-0000-0000-000000000104"}
	for i, q := range normal.Questions {
		if q.ID != want[i] {
			t.Fatalf("normal question ordering changed: %+v", normal.Questions)
		}
	}
	if _, err = db.Exec(ctx, `UPDATE assessment_versions SET randomize_options=true; UPDATE question_versions SET options_embedded_in_image=true WHERE question_id='00000000-0000-0000-0000-000000000101'; INSERT INTO question_options(question_id,version,option_index,option_text) SELECT '00000000-0000-0000-0000-000000000101',1,i,i::text FROM generate_series(0,3) i`); err != nil {
		t.Fatal(err)
	}
	embedded, err := New(db, nil).GetAttempt(ctx, attempt.ID)
	if err != nil {
		t.Fatal(err)
	}
	for _, q := range embedded.Questions {
		if q.ID == "00000000-0000-0000-0000-000000000101" {
			if len(q.Options) != 4 {
				t.Fatalf("options missing: %+v", q.Options)
			}
			for i, option := range q.Options {
				if option.Index != i {
					t.Fatalf("embedded image labels shuffled: %+v", q.Options)
				}
			}
			return
		}
	}
	t.Fatal("embedded question missing")
}
