package postgres

import (
	"context"
	"math"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

// Section scores are unweighted percentages, like the legacy breakdown. The
// overall score remains the independently stored, potentially weighted result.
func (r *Repository) resultSectionBreakdown(ctx context.Context, student string, result assessment.Result) ([]assessment.ResultSectionItem, error) {
	rows, err := r.db.Query(ctx, `
		SELECT s.id::text, s.title, count(q.question_id)::int,
		       count(*) FILTER (WHERE aa.selected_option_index IS NOT NULL AND aa.is_correct IS TRUE)::int,
		       count(*) FILTER (WHERE aa.selected_option_index IS NOT NULL AND aa.is_correct IS FALSE)::int,
		       count(q.question_id) FILTER (WHERE aa.selected_option_index IS NULL)::int
		FROM assessment_attempts a
		JOIN assessment_sections s
		  ON s.assessment_id=a.assessment_id AND s.assessment_version=a.assessment_version
		LEFT JOIN assessment_version_questions q
		  ON q.section_id=s.id AND q.assessment_id=s.assessment_id AND q.assessment_version=s.assessment_version
		LEFT JOIN assessment_answers aa
		  ON aa.attempt_id=a.id AND aa.question_id=q.question_id AND aa.question_version=q.question_version
		WHERE a.id=$1::uuid AND a.student_id=$2::uuid AND a.status='submitted'
		GROUP BY s.id,s.title,s.sort_order
		ORDER BY s.sort_order,s.id
	`, result.AttemptID, student)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []assessment.ResultSectionItem
	var total, correct, wrong, unanswered int
	for rows.Next() {
		var item assessment.ResultSectionItem
		if err := rows.Scan(&item.SectionID, &item.SectionName, &item.Total, &item.Correct, &item.Wrong, &item.Unanswered); err != nil {
			return nil, err
		}
		if item.Total > 0 {
			item.Score = int(math.Round(100 * float64(item.Correct) / float64(item.Total)))
		}
		total += item.Total
		correct += item.Correct
		wrong += item.Wrong
		unanswered += item.Unanswered
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	// Older attempts may lack graded answers or complete section placements.
	// Publish a breakdown only when it accounts for the stored result.
	if total != result.TotalQuestions || correct != result.CorrectAnswers ||
		wrong != result.WrongAnswers || unanswered != result.Unanswered {
		return nil, nil
	}
	return items, nil
}
