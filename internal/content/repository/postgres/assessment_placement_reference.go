package postgres

import "context"

// Visibility is checked only for learner discovery and new attempts. Authoring
// remains possible while a path or subject is hidden from the site.
func (r *Repository) LearnerAssessmentScopeVisible(ctx context.Context, pathID, subjectID string) (bool, error) {
	return r.learningTaxonomyExists(ctx, pathID, subjectID)
}

// ValidateAssessmentPlacementTarget is Content's bounded read contract for Assessment.
// Assessment owns the placement row; Content owns whether a referenced learning location
// is currently learner-safe and belongs to the requested taxonomy scope.
func (r *Repository) ValidateAssessmentPlacementTarget(
	ctx context.Context,
	slot, pathID, subjectID, courseID, lessonID, topicID string,
) (bool, error) {
	switch slot {
	case "training", "tests":
		var ok bool
		err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM paths p JOIN subjects s ON s.path_id=p.id WHERE p.id=$1::uuid AND s.id=$2::uuid AND p.status='active' AND s.status='active')`, pathID, subjectID).Scan(&ok)
		return ok, err
	case "foundation":
		var ok bool
		err := r.db.QueryRow(ctx, `
			SELECT EXISTS(
				SELECT 1
				FROM foundation_topics t
				WHERE t.id=$3::uuid
				  AND t.path_id=$1::uuid
				  AND t.subject_id=$2::uuid
				  AND t.status='active'
				  AND t.is_visible=true
			)
		`, pathID, subjectID, topicID).Scan(&ok)
		if err != nil {
			return false, mapError(err)
		}
		return ok, nil
	case "course":
		var ok bool
		err := r.db.QueryRow(ctx, `
			SELECT EXISTS(
				SELECT 1
				FROM courses c
				WHERE c.id=$3::uuid
				  AND c.path_id=$1::uuid
				  AND c.subject_id=$2::uuid
				  AND c.workflow_status='approved'
				  AND c.is_published=true
				  AND c.is_visible=true
				  AND (
					$4=''
					OR EXISTS(
						SELECT 1
						FROM course_modules cm
						JOIN course_lessons cl ON cl.module_id=cm.id
						JOIN lessons l ON l.id=cl.lesson_id
						WHERE cm.course_id=c.id
						  AND cm.status='active'
						  AND cl.lesson_id=NULLIF($4,'')::uuid
						  AND l.workflow_status='approved'
						  AND l.is_visible=true
					)
				  )
			)
		`, pathID, subjectID, courseID, lessonID).Scan(&ok)
		if err != nil {
			return false, mapError(err)
		}
		return ok, nil
	default:
		return false, nil
	}
}
