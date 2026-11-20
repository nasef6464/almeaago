package postgres

import (
	"context"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

// Direct access may use a public learning placement only for the exact
// published version. Hidden, older and context-specific placements still
// count as placements, but cannot grant unrestricted direct access.
func (r *Repository) DirectPlacementAccessContexts(ctx context.Context, assessmentID string) (bool, []assessment.AccessContext, error) {
	var hasPlacements bool
	if err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM assessment_learning_placements WHERE assessment_id=$1::uuid)`, assessmentID).Scan(&hasPlacements); err != nil {
		return false, nil, err
	}
	if !hasPlacements {
		return false, nil, nil
	}
	rows, err := r.db.Query(ctx, `
WITH RECURSIVE visible_paths AS (
 SELECT id FROM paths WHERE parent_path_id IS NULL AND status='active' AND COALESCE(presentation->>'isVisible','true') <> 'false'
 UNION ALL SELECT p.id FROM paths p JOIN visible_paths parent ON parent.id=p.parent_path_id
 WHERE p.status='active' AND COALESCE(p.presentation->>'isVisible','true') <> 'false'
)
SELECT a.id::text,v.assessment_kind,v.access_type,p.id::text,p.slot,p.access_type,
       p.path_id::text,COALESCE(p.subject_id::text,''),COALESCE(p.course_id::text,'')
FROM assessment_learning_placements p
JOIN assessments a ON a.id=p.assessment_id AND a.published_version=p.assessment_version
JOIN assessment_versions v ON v.assessment_id=p.assessment_id AND v.version=p.assessment_version
JOIN visible_paths path ON path.id=p.path_id
LEFT JOIN subjects s ON s.id=p.subject_id AND s.path_id=p.path_id
LEFT JOIN levels l ON l.id=s.level_id AND l.path_id=p.path_id
WHERE p.assessment_id=$1::uuid AND p.is_visible AND p.slot IN ('training','tests')
  AND a.workflow_status='approved' AND a.is_published AND a.is_visible
  AND (p.subject_id IS NULL OR (s.status='active' AND COALESCE(s.presentation->>'isVisible','true') <> 'false'
       AND (s.level_id IS NULL OR (l.status='active' AND COALESCE(l.presentation->>'isVisible','true') <> 'false'))))
ORDER BY p.sort_order,p.id`, assessmentID)
	if err != nil {
		return true, nil, err
	}
	defer rows.Close()
	var scopes []assessment.AccessContext
	for rows.Next() {
		var scope assessment.AccessContext
		if err = rows.Scan(&scope.AssessmentID, &scope.AssessmentKind, &scope.BaseAccess, &scope.PlacementID, &scope.PlacementSlot, &scope.PlacementAccess, &scope.PathID, &scope.SubjectID, &scope.CourseID); err != nil {
			return true, nil, err
		}
		scopes = append(scopes, scope)
	}
	return true, scopes, rows.Err()
}
