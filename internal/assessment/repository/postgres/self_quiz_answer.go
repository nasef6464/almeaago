package postgres

import (
	"context"
	"strings"
	"time"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

func (r *Repository) saveSelfQuizAnswer(ctx context.Context, student, id, qid string, w assessment.AnswerWrite) (assessment.Attempt, error) {
	// Self quizzes currently accept only objectively scored choice questions.
	if strings.TrimSpace(w.TextAnswer) != "" {
		return assessment.Attempt{}, assessment.ErrInvalidAnswer
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return assessment.Attempt{}, err
	}
	defer tx.Rollback(ctx)
	var status assessment.AttemptStatus
	var expires *time.Time
	var started, serverTime time.Time
	err = tx.QueryRow(ctx, `SELECT status,expires_at,started_at,clock_timestamp() FROM assessment_attempts WHERE id=$1::uuid AND student_id=$2::uuid AND attempt_kind='self' FOR UPDATE`, id, student).Scan(&status, &expires, &started, &serverTime)
	if err != nil {
		return assessment.Attempt{}, mapError(err)
	}
	if status == assessment.AttemptExpired {
		return assessment.Attempt{}, assessment.ErrAttemptExpired
	}
	if status != assessment.AttemptInProgress {
		return assessment.Attempt{}, assessment.ErrAttemptSubmitted
	}
	if elapsed := max(0, int(serverTime.Sub(started).Seconds())); w.TimeSpentSeconds > elapsed {
		w.TimeSpentSeconds = elapsed
	}
	if expires != nil && !serverTime.Before(*expires) {
		if _, err = tx.Exec(ctx, `UPDATE assessment_attempts SET status='expired',updated_at=now() WHERE id=$1::uuid`, id); err != nil {
			return assessment.Attempt{}, err
		}
		if err = tx.Commit(ctx); err != nil {
			return assessment.Attempt{}, err
		}
		return assessment.Attempt{}, assessment.ErrAttemptExpired
	}
	var version int
	if err = tx.QueryRow(ctx, `SELECT question_version FROM self_quiz_questions WHERE attempt_id=$1::uuid AND question_id=$2::uuid`, id, qid).Scan(&version); err != nil {
		return assessment.Attempt{}, mapError(err)
	}
	if w.SelectedOptionIndex != nil {
		var valid bool
		if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM question_options WHERE question_id=$1::uuid AND version=$2 AND option_index=$3)`, qid, version, *w.SelectedOptionIndex).Scan(&valid); err != nil {
			return assessment.Attempt{}, err
		}
		if !valid {
			return assessment.Attempt{}, assessment.ErrInvalidAnswer
		}
	}
	tag, err := tx.Exec(ctx, `INSERT INTO assessment_answers(attempt_id,self_attempt_id,question_id,question_version,selected_option_index,text_answer,time_spent_seconds,marked_for_review) VALUES($1::uuid,$1::uuid,$2::uuid,$3,$4,NULLIF($5,''),$6,$7) ON CONFLICT(attempt_id,question_id) DO UPDATE SET selected_option_index=excluded.selected_option_index,text_answer=excluded.text_answer,time_spent_seconds=GREATEST(assessment_answers.time_spent_seconds,excluded.time_spent_seconds),marked_for_review=excluded.marked_for_review,last_saved_at=GREATEST(assessment_answers.last_saved_at,clock_timestamp()) WHERE assessment_answers.self_attempt_id=excluded.self_attempt_id AND assessment_answers.question_version=excluded.question_version`, id, qid, version, w.SelectedOptionIndex, w.TextAnswer, w.TimeSpentSeconds, w.MarkedForReview)
	if err != nil {
		return assessment.Attempt{}, mapError(err)
	}
	if tag.RowsAffected() != 1 {
		return assessment.Attempt{}, assessment.ErrConflict
	}
	if err = tx.Commit(ctx); err != nil {
		return assessment.Attempt{}, err
	}
	return r.GetAttempt(ctx, id)
}
