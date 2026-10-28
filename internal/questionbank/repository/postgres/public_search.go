package postgres

import (
	"context"
	"fmt"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
	"strings"
	"unicode/utf16"
)

// SearchPublicQuestions is a public current-version title preview, not a learner
// question/answer reader. Preserve platform ownership and live taxonomy boundaries.
// Unlike legacy search, explanations are not matched: their public exposure has
// no domain policy, and a match could disclose a protected explanation by inference.
func (r *Repository) SearchPublicQuestions(ctx context.Context, query string, limit int) ([]question.PublicSearchPreview, error) {
	query = strings.TrimSpace(query)
	if size := len(utf16.Encode([]rune(query))); size < 1 || size > 120 || limit < 1 || limit > 20 {
		return nil, fmt.Errorf("invalid public search query")
	}
	rows, err := r.db.Query(ctx, `WITH RECURSIVE public_paths AS (
 SELECT id FROM paths WHERE parent_path_id IS NULL AND status='active'
 UNION ALL SELECT p.id FROM paths p JOIN public_paths parent ON parent.id=p.parent_path_id WHERE p.status='active'
 )
 SELECT q.id::text,left(qv.text_content,120),COALESCE(qv.difficulty,''),q.path_id::text,q.subject_id::text
 FROM questions q
 JOIN question_versions qv ON qv.question_id=q.id AND qv.version=q.current_version
 JOIN public_paths p ON p.id=q.path_id
 JOIN subjects s ON s.id=q.subject_id AND s.path_id=p.id AND s.status='active'
 LEFT JOIN levels level ON level.id=s.level_id AND level.path_id=p.id
 WHERE q.owner_type='platform' AND q.owner_id IS NULL AND q.workflow_status='approved'
 AND (s.level_id IS NULL OR level.status='active')
 AND qv.text_content ILIKE $1 ESCAPE '\'
 ORDER BY q.updated_at DESC,q.id DESC LIMIT $2`, literalLikePattern(query), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []question.PublicSearchPreview{}
	for rows.Next() {
		var row question.PublicSearchPreview
		if err = rows.Scan(&row.ID, &row.Title, &row.Subtitle, &row.PathID, &row.SubjectID); err != nil {
			return nil, err
		}
		row.Title = publicQuestionTitle(row.Title)
		out = append(out, row)
	}
	return out, rows.Err()
}
func publicQuestionTitle(title string) string {
	units := 0
	var out strings.Builder
	for _, char := range title {
		size := utf16.RuneLen(char)
		if units+size > 120 {
			break
		}
		units += size
		out.WriteRune(char)
	}
	return out.String()
}
