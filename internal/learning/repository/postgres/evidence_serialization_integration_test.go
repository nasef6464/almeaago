package postgres

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

const evidenceStudent = "00000000-0000-0000-0000-000000000071"
const evidenceOtherStudent = "00000000-0000-0000-0000-000000000072"
const evidencePath = "00000000-0000-0000-0000-000000000073"
const evidenceSubject = "00000000-0000-0000-0000-000000000074"
const evidenceSkill = "00000000-0000-0000-0000-000000000075"
const evidenceGate int64 = 764320192

type evidenceFixture struct {
	ctx      context.Context
	db       *pgxpool.Pool
	observer *pgx.Conn
	repo     *Repository
	app      string
	now      time.Time
}

// Copies the real migrated shapes, defaults, checks and unique indexes into an
// isolated disposable schema. Foreign keys are deliberately not copied: these
// tests exercise the real learning writers, not unrelated assessment fixtures.
func newEvidenceFixture(t *testing.T) *evidenceFixture {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL required for PostgreSQL integration")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	t.Cleanup(cancel)
	observer, err := pgx.Connect(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { observer.Close(context.Background()) })
	schema := fmt.Sprintf("learning_evidence_%d", time.Now().UnixNano())
	if _, err = observer.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		cleanup, stop := context.WithTimeout(context.Background(), 5*time.Second)
		defer stop()
		if _, err := observer.Exec(cleanup, "DROP SCHEMA "+schema+" CASCADE"); err != nil {
			t.Error(err)
		}
	})
	for _, table := range []string{"mastery_evidence", "mastery_evidence_skills", "skill_progress", "review_cards", "review_card_skills", "review_answer_submissions"} {
		if _, err = observer.Exec(ctx, "CREATE TABLE "+schema+"."+table+" (LIKE public."+table+" INCLUDING ALL)"); err != nil {
			t.Fatal(err)
		}
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	cfg.MaxConns = 4
	// Writers must request fresh snapshots even when the deployment default differs.
	cfg.ConnConfig.RuntimeParams["default_transaction_isolation"] = "repeatable read"
	cfg.ConnConfig.RuntimeParams["search_path"] = schema + ",public"
	cfg.ConnConfig.RuntimeParams["application_name"] = schema
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	return &evidenceFixture{ctx: ctx, db: db, observer: observer, repo: New(db), app: schema, now: time.Now().UTC().Truncate(time.Microsecond)}
}

func (f *evidenceFixture) assessment(student string, n int, correct bool) learning.SubmissionEvidence {
	return learning.SubmissionEvidence{StudentID: student, AttemptID: fmt.Sprintf("00000000-0000-0000-0000-%012d", 100+n), AssessmentID: evidencePath, AssessmentVersion: 1, PathID: evidencePath, SubjectID: evidenceSubject, OccurredAt: f.now,
		Questions: []learning.QuestionEvidence{{QuestionID: fmt.Sprintf("00000000-0000-0000-0000-%012d", 200+n), QuestionVersion: 1, Answered: true, Correct: correct, SkillIDs: []string{evidenceSkill}}}}
}

func (f *evidenceFixture) review(t *testing.T, n int, correct bool) learning.ReviewAnswerEvent {
	t.Helper()
	card := fmt.Sprintf("00000000-0000-0000-0000-%012d", 300+n)
	question := fmt.Sprintf("00000000-0000-0000-0000-%012d", 400+n)
	_, err := f.db.Exec(f.ctx, `INSERT INTO review_cards
 (id,student_id,question_id,question_version,path_id,subject_id,next_review_at,updated_at)
 VALUES ($1,$2,$3,1,$4,$5,$6,$6)`, card, evidenceStudent, question, evidencePath, evidenceSubject, f.now)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = f.db.Exec(f.ctx, `INSERT INTO review_card_skills(review_card_id,skill_id) VALUES($1,$2)`, card, evidenceSkill); err != nil {
		t.Fatal(err)
	}
	return learning.ReviewAnswerEvent{StudentID: evidenceStudent, CardID: card, QuestionID: question, QuestionVersion: 1, ExpectedCardUpdated: f.now, SelectedOptionIndex: 0, Correct: correct, EvidenceType: learning.EvidenceRemediation, Quality: 2, OccurredAt: f.now, SubmissionKey: fmt.Sprintf("review-retry-%d", n)}
}

