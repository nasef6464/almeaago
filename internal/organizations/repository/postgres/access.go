package postgres

import (
	"context"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func (r *Repository) CanAccessSchool(
	ctx context.Context,
	access org.AccessContext,
	schoolID string,
) (bool, error) {
	isAdmin := hasRole(access.ActorRoles, identity.RoleAdmin)
	isSupervisor := hasRole(access.ActorRoles, identity.RoleSupervisor)
	isTeacher := hasRole(access.ActorRoles, identity.RoleTeacher)
	isSchoolAdmin := hasRole(access.ActorRoles, identity.RoleSchoolAdmin)

	var allowed bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM schools s
			WHERE s.id = $1::uuid
			  AND (
				$2::boolean
				OR (
					s.status <> 'archived'
					AND (
						(
							$3::boolean
							AND EXISTS (
								SELECT 1
								FROM school_supervisor_scopes scope
								WHERE scope.school_id = s.id
								  AND scope.supervisor_user_id = $6::uuid
								  AND scope.status = 'active'
							)
						)
						OR (
							$4::boolean
							AND EXISTS (
								SELECT 1
								FROM teaching_assignments ta
								WHERE ta.school_id = s.id
								  AND ta.teacher_id = $6::uuid
								  AND ta.status = 'active'
							)
						)
						OR (
							$5::boolean
							AND EXISTS (
								SELECT 1
								FROM school_memberships sm
								WHERE sm.school_id = s.id
								  AND sm.user_id = $6::uuid
								  AND sm.role = 'school_admin'
								  AND sm.status = 'active'
							)
						)
					)
				)
			  )
		)
	`, schoolID, isAdmin, isSupervisor, isTeacher, isSchoolAdmin, access.ActorUserID).Scan(&allowed)
	return allowed, err
}

func (r *Repository) CanManageSchool(
	ctx context.Context,
	userID string,
	schoolID string,
) (bool, error) {
	var allowed bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM school_supervisor_scopes scope
			JOIN schools s ON s.id = scope.school_id
			WHERE scope.school_id = $1::uuid
			  AND scope.supervisor_user_id = $2::uuid
			  AND scope.scope_type = 'school'
			  AND scope.status = 'active'
			  AND s.status = 'active'
		)
	`, schoolID, userID).Scan(&allowed)
	return allowed, err
}

func (r *Repository) HasSchoolPermission(
	ctx context.Context,
	userID string,
	schoolID string,
	permission string,
) (bool, error) {
	var allowed bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM school_memberships sm
			JOIN school_membership_permissions p
			  ON p.membership_id = sm.id
			JOIN schools s ON s.id = sm.school_id
			WHERE sm.school_id = $1::uuid
			  AND sm.user_id = $2::uuid
			  AND sm.role = 'school_admin'
			  AND sm.status = 'active'
			  AND p.permission = $3
			  AND s.status <> 'archived'
		)
	`, schoolID, userID, permission).Scan(&allowed)
	return allowed, err
}
