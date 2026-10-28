package postgres

import "context"

// PublicCommerceScopeVisible is a read-only catalog visibility port. It checks
// canonical taxonomy structure, never purchase eligibility or entitlements.
// Unlike ValidCommerceScope, all ancestors must remain active. Subject-only
// references resolve through their canonical path; both IDs must match exactly.
// A supplied subject must also have no level, or an active level on that path.
func (r *Repository) PublicCommerceScopeVisible(ctx context.Context, pathID, subjectID string) (bool, error) {
	if pathID == "" && subjectID == "" {
		return false, nil
	}
	var visible bool
	err := r.db.QueryRow(ctx, `
 WITH RECURSIVE visible_paths AS (
  SELECT id FROM paths WHERE status='active' AND parent_path_id IS NULL
  UNION ALL
  SELECT child.id FROM paths child JOIN visible_paths parent ON child.parent_path_id=parent.id WHERE child.status='active'
 )
 SELECT EXISTS(
  SELECT 1 FROM visible_paths p
  WHERE ($1='' OR p.id=NULLIF($1,'')::uuid)
  AND ($2='' OR EXISTS(
   SELECT 1 FROM subjects s LEFT JOIN levels l ON l.id=s.level_id
   WHERE s.id=NULLIF($2,'')::uuid AND s.path_id=p.id AND s.status='active'
   AND (s.level_id IS NULL OR (l.status='active' AND l.path_id=s.path_id))
  ))
 )`, pathID, subjectID).Scan(&visible)
	return visible, err
}
