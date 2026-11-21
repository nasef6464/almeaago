package postgres

import (
	"context"

	content "github.com/nasef6464/almeaago/internal/content/domain"
)

// Order is identical to GetLearningSpace so page two follows its first 50 rows.
func (r *Repository) ListLearnerFoundationPage(ctx context.Context, pathID, subjectID string, page, limit int) (content.LearnerFoundationPage, error) {
	visible, err := r.learningTaxonomyExists(ctx, pathID, subjectID)
	if err != nil {
		return content.LearnerFoundationPage{}, err
	}
	if !visible {
		return content.LearnerFoundationPage{}, content.ErrNotFound
	}
	rows, err := r.db.Query(ctx, `SELECT id::text,COALESCE(parent_topic_id::text,''),title,description,sort_order,is_locked
		FROM foundation_topics t WHERE t.path_id=$1::uuid AND t.subject_id=$2::uuid AND t.status='active' AND t.is_visible=true
		AND (t.parent_topic_id IS NULL OR EXISTS (SELECT 1 FROM foundation_topics parent WHERE parent.id=t.parent_topic_id AND parent.parent_topic_id IS NULL AND parent.path_id=t.path_id AND parent.subject_id=t.subject_id AND parent.status='active' AND parent.is_visible=true))
		ORDER BY t.sort_order,t.id LIMIT $3 OFFSET $4`, pathID, subjectID, limit+1, (page-1)*limit)
	if err != nil {
		return content.LearnerFoundationPage{}, mapError(err)
	}
	defer rows.Close()
	out := content.LearnerFoundationPage{PathID: pathID, SubjectID: subjectID, Page: page, Items: []content.LearnerTopicSummary{}}
	for rows.Next() {
		var row content.LearnerTopicSummary
		if err := rows.Scan(&row.ID, &row.ParentTopicID, &row.Title, &row.Description, &row.SortOrder, &row.IsLocked); err != nil {
			return content.LearnerFoundationPage{}, err
		}
		out.Items = append(out.Items, row)
	}
	if err := rows.Err(); err != nil {
		return content.LearnerFoundationPage{}, err
	}
	if len(out.Items) > limit {
		out.HasMore = true
		out.Items = out.Items[:limit]
	}
	return out, nil
}
