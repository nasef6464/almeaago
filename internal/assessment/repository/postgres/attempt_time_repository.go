package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

// RecordQuestionTime updates only the elapsed-time field. It never overwrites
// an answer or a review flag, including when another tab saves concurrently.
func (r *Repository) RecordQuestionTime(ctx context.Context, student, id, qid string, seconds int) (int, error) {
	if seconds < 0 || seconds > 86400 {
		return 0, assessment.ErrInvalidAnswer
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)
	var assessmentID *string
	var version *int
	var status assessment.AttemptStatus
	var expires *time.Time
	var started, now time.Time
	var kind assessment.Kind
	var mode string
	var lock *bool
	var rawState []byte
	err = tx.QueryRow(ctx, `SELECT a.assessment_id::text,a.assessment_version,a.status,a.expires_at,a.started_at,clock_timestamp(),COALESCE(v.assessment_kind,'normal'),COALESCE(v.mock_presentation_mode,''),v.mock_strict_section_lock,a.section_state FROM assessment_attempts a LEFT JOIN assessment_versions v ON v.assessment_id=a.assessment_id AND v.version=a.assessment_version WHERE a.id=$1::uuid AND a.student_id=$2::uuid FOR UPDATE OF a`, id, student).Scan(&assessmentID, &version, &status, &expires, &started, &now, &kind, &mode, &lock, &rawState)
	if err != nil {
		return 0, mapError(err)
	}
	if status == assessment.AttemptExpired {
		return 0, assessment.ErrAttemptExpired
	}
	if status != assessment.AttemptInProgress {
		return 0, assessment.ErrAttemptSubmitted
	}
	if expires != nil && !now.Before(*expires) {
		if _, err = tx.Exec(ctx, `UPDATE assessment_attempts SET status='expired',updated_at=now() WHERE id=$1::uuid`, id); err != nil {
			return 0, err
		}
		if err = tx.Commit(ctx); err != nil {
			return 0, err
		}
		return 0, assessment.ErrAttemptExpired
	}
	if elapsed := max(0, int(now.Sub(started).Seconds())); seconds > elapsed {
		seconds = elapsed
	}
	var questionVersion int
	if assessmentID == nil {
		err = tx.QueryRow(ctx, `SELECT question_version FROM self_quiz_questions WHERE attempt_id=$1::uuid AND question_id=$2::uuid`, id, qid).Scan(&questionVersion)
		if err != nil {
			return 0, mapError(err)
		}
		err = tx.QueryRow(ctx, `INSERT INTO assessment_answers(attempt_id,self_attempt_id,question_id,question_version,time_spent_seconds) VALUES($1::uuid,$1::uuid,$2::uuid,$3,$4) ON CONFLICT(attempt_id,question_id) DO UPDATE SET time_spent_seconds=GREATEST(assessment_answers.time_spent_seconds,excluded.time_spent_seconds),last_saved_at=GREATEST(assessment_answers.last_saved_at,clock_timestamp()) WHERE assessment_answers.self_attempt_id=excluded.self_attempt_id AND assessment_answers.question_version=excluded.question_version RETURNING time_spent_seconds`, id, qid, questionVersion, seconds).Scan(&seconds)
	} else {
		if version == nil {
			return 0, assessment.ErrConflict
		}
		var section string
		err = tx.QueryRow(ctx, `SELECT question_version,COALESCE(section_id::text,'') FROM assessment_version_questions WHERE assessment_id=$1::uuid AND assessment_version=$2 AND question_id=$3::uuid`, *assessmentID, *version, qid).Scan(&questionVersion, &section)
		if err != nil {
			return 0, mapError(err)
		}
		if strictMode(kind, mode, lock) {
			sections, e := loadAttemptSections(ctx, tx, *assessmentID, *version)
			if e != nil {
				return 0, e
			}
			stored, e := decodeStrictState(rawState)
			if e != nil {
				return 0, e
			}
			progress, e := resolveStrictSectionProgress(sections, stored, started, now)
			if e != nil {
				return 0, e
			}
			if progress.Finished || section == "" || section != progress.CurrentSectionID {
				return 0, assessment.ErrConflict
			}
		}
		err = tx.QueryRow(ctx, `INSERT INTO assessment_answers(attempt_id,assessment_id,assessment_version,question_id,question_version,time_spent_seconds) VALUES($1::uuid,$2::uuid,$3,$4::uuid,$5,$6) ON CONFLICT(attempt_id,question_id) DO UPDATE SET time_spent_seconds=GREATEST(assessment_answers.time_spent_seconds,excluded.time_spent_seconds),last_saved_at=GREATEST(assessment_answers.last_saved_at,clock_timestamp()) WHERE assessment_answers.assessment_id=excluded.assessment_id AND assessment_answers.assessment_version=excluded.assessment_version AND assessment_answers.question_version=excluded.question_version RETURNING time_spent_seconds`, id, *assessmentID, *version, qid, questionVersion, seconds).Scan(&seconds)
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, assessment.ErrConflict
	}
	if err != nil {
		return 0, mapError(err)
	}
	if err = tx.Commit(ctx); err != nil {
		return 0, err
	}
	return seconds, nil
}
