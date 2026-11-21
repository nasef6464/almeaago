package postgres

import (
	"context"

	content "github.com/nasef6464/almeaago/internal/content/domain"
)

// ListPublicCourses is the anonymous, bounded catalog for homepage cards.
// Every row must satisfy publication AND visibility AND active taxonomy.
// Restrict to platform-owned courses until an explicit school-to-public
// publication contract is implemented; school content must not leak.
func (r *Repository) ListPublicCourses(ctx context.Context, limit int) ([]content.PublicCourse, error) {
	if limit < 1 || limit > 100 {
		return nil, content.ErrInvalidTaxonomy
	}
	rows, err := r.db.Query(ctx, publicSearchPaths+`
 SELECT c.id::text,c.title,c.instructor_name,COALESCE(a.public_url,'')
 FROM courses c
 JOIN public_paths p ON p.id=c.path_id
 JOIN subjects s ON s.id=c.subject_id AND s.path_id=c.path_id AND s.status='active' AND COALESCE(s.presentation->>'isVisible','true') <> 'false'
 LEFT JOIN levels level ON level.id=s.level_id AND level.path_id=p.id
 LEFT JOIN assets a ON a.id=c.thumbnail_asset_id AND a.status='active'
 WHERE c.workflow_status='approved'
   AND c.is_published=true AND c.is_visible=true
   AND c.owner_type='platform'
   AND (s.level_id IS NULL OR (level.status='active' AND COALESCE(level.presentation->>'isVisible','true') <> 'false'))
 ORDER BY c.published_at DESC NULLS LAST,c.updated_at DESC,c.id DESC
 LIMIT $1
 `, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]content.PublicCourse, 0, limit)
	for rows.Next() {
		var row content.PublicCourse
		if err := rows.Scan(&row.ID, &row.Title, &row.InstructorName, &row.ThumbnailURL); err != nil {
			return nil, err
		}
		items = append(items, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}
