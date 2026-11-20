package postgres

import (
	"context"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

func (r *Repository) ListPreparedQuizzes(ctx context.Context, student string) ([]assessment.PreparedQuizCard, error) {
	rows, err := r.db.Query(ctx, `SELECT a.id::text,v.title,COALESCE(s.name,''),d.mode,d.due_exclusive,
 (SELECT count(*)::int FROM assessment_version_questions aq JOIN question_versions qv ON qv.question_id=aq.question_id AND qv.version=aq.question_version WHERE aq.assessment_id=a.id AND aq.assessment_version=v.version)
 FROM prepared_quiz_distributions d JOIN assessments a ON a.id=d.assessment_id
 JOIN assessment_versions v ON v.assessment_id=a.id AND v.version=a.published_version
		LEFT JOIN subjects s ON s.id=v.subject_id
		WHERE prepared_quiz_is_eligible(a.id,$1::uuid,v.version) ORDER BY a.created_at DESC,a.id DESC`, student)
	if err != nil {
		return nil, mapError(err)
	}
	defer rows.Close()
	out := []assessment.PreparedQuizCard{}
	for rows.Next() {
		var c assessment.PreparedQuizCard
		if err = rows.Scan(&c.ID, &c.Title, &c.SubjectName, &c.Mode, &c.DueExclusive, &c.QuestionCount); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
