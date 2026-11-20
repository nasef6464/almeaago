package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"
)

// Use the exact same stable order as GetAttempt, including attempt-specific
// shuffling. The attempt row is locked by the caller, serializing saves.
func hasUnansweredPreviousQuestion(ctx context.Context, tx pgx.Tx, assessmentID string, version int, attemptID, questionID string) (bool, error) {
	var blocked bool
	err := tx.QueryRow(ctx, `WITH ordered AS (
		SELECT aq.question_id, row_number() OVER (ORDER BY
			CASE WHEN v.randomize_questions THEN md5($3::text || aq.question_id::text)
			ELSE lpad(aq.sort_order::text,12,'0') END, aq.question_id) AS position
		FROM assessment_version_questions aq
		JOIN assessment_versions v ON v.assessment_id=aq.assessment_id AND v.version=aq.assessment_version
		JOIN question_versions qv ON qv.question_id=aq.question_id AND qv.version=aq.question_version
		WHERE aq.assessment_id=$1::uuid AND aq.assessment_version=$2
	)
	SELECT EXISTS (
		SELECT 1 FROM ordered previous JOIN ordered target ON target.question_id=$4::uuid
		LEFT JOIN assessment_answers answer ON answer.attempt_id=$3::uuid AND answer.question_id=previous.question_id
		WHERE previous.position < target.position AND answer.selected_option_index IS NULL
			AND (answer.text_answer IS NULL OR btrim(answer.text_answer)='')
	)`, assessmentID, version, attemptID, questionID).Scan(&blocked)
	return blocked, err
}
