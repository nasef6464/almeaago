package postgres

import (
	"context"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

func (r *Repository) ListResults(ctx context.Context, student string, page, limit int) (assessment.ResultPage, error) {
	rows, err := r.db.Query(ctx, "SELECT x.id::text,x.assessment_id::text,x.assessment_version,v.title,x.attempt_number,z.score,z.total_questions,z.correct_answers,z.wrong_answers,z.unanswered,z.passed,z.time_spent_seconds,z.finalized_at FROM assessment_results z JOIN assessment_attempts x ON x.id=z.attempt_id JOIN assessment_versions v ON v.assessment_id=x.assessment_id AND v.version=x.assessment_version WHERE z.student_id=$1::uuid ORDER BY z.finalized_at DESC,z.attempt_id DESC LIMIT $2 OFFSET $3", student, limit+1, (page-1)*limit)
	if err != nil {
		return assessment.ResultPage{}, err
	}
	defer rows.Close()
	out := assessment.ResultPage{Page: page, Limit: limit}
	for rows.Next() {
		var x assessment.ResultListItem
		if err = rows.Scan(&x.AttemptID, &x.AssessmentID, &x.AssessmentVersion, &x.Title, &x.AttemptNumber, &x.Score, &x.TotalQuestions, &x.CorrectAnswers, &x.WrongAnswers, &x.Unanswered, &x.Passed, &x.TimeSpentSeconds, &x.FinalizedAt); err != nil {
			return out, err
		}
		out.Items = append(out.Items, x)
	}
	if len(out.Items) > limit {
		out.HasMore = true
		out.Items = out.Items[:limit]
	}
	return out, rows.Err()
}
