package postgres

import (
	"context"
	"fmt"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	"strings"
	"unicode/utf16"
)

// Public discovery exposes catalogue metadata only. It does not replace commerce
// access checks or the authenticated learner readers. School/trainer owned rows
// are intentionally excluded from this unauthenticated projection.
const publicSearchPaths = `WITH RECURSIVE public_paths AS (
 SELECT id FROM paths WHERE parent_path_id IS NULL AND status='active'
 UNION ALL SELECT p.id FROM paths p JOIN public_paths parent ON parent.id=p.parent_path_id WHERE p.status='active'
)`
const publicSearchScope = ` JOIN public_paths p ON p.id=%s.path_id
 JOIN subjects s ON s.id=%s.subject_id AND s.path_id=p.id AND s.status='active'
 LEFT JOIN levels level ON level.id=s.level_id AND level.path_id=p.id `
const publicSearchLevel = ` AND (s.level_id IS NULL OR level.status='active') `

func publicSearchPattern(query string, limit int) (string, error) {
	query = strings.TrimSpace(query)
	if size := len(utf16.Encode([]rune(query))); size < 1 || size > 120 || limit < 1 || limit > 20 {
		return "", fmt.Errorf("invalid public search query")
	}
	return "%" + strings.NewReplacer("\\", "\\\\", "%", "\\%", "_", "\\_").Replace(query) + "%", nil
}
func (r *Repository) SearchPublicCourses(ctx context.Context, query string, limit int) ([]content.PublicSearchPreview, error) {
	pattern, err := publicSearchPattern(query, limit)
	if err != nil {
		return nil, err
	}
	rows, err := r.db.Query(ctx, publicSearchPaths+`
 SELECT c.id::text,c.title,c.description,c.path_id::text,c.subject_id::text
 FROM courses c `+fmt.Sprintf(publicSearchScope, "c", "c")+`
 WHERE c.owner_type='platform' AND c.owner_user_id IS NULL AND c.owner_school_id IS NULL
 AND c.workflow_status='approved' AND c.is_published=true AND c.is_visible=true `+publicSearchLevel+`
 AND (c.title ILIKE $1 ESCAPE '\' OR c.description ILIKE $1 ESCAPE '\')
 ORDER BY c.updated_at DESC,c.id DESC LIMIT $2`, pattern, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []content.PublicSearchPreview{}
	for rows.Next() {
		var row content.PublicSearchPreview
		if err = rows.Scan(&row.ID, &row.Title, &row.Subtitle, &row.PathID, &row.SubjectID); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}
func (r *Repository) SearchPublicLessons(ctx context.Context, query string, limit int) ([]content.PublicSearchPreview, error) {
	pattern, err := publicSearchPattern(query, limit)
	if err != nil {
		return nil, err
	}
	// A content-text match is allowed only for an already publicly readable lesson
	// placement: an unlocked foundation chain or an explicitly previewable course
	// placement. Approved orphan/paid/locked lesson bodies are not a search oracle.
	rows, err := r.db.Query(ctx, publicLessonPrefix+`l.id::text,l.title,COALESCE(NULLIF(l.description,''),l.lesson_type),l.path_id::text,l.subject_id::text`+publicLessonFrom+`
 AND (l.title ILIKE $1 ESCAPE '\' OR l.description ILIKE $1 ESCAPE '\' OR l.content_text ILIKE $1 ESCAPE '\')
 ORDER BY l.updated_at DESC,l.id DESC LIMIT $2`, pattern, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []content.PublicSearchPreview{}
	for rows.Next() {
		var row content.PublicSearchPreview
		if err = rows.Scan(&row.ID, &row.Title, &row.Subtitle, &row.PathID, &row.SubjectID); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

const publicLessonPrefix = publicSearchPaths + `, public_topics AS (
 SELECT id,path_id,subject_id FROM foundation_topics
 WHERE parent_topic_id IS NULL AND status='active' AND is_visible=true AND is_locked=false
 UNION ALL SELECT child.id,child.path_id,child.subject_id FROM foundation_topics child
 JOIN public_topics parent ON parent.id=child.parent_topic_id AND parent.path_id=child.path_id AND parent.subject_id=child.subject_id
 WHERE child.status='active' AND child.is_visible=true AND child.is_locked=false
 )
 SELECT `
const publicLessonFrom = ` FROM lessons l
 JOIN public_paths p ON p.id=l.path_id
 JOIN subjects s ON s.id=l.subject_id AND s.path_id=p.id AND s.status='active'
 LEFT JOIN levels level ON level.id=s.level_id AND level.path_id=p.id
 WHERE l.owner_type='platform' AND l.owner_user_id IS NULL AND l.owner_school_id IS NULL
 AND l.workflow_status='approved' AND l.is_visible=true AND l.is_locked=false ` + publicSearchLevel + `
 AND (
 EXISTS(SELECT 1 FROM topic_lessons tl JOIN public_topics t ON t.id=tl.topic_id
        WHERE tl.lesson_id=l.id AND t.path_id=l.path_id AND t.subject_id=l.subject_id)
 OR EXISTS(SELECT 1 FROM course_lessons cl
   JOIN course_modules cm ON cm.id=cl.module_id AND cm.status='active'
   JOIN courses c ON c.id=cm.course_id
   WHERE cl.lesson_id=l.id AND cl.is_preview=true AND c.owner_type='platform'
   AND c.owner_user_id IS NULL AND c.owner_school_id IS NULL
   AND c.workflow_status='approved' AND c.is_published=true AND c.is_visible=true
   AND c.path_id=l.path_id AND c.subject_id=l.subject_id)
 )`

// ListPublicArticles shares every public lesson ownership/placement predicate with
// discovery search. Pagination is explicit; no arbitrary global article truncation.
func (r *Repository) ListPublicArticles(ctx context.Context, page, limit int) (content.PublicArticlePage, error) {
	if page < 1 || limit < 1 || limit > 100 || page > (int(^uint(0)>>1)/limit) {
		return content.PublicArticlePage{}, fmt.Errorf("invalid public article pagination")
	}
	rows, err := r.db.Query(ctx, publicLessonPrefix+`l.id::text,l.title,l.description,l.path_id::text,l.subject_id::text,l.lesson_type,l.approved_at`+publicLessonFrom+`
 AND (l.lesson_type='text' OR btrim(l.content_text)<>'')
 ORDER BY l.approved_at DESC NULLS LAST,l.updated_at DESC,l.id DESC LIMIT $1 OFFSET $2`, limit+1, (page-1)*limit)
	if err != nil {
		return content.PublicArticlePage{}, err
	}
	defer rows.Close()
	out := content.PublicArticlePage{Items: []content.PublicArticle{}, Page: page, Limit: limit}
	for rows.Next() {
		var row content.PublicArticle
		if err = rows.Scan(&row.ID, &row.Title, &row.Description, &row.PathID, &row.SubjectID, &row.Type, &row.ApprovedAt); err != nil {
			return content.PublicArticlePage{}, err
		}
		out.Items = append(out.Items, row)
	}
	if err = rows.Err(); err != nil {
		return content.PublicArticlePage{}, err
	}
	out.HasMore = len(out.Items) > limit
	if out.HasMore {
		out.Items = out.Items[:limit]
	}
	return out, nil
}
