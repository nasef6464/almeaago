package postgres

import (
	"context"
	"fmt"
	"strings"
	"time"

	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

// WeakestSkillProgress preserves the existing service/HTTP item contract while
// choosing by adaptive priority. Progress and history share one MVCC snapshot.
func (r *Repository) WeakestSkillProgress(ctx context.Context, student, pathID, subjectID string) (*learning.SkillProgress, error) {
	args := []any{student, pathID}
	filter := ""
	if strings.TrimSpace(subjectID) != "" {
		args = append(args, subjectID)
		filter = fmt.Sprintf(" AND subject_id=$%d::uuid", len(args))
	}
	rows, err := r.db.Query(ctx, `
 WITH candidates AS MATERIALIZED (
  SELECT path_id,subject_id,skill_id,mastery,status,attempts,evidence_count,last_evidence_at,recommended_action
  FROM skill_progress WHERE student_id=$1::uuid AND path_id=$2::uuid`+filter+`
  ORDER BY mastery ASC,last_evidence_at DESC NULLS LAST,skill_id,subject_id LIMIT 100
 )
 SELECT p.path_id::text,p.subject_id::text,p.skill_id::text,p.mastery::float8,p.status,
        p.attempts,p.evidence_count,p.last_evidence_at,p.recommended_action,
        COALESCE(h.recent,'[]'::json)
 FROM candidates p
 LEFT JOIN LATERAL (
  SELECT json_agg(json_build_object('mastery',e.mastery,'occurredAt',e.occurred_at)
                  ORDER BY e.occurred_at DESC,e.event_key) AS recent
  FROM (
   SELECT me.evidence_type||':'||COALESCE(me.source_attempt_id::text,me.review_submission_id::text) AS event_key,
          100.0*AVG(CASE WHEN me.is_correct THEN 1.0 ELSE 0.0 END) AS mastery,
          MAX(me.occurred_at) AS occurred_at
   FROM mastery_evidence me JOIN mastery_evidence_skills mes ON mes.evidence_id=me.id
   WHERE me.student_id=$1::uuid AND me.path_id=p.path_id AND me.subject_id=p.subject_id AND mes.skill_id=p.skill_id
   GROUP BY me.evidence_type,COALESCE(me.source_attempt_id::text,me.review_submission_id::text)
   ORDER BY occurred_at DESC,event_key LIMIT 5
  ) e
 ) h ON true
 ORDER BY p.mastery ASC,p.last_evidence_at DESC NULLS LAST,p.skill_id,p.subject_id
 `, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	progress := make([]learning.AdaptiveProgress, 0, 100)
	for rows.Next() {
		var row learning.AdaptiveProgress
		var last *time.Time
		if err = rows.Scan(&row.PathID, &row.SubjectID, &row.SkillID, &row.Mastery, &row.Status, &row.Attempts, &row.EvidenceCount, &last, &row.RecommendedAction, &row.RecentEvidence); err != nil {
			return nil, err
		}
		if last != nil {
			row.LastEvidenceAt = *last
		}
		progress = append(progress, row)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	if err = ctx.Err(); err != nil {
		return nil, err
	}
	ranked := learning.RankAdaptiveProgress(progress, pathID, subjectID, time.Now().UTC())
	if len(ranked) == 0 {
		return nil, nil
	}
	return &ranked[0], nil
}
