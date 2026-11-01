package postgres

import "context"

// PublicCommerceScopeVisible applies the same public path/subject/level
// lifecycle as discovery. Navigation presentation flags and purchase/grant
// eligibility remain separate policies.
func (r *Repository) PublicCommerceScopeVisible(ctx context.Context, pathID, subjectID string) (bool, error) {
	if pathID == "" && subjectID == "" {
		return false, nil
	}
	var visible bool
	err := r.db.QueryRow(ctx, `
		WITH RECURSIVE public_paths AS (
			SELECT id FROM paths WHERE parent_path_id IS NULL AND status='active'
			UNION ALL
			SELECT p.id FROM paths p JOIN public_paths parent ON parent.id=p.parent_path_id
			WHERE p.status='active'
		)
		SELECT EXISTS (
			SELECT 1 FROM public_paths p WHERE p.id::text=$1 AND $2=''
		) OR EXISTS (
			SELECT 1 FROM subjects s
			JOIN public_paths p ON p.id=s.path_id
			LEFT JOIN levels level ON level.id=s.level_id AND level.path_id=p.id
			WHERE s.id::text=$2 AND ($1='' OR p.id::text=$1)
			AND s.status='active'
			AND (s.level_id IS NULL OR level.status='active')
		)
	`, pathID, subjectID).Scan(&visible)
	return visible, err
}
