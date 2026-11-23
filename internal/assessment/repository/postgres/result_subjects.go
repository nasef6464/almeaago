package postgres

import (
	"context"
	"math"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

// Published attempts use the subject recorded by the submission evidence.
// A live question could have changed subjects since the student submitted it.
const publishedResultSubjectEvidence = `
	SELECT q.question_id, q.sort_order, m.path_id, m.subject_id, m.answered, m.is_correct
	FROM assessment_attempts a
	JOIN assessment_versions v ON v.assessment_id=a.assessment_id AND v.version=a.assessment_version
	JOIN assessment_version_questions q ON q.assessment_id=v.assessment_id AND q.assessment_version=v.version
	JOIN mastery_evidence m ON m.source_attempt_id=a.id AND m.student_id=a.student_id
	  AND m.evidence_type='assessment' AND m.assessment_id=v.assessment_id
	  AND m.assessment_version=v.version AND m.question_id=q.question_id
	  AND m.question_version=q.question_version AND m.path_id=v.path_id
	WHERE a.id=$1::uuid AND a.student_id=$2::uuid AND a.status='submitted'
`

// Self quizzes already record the subject in their immutable question snapshot.
const selfResultSubjectEvidence = `
	SELECT q.question_id, q.sort_order, q.path_id, q.subject_id,
	       aa.selected_option_index IS NOT NULL AS answered, COALESCE(aa.is_correct,false) AS is_correct
	FROM assessment_attempts a
	JOIN self_quiz_questions q ON q.attempt_id=a.id
	LEFT JOIN assessment_answers aa ON aa.self_attempt_id=a.id
	  AND aa.question_id=q.question_id AND aa.question_version=q.question_version
	WHERE a.id=$1::uuid AND a.student_id=$2::uuid AND a.status='submitted'
`

func (r *Repository) resultSubjectBreakdown(ctx context.Context, student, attemptID string, evidenceSQL string) ([]assessment.ResultSubjectItem, error) {
	rows, err := r.db.Query(ctx, `
		WITH evidence AS (`+evidenceSQL+`), classified AS (
			SELECT e.*, count(*) OVER (PARTITION BY question_id) AS matches
			FROM evidence e
		)
		SELECT c.subject_id::text, COALESCE(s.name,''),
		       count(*)::int,
		       count(*) FILTER (WHERE answered AND is_correct)::int,
		       count(*) FILTER (WHERE answered AND NOT is_correct)::int,
		       count(*) FILTER (WHERE NOT answered)::int
		FROM classified c
		LEFT JOIN subjects s ON s.id=c.subject_id AND s.path_id=c.path_id
		WHERE c.matches=1 AND c.subject_id IS NOT NULL
		GROUP BY c.subject_id,s.name
		ORDER BY min(c.sort_order),c.subject_id
	`, attemptID, student)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []assessment.ResultSubjectItem
	for rows.Next() {
		var item assessment.ResultSubjectItem
		if err = rows.Scan(&item.SubjectID, &item.SubjectName, &item.Total, &item.Correct, &item.Wrong, &item.Unanswered); err != nil {
			return nil, err
		}
		item.Score = int(math.Round(100 * float64(item.Correct) / float64(item.Total)))
		items = append(items, item)
	}
	return items, rows.Err()
}
