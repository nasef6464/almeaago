package postgres

import (
	"context"
	"encoding/json"

	content "github.com/nasef6464/almeaago/internal/content/domain"
)

// The filters and ordering must match the first page in GetLearningSpace.
func (r *Repository) ListLearnerResourcePage(ctx context.Context, pathID, subjectID, kind string, page, limit int) (content.LearnerResourcePage, error) {
	visible, err := r.learningTaxonomyExists(ctx, pathID, subjectID)
	if err != nil {
		return content.LearnerResourcePage{}, err
	}
	if !visible {
		return content.LearnerResourcePage{}, content.ErrNotFound
	}
	out := content.LearnerResourcePage{PathID: pathID, SubjectID: subjectID, Page: page, Courses: []content.LearnerCourseSummary{}, Library: []content.LearnerLibrarySummary{}}
	if kind == "courses" {
		rows, err := r.db.Query(ctx, `SELECT c.id::text,c.title,c.description,c.instructor_name,c.duration_minutes,c.level,
			COALESCE(a.id::text,''),c.drip_content_enabled,c.certificate_enabled,COALESCE(c.presentation, '{}'::jsonb)
			FROM courses c LEFT JOIN assets a ON a.id=c.thumbnail_asset_id AND a.status='active'
			WHERE c.path_id=$1::uuid AND c.subject_id=$2::uuid AND c.workflow_status='approved' AND c.is_published=true AND c.is_visible=true
			ORDER BY c.published_at DESC,c.id DESC LIMIT $3 OFFSET $4`, pathID, subjectID, limit+1, (page-1)*limit)
		if err != nil {
			return content.LearnerResourcePage{}, mapError(err)
		}
		defer rows.Close()
		for rows.Next() {
			var row content.LearnerCourseSummary
			var presentation []byte
			if err := rows.Scan(&row.ID, &row.Title, &row.Description, &row.InstructorName, &row.DurationMinutes, &row.Level, &row.ThumbnailAssetID, &row.DripContentEnabled, &row.CertificateEnabled, &presentation); err != nil {
				return content.LearnerResourcePage{}, err
			}
			row.Presentation = json.RawMessage(presentation)
			out.Courses = append(out.Courses, row)
		}
		if err := rows.Err(); err != nil {
			return content.LearnerResourcePage{}, err
		}
		if len(out.Courses) > limit {
			out.HasMore = true
			out.Courses = out.Courses[:limit]
		}
		return out, nil
	}
	if kind != "library" {
		return content.LearnerResourcePage{}, content.ErrNotFound
	}
	rows, err := r.db.Query(ctx, `SELECT id::text,title,description,item_type,is_locked,COALESCE(external_url, '')
		FROM library_items WHERE path_id=$1::uuid AND subject_id=$2::uuid AND workflow_status='approved' AND is_visible=true
		ORDER BY updated_at DESC,id DESC LIMIT $3 OFFSET $4`, pathID, subjectID, limit+1, (page-1)*limit)
	if err != nil {
		return content.LearnerResourcePage{}, mapError(err)
	}
	defer rows.Close()
	for rows.Next() {
		var row content.LearnerLibrarySummary
		if err := rows.Scan(&row.ID, &row.Title, &row.Description, &row.ItemType, &row.IsLocked, &row.ExternalURL); err != nil {
			return content.LearnerResourcePage{}, err
		}
		out.Library = append(out.Library, row)
	}
	if err := rows.Err(); err != nil {
		return content.LearnerResourcePage{}, err
	}
	if len(out.Library) > limit {
		out.HasMore = true
		out.Library = out.Library[:limit]
	}
	return out, nil
}
