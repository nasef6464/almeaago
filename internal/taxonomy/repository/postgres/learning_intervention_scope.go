package postgres

import "context"

// ValidateLearningInterventionSkill is Taxonomy's narrow read boundary for school interventions.
func (r *Repository) ValidateLearningInterventionSkill(ctx context.Context, pathID, subjectID, skillID string) (bool, error) {
	var ok bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM skills k
			JOIN subjects s ON s.id=k.subject_id
			JOIN paths p ON p.id=s.path_id
			WHERE p.id=$1::uuid
			  AND s.id=$2::uuid
			  AND k.id=$3::uuid
			  AND p.status='active'
			  AND s.status='active'
		)
	`, pathID, subjectID, skillID).Scan(&ok)
	return ok, err
}