// Pause immediately before the aggregate is persisted, after its SELECT has
// already run. Observed PostgreSQL lock waits make the overlap deterministic.
func (f *evidenceFixture) gate(t *testing.T) func() {
	t.Helper()
	sql := fmt.Sprintf(`CREATE FUNCTION %s.pause_progress() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN
 IF NEW.student_id='%s'::uuid THEN PERFORM pg_advisory_xact_lock(%d); END IF;
 RETURN NEW;
 END $$;
 CREATE TRIGGER pause_progress BEFORE INSERT ON %s.skill_progress
 FOR EACH ROW EXECUTE FUNCTION %s.pause_progress();`, f.app, evidenceStudent, evidenceGate, f.app, f.app)
	if _, err := f.observer.Exec(f.ctx, sql); err != nil {
		t.Fatal(err)
	}
	if _, err := f.observer.Exec(f.ctx, `SELECT pg_advisory_lock($1)`, evidenceGate); err != nil {
		t.Fatal(err)
	}
	released := false
	release := func() {
		if released {
			return
		}
		released = true
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if _, err := f.observer.Exec(ctx, `SELECT pg_advisory_unlock($1)`, evidenceGate); err != nil {
			t.Error(err)
		}
	}
	t.Cleanup(release)
	return release
}

func (f *evidenceFixture) waitBlocked(t *testing.T, count int) {
	t.Helper()
	ticker := time.NewTicker(10 * time.Millisecond)
	defer ticker.Stop()
	for {
		var n int
		err := f.observer.QueryRow(f.ctx, `SELECT count(*) FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'`, f.app).Scan(&n)
		if err != nil {
			t.Fatal(err)
		}
		if n == count {
			return
		}
		select {
		case <-ticker.C:
		case <-f.ctx.Done():
			t.Fatalf("expected %d blocked writers, saw %d: %v", count, n, f.ctx.Err())
		}
	}
}

func runEvidenceWrite(fn func() error) <-chan error {
	done := make(chan error, 1)
	go func() { done <- fn() }()
	return done
}
func (f *evidenceFixture) finish(t *testing.T, done <-chan error) {
	t.Helper()
	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-f.ctx.Done():
		t.Fatal(f.ctx.Err())
	}
}
func (f *evidenceFixture) assertProgress(t *testing.T, count int, mastery float64) {
	t.Helper()
	var evidence, attempts, persisted int
	var got float64
	var status, action string
	err := f.db.QueryRow(f.ctx, `SELECT evidence_count,attempts,mastery::float8,status,recommended_action FROM skill_progress WHERE student_id=$1 AND path_id=$2 AND subject_id=$3 AND skill_id=$4`, evidenceStudent, evidencePath, evidenceSubject, evidenceSkill).Scan(&evidence, &attempts, &got, &status, &action)
	if err != nil {
		t.Fatal(err)
	}
	if err = f.db.QueryRow(f.ctx, `SELECT count(*) FROM mastery_evidence WHERE student_id=$1`, evidenceStudent).Scan(&persisted); err != nil {
		t.Fatal(err)
	}
	if evidence != count || attempts != count || persisted != count || got != mastery {
		t.Fatalf("lost evidence: progress=%d attempts=%d persisted=%d mastery=%v; want count=%d mastery=%v", evidence, attempts, persisted, got, count, mastery)
	}
	if count == 2 && (status != "average" || action != "إضافة تدريب قصير ومتابعة الأداء") {
		t.Fatalf("stale decision: status=%s action=%s", status, action)
	}
}

