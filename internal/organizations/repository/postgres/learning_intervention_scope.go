package postgres

import "context"

func (r *Repository) CanManageLearningIntervention(ctx context.Context, actorID, schoolID, classID string) (bool, error) {
	var allowed bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM schools s
			WHERE s.id=$2::uuid
			  AND s.status='active'
			  AND (
				EXISTS(
					SELECT 1
					FROM school_memberships sm
					JOIN school_membership_permissions p ON p.membership_id=sm.id
					WHERE sm.school_id=s.id
					  AND sm.user_id=$1::uuid
					  AND sm.role='school_admin'
					  AND sm.status='active'
					  AND p.permission='SCHOOL_INTERVENTIONS_MANAGE'
				)
				OR EXISTS(
					SELECT 1
					FROM school_supervisor_scopes ss
					WHERE ss.school_id=s.id
					  AND ss.supervisor_user_id=$1::uuid
					  AND ss.status='active'
					  AND (
						ss.scope_type='school'
						OR (ss.scope_type='class' AND ss.class_id=$3::uuid)
					  )
				)
			  )
		)
	`, actorID, schoolID, classID).Scan(&allowed)
	return allowed, err
}

func (r *Repository) CanViewLearningInterventions(ctx context.Context, actorID, schoolID, classID string) (bool, error) {
	var allowed bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM schools s
			WHERE s.id=$2::uuid
			  AND s.status<>'archived'
			  AND (
				EXISTS(
					SELECT 1
					FROM school_memberships sm
					JOIN school_membership_permissions p ON p.membership_id=sm.id
					WHERE sm.school_id=s.id
					  AND sm.user_id=$1::uuid
					  AND sm.role='school_admin'
					  AND sm.status='active'
					  AND p.permission IN ('SCHOOL_INTERVENTIONS_VIEW','SCHOOL_INTERVENTIONS_MANAGE')
				)
				OR EXISTS(
					SELECT 1
					FROM school_supervisor_scopes ss
					WHERE ss.school_id=s.id
					  AND ss.supervisor_user_id=$1::uuid
					  AND ss.status='active'
					  AND (
						ss.scope_type='school'
						OR (ss.scope_type='class' AND ss.class_id=$3::uuid)
					  )
				)
			  )
		)
	`, actorID, schoolID, classID).Scan(&allowed)
	return allowed, err
}

func (r *Repository) ValidateLearningInterventionStudent(ctx context.Context, schoolID, classID, studentID string) (bool, error) {
	var ok bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM schools s
			JOIN classes c ON c.school_id=s.id
			JOIN school_memberships sm ON sm.school_id=s.id
			JOIN class_memberships cm ON cm.class_id=c.id AND cm.user_id=sm.user_id
			WHERE s.id=$1::uuid
			  AND s.status='active'
			  AND c.id=$2::uuid
			  AND c.status='active'
			  AND sm.user_id=$3::uuid
			  AND sm.role='student'
			  AND sm.status='active'
			  AND cm.status='active'
		)
	`, schoolID, classID, studentID).Scan(&ok)
	return ok, err
}
