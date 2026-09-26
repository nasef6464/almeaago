package postgres

import (
	"context"

	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

func (r *Repository) ParentStudentLearningSnapshots(
	ctx context.Context,
	studentIDs []string,
	weakLimit int,
) (map[string]learning.ParentStudentLearningSnapshot, error) {
	out := make(map[string]learning.ParentStudentLearningSnapshot, len(studentIDs))
	for _, id := range studentIDs {
		out[id] = learning.ParentStudentLearningSnapshot{StudentID: id, WeakSkills: []learning.ParentWeakSkill{}}
	}
	if len(studentIDs) == 0 {
		return out, nil
	}
	if weakLimit < 1 {
		weakLimit = 5
	}
	if weakLimit > 10 {
		weakLimit = 10
	}

	rows, err := r.db.Query(ctx, `
		WITH ranked AS (
			SELECT
				sp.student_id,
				sp.path_id,
				sp.subject_id,
				sp.skill_id,
				s.name AS skill_name,
				sp.mastery,
				sp.status,
				sp.attempts,
				sp.evidence_count,
				sp.recommended_action,
				COALESCE(sp.last_evidence_at,sp.created_at) AS last_evidence_at,
				ROW_NUMBER() OVER(
					PARTITION BY sp.student_id
					ORDER BY sp.mastery ASC,sp.last_evidence_at DESC NULLS LAST,sp.skill_id
				) AS rn
			FROM skill_progress sp
			JOIN skills s ON s.id=sp.skill_id
			WHERE sp.student_id::text=ANY($1::text[])
			  AND sp.mastery < 75
			  AND s.status='active'
		)
		SELECT student_id::text,path_id::text,subject_id::text,skill_id::text,skill_name,
		       mastery::float8,status,attempts,evidence_count,recommended_action,last_evidence_at
		FROM ranked
		WHERE rn <= $2
		ORDER BY student_id,rn
	`, studentIDs, weakLimit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var studentID string
		var item learning.ParentWeakSkill
		if err = rows.Scan(
			&studentID,
			&item.PathID,
			&item.SubjectID,
			&item.SkillID,
			&item.SkillName,
			&item.Mastery,
			&item.Status,
			&item.Attempts,
			&item.EvidenceCount,
			&item.RecommendedAction,
			&item.LastEvidenceAt,
		); err != nil {
			return nil, err
		}
		snapshot := out[studentID]
		snapshot.WeakSkills = append(snapshot.WeakSkills, item)
		out[studentID] = snapshot
	}
	return out, rows.Err()
}
