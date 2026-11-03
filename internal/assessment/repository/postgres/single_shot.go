package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

func (r *Repository) SingleShotSubmit(
	ctx context.Context,
	studentID, assessmentID string,
	req assessment.SingleShotSubmissionRequest,
) (assessment.ResultDetail, error) {
	// 1. Idempotency Check
	if req.SubmissionKey != "" {
		var existingAttemptID string
		err := r.db.QueryRow(ctx, `
			SELECT id::text
			FROM assessment_attempts
			WHERE submission_key = $1
			  AND student_id = $2::uuid
			  AND status = 'submitted'
			LIMIT 1
		`, req.SubmissionKey, studentID).Scan(&existingAttemptID)
		if err == nil {
			return r.GetResultDetail(ctx, studentID, existingAttemptID)
		}
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return assessment.ResultDetail{}, err
	}
	defer tx.Rollback(ctx)

	// 2. Resolve Assessment & Published Version
	var actualAssessmentID, title string
	var version, maxAttempts int
	var passingScore float64
	var timeLimitSeconds *int
	err = tx.QueryRow(ctx, `
		SELECT
			a.id::text,
			a.published_version,
			v.title,
			v.max_attempts,
			v.passing_score,
			v.time_limit_seconds
		FROM assessments a
		JOIN assessment_versions v ON v.assessment_id = a.id AND v.version = a.published_version
		WHERE (a.id::text = $1 OR a.assessment_code = $1)
		  AND a.workflow_status = 'approved'
		  AND a.is_published = true
		  AND a.is_visible = true
		FOR UPDATE OF a
	`, assessmentID).Scan(
		&actualAssessmentID,
		&version,
		&title,
		&maxAttempts,
		&passingScore,
		&timeLimitSeconds,
	)
	if err != nil {
		return assessment.ResultDetail{}, mapError(err)
	}

	// 3. Locate or Create Attempt
	var attemptID string
	var expiresAt *time.Time
	err = tx.QueryRow(ctx, `
		SELECT id::text, expires_at
		FROM assessment_attempts
		WHERE assessment_id = $1::uuid
		  AND assessment_version = $2
		  AND student_id = $3::uuid
		  AND status = 'in_progress'
		  AND assignment_id IS NULL
		  AND session_id IS NULL
		  AND placement_id IS NULL
		ORDER BY created_at DESC
		LIMIT 1
		FOR UPDATE
	`, actualAssessmentID, version, studentID).Scan(&attemptID, &expiresAt)

	if err == nil {
		// Existing in-progress attempt found
		if expiresAt != nil && time.Now().After(*expiresAt) {
			_, _ = tx.Exec(ctx, `UPDATE assessment_attempts SET status = 'expired', updated_at = now() WHERE id = $1::uuid`, attemptID)
			_ = tx.Commit(ctx)
			return assessment.ResultDetail{}, assessment.ErrAttemptExpired
		}
	} else if errors.Is(err, pgx.ErrNoRows) {
		// No in-progress attempt, verify used attempts
		var used int
		err = tx.QueryRow(ctx, `
			SELECT count(*)
			FROM assessment_attempts
			WHERE assessment_id = $1::uuid
			  AND assessment_version = $2
			  AND student_id = $3::uuid
			  AND assignment_id IS NULL
			  AND session_id IS NULL
			  AND placement_id IS NULL
		`, actualAssessmentID, version, studentID).Scan(&used)
		if err != nil {
			return assessment.ResultDetail{}, err
		}
		if used >= maxAttempts {
			return assessment.ResultDetail{}, assessment.ErrConflict
		}

		startKey := req.SubmissionKey
		if startKey == "" {
			startKey = "direct-" + actualAssessmentID + "-" + time.Now().UTC().Format(time.RFC3339Nano)
		}

		err = tx.QueryRow(ctx, `
			INSERT INTO assessment_attempts (
				assessment_id,
				assessment_version,
				student_id,
				attempt_number,
				start_key,
				expires_at
			)
			VALUES (
				$1::uuid,
				$2,
				$3::uuid,
				$4,
				$5,
				CASE WHEN $6::int IS NULL THEN NULL ELSE now() + make_interval(secs => $6) END
			)
			RETURNING id::text
		`, actualAssessmentID, version, studentID, used+1, startKey, timeLimitSeconds).Scan(&attemptID)
		if err != nil {
			return assessment.ResultDetail{}, mapError(err)
		}
	} else {
		return assessment.ResultDetail{}, err
	}

	// 4. Query All Assessment Version Questions
	type questionMeta struct {
		id      string
		version int
		correct *int
	}
	qRows, err := tx.Query(ctx, `
		SELECT aq.question_id::text, aq.question_version, qv.correct_option_index
		FROM assessment_version_questions aq
		JOIN question_versions qv ON qv.question_id = aq.question_id AND qv.version = aq.question_version
		WHERE aq.assessment_id = $1::uuid AND aq.assessment_version = $2
	`, actualAssessmentID, version)
	if err != nil {
		return assessment.ResultDetail{}, err
	}
	defer qRows.Close()

	var questions []questionMeta
	for qRows.Next() {
		var q questionMeta
		if err := qRows.Scan(&q.id, &q.version, &q.correct); err != nil {
			return assessment.ResultDetail{}, err
		}
		questions = append(questions, q)
	}
	qRows.Close()

	// 5. Bulk Persist Answers
	for _, q := range questions {
		selected, ok := req.Answers[q.id]
		if ok && selected >= 0 {
			isCorrect := q.correct != nil && selected == *q.correct
			_, err = tx.Exec(ctx, `
				INSERT INTO assessment_answers (
					attempt_id,
					assessment_id,
					assessment_version,
					question_id,
					question_version,
					selected_option_index,
					is_correct,
					scored_at,
					last_saved_at
				)
				VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5, $6, $7, now(), now())
				ON CONFLICT (attempt_id, question_id) DO UPDATE SET
					selected_option_index = EXCLUDED.selected_option_index,
					is_correct = EXCLUDED.is_correct,
					scored_at = now(),
					last_saved_at = now()
			`, attemptID, actualAssessmentID, version, q.id, q.version, selected, isCorrect)
			if err != nil {
				return assessment.ResultDetail{}, err
			}
		}
	}

	// 6. Score & Grade
	var total, correct, wrong, unanswered int
	var score float64
	err = tx.QueryRow(ctx, `
		WITH q AS (
			SELECT aq.question_id, aq.points, qv.correct_option_index
			FROM assessment_version_questions aq
			JOIN question_versions qv ON qv.question_id = aq.question_id AND qv.version = aq.question_version
			WHERE aq.assessment_id = $1::uuid AND aq.assessment_version = $2
		),
		s AS (
			SELECT q.*, aa.selected_option_index
			FROM q
			LEFT JOIN assessment_answers aa ON aa.attempt_id = $3::uuid AND aa.question_id = q.question_id
		)
		SELECT
			count(*)::int,
			count(*) FILTER (WHERE selected_option_index IS NOT NULL AND selected_option_index = correct_option_index)::int,
			count(*) FILTER (WHERE selected_option_index IS NOT NULL AND selected_option_index <> correct_option_index)::int,
			count(*) FILTER (WHERE selected_option_index IS NULL)::int,
			CASE WHEN sum(points) > 0 THEN 100.0 * COALESCE(sum(points) FILTER (WHERE selected_option_index = correct_option_index), 0) / sum(points) ELSE 0 END
		FROM s
	`, actualAssessmentID, version, attemptID).Scan(&total, &correct, &wrong, &unanswered, &score)
	if err != nil {
		return assessment.ResultDetail{}, err
	}

	timeSpent := req.TimeSpentSeconds
	if timeSpent <= 0 {
		timeSpent = 0
	}
	passed := score >= passingScore

	_, err = tx.Exec(ctx, `
		INSERT INTO assessment_results (
			attempt_id,
			assessment_id,
			assessment_version,
			student_id,
			score,
			total_questions,
			correct_answers,
			wrong_answers,
			unanswered,
			passed,
			time_spent_seconds
		)
		VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (attempt_id) DO UPDATE SET
			score = EXCLUDED.score,
			total_questions = EXCLUDED.total_questions,
			correct_answers = EXCLUDED.correct_answers,
			wrong_answers = EXCLUDED.wrong_answers,
			unanswered = EXCLUDED.unanswered,
			passed = EXCLUDED.passed,
			time_spent_seconds = EXCLUDED.time_spent_seconds,
			finalized_at = now()
	`, attemptID, actualAssessmentID, version, studentID, score, total, correct, wrong, unanswered, passed, timeSpent)
	if err != nil {
		return assessment.ResultDetail{}, mapError(err)
	}

	submissionKey := req.SubmissionKey
	if submissionKey == "" {
		submissionKey = "sub-" + attemptID
	}
	_, err = tx.Exec(ctx, `
		UPDATE assessment_attempts
		SET status = 'submitted',
		    submission_key = $2,
		    submitted_at = now(),
		    updated_at = now()
		WHERE id = $1::uuid
	`, attemptID, submissionKey)
	if err != nil {
		return assessment.ResultDetail{}, mapError(err)
	}

	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  studentID,
		Action:       "assessment.attempt.single_shot_submit",
		ResourceType: "assessment_attempt",
		ResourceID:   attemptID,
		Metadata: map[string]any{
			"assessmentId": actualAssessmentID,
			"score":        score,
			"source":       req.Source,
		},
	}); err != nil {
		return assessment.ResultDetail{}, err
	}

	if err = tx.Commit(ctx); err != nil {
		return assessment.ResultDetail{}, err
	}

	return r.GetResultDetail(ctx, studentID, attemptID)
}
