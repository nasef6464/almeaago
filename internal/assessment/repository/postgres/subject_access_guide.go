package postgres

import (
	"context"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

// Group policies instead of paginating or issuing one access lookup per card.
func (r *Repository) ListSubjectGuidePlacementGroups(ctx context.Context, pathID, subjectID string) ([]assessment.GuidePlacementGroup, error) {
	rows, err := r.db.Query(ctx, `
	 SELECT DISTINCT p.slot,p.access_type,v.access_type,v.assessment_kind
	 FROM assessment_learning_placements p
	 JOIN assessments a ON a.id=p.assessment_id
	 JOIN assessment_versions v ON v.assessment_id=p.assessment_id AND v.version=p.assessment_version
	 WHERE p.path_id=$1::uuid AND p.subject_id=$2::uuid AND p.slot IN ('training','tests')
	 AND p.is_visible=true AND a.workflow_status='approved' AND a.is_published=true AND a.is_visible=true
	`, pathID, subjectID)
	if err != nil {
		return nil, mapError(err)
	}
	defer rows.Close()
	result := []assessment.GuidePlacementGroup{}
	for rows.Next() {
		var g assessment.GuidePlacementGroup
		if err := rows.Scan(&g.Slot, &g.PlacementAccess, &g.BaseAccess, &g.Kind); err != nil {
			return nil, err
		}
		result = append(result, g)
	}
	return result, rows.Err()
}
