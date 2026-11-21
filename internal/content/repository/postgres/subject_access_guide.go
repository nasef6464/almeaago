package postgres

import (
	"context"
	content "github.com/nasef6464/almeaago/internal/content/domain"
)

// CountSubjectAccessContent counts visible roots and their visible immediate
// children, as discoverable in the learner workspace, without page truncation.
func (r *Repository) CountSubjectAccessContent(ctx context.Context, pathID, subjectID string) (content.SubjectAccessGuideCounts, error) {
	var out content.SubjectAccessGuideCounts
	err := r.db.QueryRow(ctx, `
	WITH discoverable_topics AS (
	 SELECT t.is_locked FROM foundation_topics t
	 WHERE t.path_id=$1::uuid AND t.subject_id=$2::uuid AND t.status='active' AND t.is_visible=true
	 AND (t.parent_topic_id IS NULL OR EXISTS (
	   SELECT 1 FROM foundation_topics parent WHERE parent.id=t.parent_topic_id
	   AND parent.parent_topic_id IS NULL AND parent.path_id=t.path_id AND parent.subject_id=t.subject_id
	   AND parent.status='active' AND parent.is_visible=true
	 ))
	)
	SELECT
	 (SELECT count(*)::int FROM discoverable_topics WHERE NOT is_locked),
	 (SELECT count(*)::int FROM discoverable_topics WHERE is_locked),
	 (SELECT count(*)::int FROM library_items WHERE path_id=$1::uuid AND subject_id=$2::uuid AND workflow_status='approved' AND is_visible=true AND NOT is_locked),
	 (SELECT count(*)::int FROM library_items WHERE path_id=$1::uuid AND subject_id=$2::uuid AND workflow_status='approved' AND is_visible=true AND is_locked)
	`, pathID, subjectID).Scan(&out.FoundationFree, &out.FoundationPaid, &out.LibraryFree, &out.LibraryPaid)
	return out, mapError(err)
}

func (r *Repository) ListSubjectGuideCourses(ctx context.Context, pathID, subjectID string, limit int) (content.SubjectGuideCourses, error) {
	rows, err := r.db.Query(ctx, `SELECT id::text FROM courses
	 WHERE path_id=$1::uuid AND subject_id=$2::uuid AND workflow_status='approved' AND is_published=true AND is_visible=true
	 ORDER BY id LIMIT $3`, pathID, subjectID, limit+1)
	if err != nil {
		return content.SubjectGuideCourses{}, mapError(err)
	}
	defer rows.Close()
	out := content.SubjectGuideCourses{IDs: []string{}}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return content.SubjectGuideCourses{}, err
		}
		out.IDs = append(out.IDs, id)
	}
	if err := rows.Err(); err != nil {
		return content.SubjectGuideCourses{}, err
	}
	if len(out.IDs) > limit {
		out.HasMore = true
		out.IDs = out.IDs[:limit]
	}
	return out, nil
}
