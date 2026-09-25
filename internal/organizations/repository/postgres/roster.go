package postgres

import (
	"context"
	"strconv"
	"strings"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func (r *Repository) Roster(
	ctx context.Context,
	access org.AccessContext,
	schoolID string,
	query org.RosterQuery,
) (org.RosterPage, error) {
	where, args := buildRosterWhere(access, schoolID, query)

	var total int
	if err := r.db.QueryRow(
		ctx,
		"SELECT count(*)::int FROM users u "+where,
		args...,
	).Scan(&total); err != nil {
		return org.RosterPage{}, err
	}

	limitParam := len(args) + 1
	offsetParam := len(args) + 2
	listArgs := append(append([]any{}, args...), query.Limit, (query.Page-1)*query.Limit)
	rows, err := r.db.Query(ctx, `
		SELECT
			u.id::text,
			u.name,
			COALESCE(u.email, ''),
			u.status,
			ARRAY(
				SELECT DISTINCT sm.role
				FROM school_memberships sm
				WHERE sm.school_id = $1::uuid
				  AND sm.user_id = u.id
				  AND sm.status = 'active'
				ORDER BY sm.role
			)::text[],
			ARRAY(
				SELECT cm.class_id::text
				FROM class_memberships cm
				JOIN classes c ON c.id = cm.class_id
				WHERE cm.user_id = u.id
				  AND cm.status = 'active'
				  AND c.school_id = $1::uuid
				  AND c.status = 'active'
				ORDER BY cm.joined_at DESC
			)::text[]
		FROM users u
	`+where+`
		ORDER BY u.created_at DESC, u.id DESC
		LIMIT $`+strconv.Itoa(limitParam)+` OFFSET $`+strconv.Itoa(offsetParam),
		listArgs...,
	)
	if err != nil {
		return org.RosterPage{}, err
	}
	defer rows.Close()

	members := make([]org.RosterMember, 0, query.Limit)
	for rows.Next() {
		var member org.RosterMember
		var roleStrings []string
		if err := rows.Scan(
			&member.UserID,
			&member.Name,
			&member.Email,
			&member.Status,
			&roleStrings,
			&member.ClassIDs,
		); err != nil {
			return org.RosterPage{}, err
		}
		member.Roles = make([]identity.Role, 0, len(roleStrings))
		for _, role := range roleStrings {
			member.Roles = append(member.Roles, identity.Role(role))
		}
		if member.ClassIDs == nil {
			member.ClassIDs = []string{}
		}
		members = append(members, member)
	}
	if err := rows.Err(); err != nil {
		return org.RosterPage{}, err
	}

	return org.RosterPage{
		Members: members,
		Page:    query.Page,
		Limit:   query.Limit,
		Total:   total,
	}, nil
}

func buildRosterWhere(
	access org.AccessContext,
	schoolID string,
	query org.RosterQuery,
) (string, []any) {
	args := []any{schoolID}
	clauses := []string{`EXISTS (
		SELECT 1
		FROM school_memberships membership
		WHERE membership.school_id = $1::uuid
		  AND membership.user_id = u.id
		  AND membership.status = 'active'
	)`}

	switch {
	case hasRole(access.ActorRoles, identity.RoleAdmin):
	case hasRole(access.ActorRoles, identity.RoleSupervisor):
		args = append(args, access.ActorUserID)
		n := strconv.Itoa(len(args))
		clauses = append(clauses, `(
			EXISTS (
				SELECT 1
				FROM school_supervisor_scopes school_scope
				WHERE school_scope.school_id = $1::uuid
				  AND school_scope.supervisor_user_id = $`+n+`::uuid
				  AND school_scope.scope_type = 'school'
				  AND school_scope.status = 'active'
			)
			OR EXISTS (
				SELECT 1
				FROM class_memberships target_cm
				JOIN classes target_class
				  ON target_class.id = target_cm.class_id
				 AND target_class.school_id = $1::uuid
				 AND target_class.status = 'active'
				JOIN school_supervisor_scopes class_scope
				  ON class_scope.class_id = target_cm.class_id
				 AND class_scope.school_id = target_class.school_id
				 AND class_scope.scope_type = 'class'
				 AND class_scope.status = 'active'
				WHERE target_cm.user_id = u.id
				  AND target_cm.status = 'active'
				  AND class_scope.supervisor_user_id = $`+n+`::uuid
			)
		)`)
	case hasRole(access.ActorRoles, identity.RoleTeacher):
		args = append(args, access.ActorUserID)
		n := strconv.Itoa(len(args))
		clauses = append(clauses, `EXISTS (
			SELECT 1
			FROM class_memberships target_cm
			JOIN classes target_class
			  ON target_class.id = target_cm.class_id
			 AND target_class.school_id = $1::uuid
			 AND target_class.status = 'active'
			JOIN teaching_assignments ta
			  ON ta.class_id = target_cm.class_id
			 AND ta.school_id = target_class.school_id
			 AND ta.status = 'active'
			WHERE target_cm.user_id = u.id
			  AND target_cm.status = 'active'
			  AND ta.teacher_id = $`+n+`::uuid
		)`)
		clauses = append(clauses, `EXISTS (
			SELECT 1
			FROM school_memberships student_membership
			WHERE student_membership.school_id = $1::uuid
			  AND student_membership.user_id = u.id
			  AND student_membership.role = 'student'
			  AND student_membership.status = 'active'
		)`)
	case hasRole(access.ActorRoles, identity.RoleSchoolAdmin):
		args = append(args, access.ActorUserID)
		n := strconv.Itoa(len(args))
		clauses = append(clauses, `EXISTS (
			SELECT 1
			FROM school_memberships director_membership
			WHERE director_membership.school_id = $1::uuid
			  AND director_membership.user_id = $`+n+`::uuid
			  AND director_membership.role = 'school_admin'
			  AND director_membership.status = 'active'
		)`)
		clauses = append(clauses, `EXISTS (
			SELECT 1
			FROM school_memberships student_membership
			WHERE student_membership.school_id = $1::uuid
			  AND student_membership.user_id = u.id
			  AND student_membership.role = 'student'
			  AND student_membership.status = 'active'
		)`)
	default:
		clauses = append(clauses, "FALSE")
	}

	if query.Search != "" {
		args = append(args, "%"+strings.ToLower(query.Search)+"%")
		n := strconv.Itoa(len(args))
		clauses = append(clauses,
			"(lower(u.name) LIKE $"+n+" OR (u.email IS NOT NULL AND lower(u.email) LIKE $"+n+"))",
		)
	}
	if query.Role != nil {
		args = append(args, string(*query.Role))
		n := strconv.Itoa(len(args))
		clauses = append(clauses, `EXISTS (
			SELECT 1
			FROM school_memberships role_membership
			WHERE role_membership.school_id = $1::uuid
			  AND role_membership.user_id = u.id
			  AND role_membership.role = $`+n+`
			  AND role_membership.status = 'active'
		)`)
	}
	if query.ClassID != "" {
		args = append(args, query.ClassID)
		n := strconv.Itoa(len(args))
		clauses = append(clauses, `EXISTS (
			SELECT 1
			FROM class_memberships class_filter
			JOIN classes filter_class ON filter_class.id = class_filter.class_id
			WHERE class_filter.user_id = u.id
			  AND class_filter.class_id = $`+n+`::uuid
			  AND class_filter.status = 'active'
			  AND filter_class.school_id = $1::uuid
			  AND filter_class.status = 'active'
		)`)
	}
	if query.Active != nil {
		if *query.Active {
			clauses = append(clauses, "u.status = 'active'")
		} else {
			clauses = append(clauses, "u.status <> 'active'")
		}
	}

	return "WHERE " + strings.Join(clauses, " AND "), args
}