func TestEvidenceSerializationPostgres(t *testing.T) {
	t.Run("saved_review_http", TestReviewSavedHTTPPostgres)
	t.Run("saved_review_manual_fk", TestReviewSavedManualCardLinkedSkillsPostgres)
	t.Run("saved_review_concurrent_evidence", TestReviewSavedConcurrentEvidencePostgres)
	for _, kind := range []string{"assessment_assessment", "assessment_review", "review_review"} {
		t.Run(kind, func(t *testing.T) {
			f := newEvidenceFixture(t)
			a := f.assessment(evidenceStudent, 1, true)
			b := f.assessment(strings.ReplaceAll(evidenceStudent, "-", ""), 2, false)
			var first, second func() error
			if kind == "review_review" {
				r := f.review(t, 1, true)
				first = func() error { _, err := f.repo.ApplyReviewAnswer(f.ctx, r); return err }
			} else {
				first = func() error { _, err := f.repo.ApplyAssessmentEvidence(f.ctx, a); return err }
			}
			if kind == "assessment_assessment" {
				second = func() error { _, err := f.repo.ApplyAssessmentEvidence(f.ctx, b); return err }
			} else {
				r := f.review(t, 2, false)
				second = func() error { _, err := f.repo.ApplyReviewAnswer(f.ctx, r); return err }
			}
			release := f.gate(t)
			one := runEvidenceWrite(first)
			f.waitBlocked(t, 1)
			two := runEvidenceWrite(second)
			f.waitBlocked(t, 2)
			// Other learners are never queued behind this learner's blocked transaction.
			_, err := f.repo.ApplyAssessmentEvidence(f.ctx, f.assessment(evidenceOtherStudent, 9, true))
			if err != nil {
				t.Fatal(err)
			}
			release()
			f.finish(t, one)
			f.finish(t, two)
			f.assertProgress(t, 2, 50)
			if err = first(); err != nil {
				t.Fatalf("first replay: %v", err)
			}
			if err = second(); err != nil {
				t.Fatalf("second replay: %v", err)
			}
			f.assertProgress(t, 2, 50)
		})
	}
	t.Run("identical_review_retry", func(t *testing.T) {
		f := newEvidenceFixture(t)
		event := f.review(t, 1, true)
		release := f.gate(t)
		write := func() error { _, err := f.repo.ApplyReviewAnswer(f.ctx, event); return err }
		one := runEvidenceWrite(write)
		f.waitBlocked(t, 1)
		two := runEvidenceWrite(write)
		f.waitBlocked(t, 2)
		release()
		f.finish(t, one)
		f.finish(t, two)
		f.assertProgress(t, 1, 100)
		event.SelectedOptionIndex = 1
		if _, err := f.repo.ApplyReviewAnswer(f.ctx, event); !errors.Is(err, learning.ErrConflict) {
			t.Fatalf("mismatched replay accepted: %v", err)
		}
	})
	t.Run("cancel_waiting_writer", func(t *testing.T) {
		f := newEvidenceFixture(t)
		release := f.gate(t)
		one := runEvidenceWrite(func() error {
			_, err := f.repo.ApplyAssessmentEvidence(f.ctx, f.assessment(evidenceStudent, 1, true))
			return err
		})
		f.waitBlocked(t, 1)
		ctx, cancel := context.WithCancel(f.ctx)
		defer cancel()
		two := runEvidenceWrite(func() error {
			_, err := f.repo.ApplyAssessmentEvidence(ctx, f.assessment(evidenceStudent, 2, false))
			return err
		})
		f.waitBlocked(t, 2)
		cancel()
		select {
		case err := <-two:
			if !errors.Is(err, context.Canceled) {
				t.Fatalf("cancel: %v", err)
			}
		case <-f.ctx.Done():
			t.Fatal(f.ctx.Err())
		}
		release()
		f.finish(t, one)
		f.assertProgress(t, 1, 100)
		if _, err := f.repo.ApplyAssessmentEvidence(f.ctx, f.assessment(evidenceStudent, 2, false)); err != nil {
			t.Fatal(err)
		}
		f.assertProgress(t, 2, 50)
	})
}
