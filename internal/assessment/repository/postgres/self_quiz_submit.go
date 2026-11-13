package postgres

import (
	"context"
	"time"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

// The legacy self-quiz generator uses 70 as its passing score.
const selfQuizPassingScore = 70

func (r *Repository) submitSelfQuiz(ctx context.Context, student, id, key string) (assessment.Result, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return assessment.Result{}, err
	}
	defer tx.Rollback(ctx)
	var status assessment.AttemptStatus
	var expires *time.Time
	var existingKey string
	var now time.Time
	err = tx.QueryRow(ctx, `SELECT status,expires_at,COALESCE(submission_key,''),clock_timestamp() FROM assessment_attempts WHERE id=$1::uuid AND student_id=$2::uuid AND attempt_kind='self' FOR UPDATE`, id, student).Scan(&status, &expires, &existingKey, &now)
	if err != nil {
		return assessment.Result{}, mapError(err)
	}
	if status == assessment.AttemptSubmitted {
		if existingKey != key {
			return assessment.Result{}, assessment.ErrAttemptSubmitted
		}
		if err = tx.Commit(ctx); err != nil {
			return assessment.Result{}, err
		}
		return r.GetResult(ctx, id)
	}
	if status != assessment.AttemptInProgress && !(status == assessment.AttemptExpired && expires != nil && !now.Before(*expires)) {
		return assessment.Result{}, assessment.ErrAttemptExpired
	}
	_, err = tx.Exec(ctx, `UPDATE assessment_answers aa SET is_correct=COALESCE(aa.selected_option_index=qv.correct_option_index,false),scored_at=now() FROM question_versions qv WHERE aa.self_attempt_id=$1::uuid AND qv.question_id=aa.question_id AND qv.version=aa.question_version`, id)
	if err != nil {
		return assessment.Result{}, err
	}
	var total, correct, wrong, unanswered, spent int
	var score float64
	err = tx.QueryRow(ctx, `WITH q AS (SELECT sq.question_id,sq.points,qv.correct_option_index FROM self_quiz_questions sq JOIN question_versions qv ON qv.question_id=sq.question_id AND qv.version=sq.question_version WHERE sq.attempt_id=$1::uuid), s AS (SELECT q.*,aa.selected_option_index,COALESCE(aa.time_spent_seconds,0) AS spent FROM q LEFT JOIN assessment_answers aa ON aa.self_attempt_id=$1::uuid AND aa.question_id=q.question_id) SELECT count(*)::int,count(*) FILTER (WHERE selected_option_index=correct_option_index)::int,count(*) FILTER (WHERE selected_option_index IS NOT NULL AND selected_option_index<>correct_option_index)::int,count(*) FILTER (WHERE selected_option_index IS NULL)::int,COALESCE(sum(spent),0)::int,CASE WHEN sum(points)>0 THEN 100.0*COALESCE(sum(points) FILTER (WHERE selected_option_index=correct_option_index),0)/sum(points) ELSE 0 END FROM s`, id).Scan(&total, &correct, &wrong, &unanswered, &spent, &score)
	if err != nil {
		return assessment.Result{}, err
	}
	if total == 0 {
		return assessment.Result{}, assessment.ErrConflict
	}
	var result assessment.Result
	err = tx.QueryRow(ctx, `INSERT INTO assessment_results(attempt_id,self_attempt_id,self_attempt_kind,student_id,score,total_questions,correct_answers,wrong_answers,unanswered,passed,time_spent_seconds) VALUES($1::uuid,$1::uuid,'self',$2::uuid,$3,$4,$5,$6,$7,$8,$9) RETURNING attempt_id::text,score,total_questions,correct_answers,wrong_answers,unanswered,passed,time_spent_seconds,finalized_at`, id, student, score, total, correct, wrong, unanswered, score >= selfQuizPassingScore, spent).Scan(&result.AttemptID, &result.Score, &result.TotalQuestions, &result.CorrectAnswers, &result.WrongAnswers, &result.Unanswered, &result.Passed, &result.TimeSpentSeconds, &result.FinalizedAt)
	if err != nil {
		return assessment.Result{}, mapError(err)
	}
	if _, err = tx.Exec(ctx, `UPDATE assessment_attempts SET status='submitted',submission_key=$2,submitted_at=now(),updated_at=now() WHERE id=$1::uuid`, id, key); err != nil {
		return assessment.Result{}, mapError(err)
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{ActorUserID: student, Action: "assessment.attempt.submit", ResourceType: "assessment_attempt", ResourceID: id, Metadata: map[string]any{"score": score, "kind": "self"}}); err != nil {
		return assessment.Result{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return assessment.Result{}, err
	}
	return result, nil
}
