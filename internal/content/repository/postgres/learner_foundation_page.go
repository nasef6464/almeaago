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
		FROM foundation_topics WHERE path_id=$1::uuid AND subject_id=$2::uuid AND status='active' AND is_visible=true
		ORDER BY sort_order,id LIMIT $3 OFFSET $4`, pathID, subjectID, limit+1, (page-1)*limit)
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
