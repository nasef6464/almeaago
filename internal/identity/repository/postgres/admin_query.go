package postgres

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/nasef6464/almeaago/internal/identity/domain"
)

func (r *Repository) AdminListUsers(
	ctx context.Context,
	query domain.AdminUserQuery,
) (domain.AdminUserPage, error) {
	where, args := buildAdminUserWhere(query)

	countSQL := "SELECT count(*)::int FROM users u " + where
	var total int
	if err := r.db.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return domain.AdminUserPage{}, fmt.Errorf("count admin users: %w", err)
	}

	limitArg := len(args) + 1
	offsetArg := len(args) + 2
	listSQL := `
		SELECT
			u.id::text,
			COALESCE(u.email, ''),
			u.name,
			COALESCE(u.password_hash, ''),
			u.status,
			u.avatar_url,
			COALESCE(u.national_id, ''),
			COALESCE(u.phone, ''),
			(u.email_verified_at IS NOT NULL),
			u.failed_login_attempts,
			COALESCE(u.login_locked_until, 'epoch'::timestamptz),
			u.created_at,
			u.updated_at,
			ARRAY(
				SELECT ur.role
				FROM user_roles ur
				WHERE ur.user_id = u.id
				ORDER BY ur.role
			)::text[],
			COALESCE((
				SELECT sm.school_id::text
				FROM school_memberships sm
				WHERE sm.user_id = u.id
				  AND sm.status = 'active'
				ORDER BY sm.updated_at DESC, sm.created_at DESC
				LIMIT 1
			), ''),
			ARRAY(
				SELECT cm.class_id::text
				FROM class_memberships cm
				WHERE cm.user_id = u.id
				  AND cm.status = 'active'
				ORDER BY cm.joined_at DESC
			)::text[],
			ARRAY(
				SELECT ps.student_user_id::text
				FROM parent_student_relationships ps
				WHERE ps.parent_user_id = u.id
				  AND ps.status = 'active'
				ORDER BY ps.created_at DESC
			)::text[]
		FROM users u
	` + where + `
		ORDER BY u.created_at DESC, u.id DESC
		LIMIT $` + strconv.Itoa(limitArg) + `
		OFFSET $` + strconv.Itoa(offsetArg)

	listArgs := append(append([]any{}, args...), query.Limit, (query.Page-1)*query.Limit)
	rows, err := r.db.Query(ctx, listSQL, listArgs...)
	if err != nil {
		return domain.AdminUserPage{}, fmt.Errorf("list admin users: %w", err)
	}
	defer rows.Close()

	records := make([]domain.AdminUserRecord, 0, query.Limit)
	for rows.Next() {
		record, err := scanAdminRecord(rows)
		if err != nil {
			return domain.AdminUserPage{}, err
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return domain.AdminUserPage{}, err
	}

	return domain.AdminUserPage{
		Users: records,
		Page:  query.Page,
		Limit: query.Limit,
		Total: total,
	}, nil
}

func buildAdminUserWhere(query domain.AdminUserQuery) (string, []any) {
	clauses := make([]string, 0, 5)
	args := make([]any, 0, 5)

	if !hasRole(query.ActorRoles, domain.RoleAdmin) {
		args = append(args, query.ActorUserID)
		n := strconv.Itoa(len(args))
		clauses = append(clauses, `(
			u.id::text = $`+n+` OR
			EXISTS (
				SELECT 1
				FROM school_memberships actor_sm
				JOIN school_memberships target_sm
				  ON target_sm.school_id = actor_sm.school_id
				 AND target_sm.user_id = u.id
				 AND target_sm.status = 'active'
				WHERE actor_sm.user_id::text = $`+n+`
				  AND actor_sm.status = 'active'
			) OR
			EXISTS (
				SELECT 1
				FROM class_memberships actor_cm
				JOIN class_memberships target_cm
				  ON target_cm.class_id = actor_cm.class_id
				 AND target_cm.user_id = u.id
				 AND target_cm.status = 'active'
				WHERE actor_cm.user_id::text = $`+n+`
				  AND actor_cm.status = 'active'
			)
		)`)
	}

	if query.Search != "" {
		args = append(args, "%"+strings.ToLower(query.Search)+"%")
		n := strconv.Itoa(len(args))
		clauses = append(clauses,
			"(lower(u.name) LIKE $"+n+" OR lower(COALESCE(u.email, '')) LIKE $"+n+")",
		)
	}
	if query.Role != nil {
		args = append(args, string(*query.Role))
		n := strconv.Itoa(len(args))
		clauses = append(clauses,
			"EXISTS (SELECT 1 FROM user_roles urf WHERE urf.user_id = u.id AND urf.role = $"+n+")",
		)
	}
	if query.Active != nil {
		if *query.Active {
			clauses = append(clauses, "u.status = 'active'")
		} else {
			clauses = append(clauses, "u.status <> 'active'")
		}
	}

	if len(clauses) == 0 {
		return "", args
	}
	return "WHERE " + strings.Join(clauses, " AND "), args
}

func (r *Repository) AdminSummary(ctx context.Context) (domain.AdminUserSummary, error) {
	var summary domain.AdminUserSummary
	err := r.db.QueryRow(ctx, `
		SELECT
			count(*)::int,
			count(*) FILTER (WHERE status <> 'active')::int
		FROM users
	`).Scan(&summary.Total, &summary.Inactive)
	if err != nil {
		return domain.AdminUserSummary{}, err
	}

	rows, err := r.db.Query(ctx, `
		SELECT role, count(*)::int
		FROM user_roles
		GROUP BY role
	`)
	if err != nil {
		return domain.AdminUserSummary{}, err
	}
	defer rows.Close()

	summary.ByRole = make(map[domain.Role]int)
	for rows.Next() {
		var role domain.Role
		var count int
		if err := rows.Scan(&role, &count); err != nil {
			return domain.AdminUserSummary{}, err
		}
		summary.ByRole[role] = count
	}
	if err := rows.Err(); err != nil {
		return domain.AdminUserSummary{}, err
	}

	// Trainer content ownership is normalized outside Identity and will be
	// connected by the Catalog/Content domain instead of duplicating IDs here.
	summary.PlatformTrainers = 0
	return summary, nil
}

func adminRecordTx(ctx context.Context, tx pgx.Tx, userID string) (domain.AdminUserRecord, error) {
	row := tx.QueryRow(ctx, `
		SELECT
			u.id::text,
			COALESCE(u.email, ''),
			u.name,
			COALESCE(u.password_hash, ''),
			u.status,
			u.avatar_url,
			COALESCE(u.national_id, ''),
			COALESCE(u.phone, ''),
			(u.email_verified_at IS NOT NULL),
			u.failed_login_attempts,
			COALESCE(u.login_locked_until, 'epoch'::timestamptz),
			u.created_at,
			u.updated_at,
			ARRAY(
				SELECT ur.role
				FROM user_roles ur
				WHERE ur.user_id = u.id
				ORDER BY ur.role
			)::text[],
			COALESCE((
				SELECT sm.school_id::text
				FROM school_memberships sm
				WHERE sm.user_id = u.id
				  AND sm.status = 'active'
				ORDER BY sm.updated_at DESC, sm.created_at DESC
				LIMIT 1
			), ''),
			ARRAY(
				SELECT cm.class_id::text
				FROM class_memberships cm
				WHERE cm.user_id = u.id
				  AND cm.status = 'active'
				ORDER BY cm.joined_at DESC
			)::text[],
			ARRAY(
				SELECT ps.student_user_id::text
				FROM parent_student_relationships ps
				WHERE ps.parent_user_id = u.id
				  AND ps.status = 'active'
				ORDER BY ps.created_at DESC
			)::text[]
		FROM users u
		WHERE u.id::text = $1
	`, userID)

	record, err := scanAdminRecord(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.AdminUserRecord{}, domain.ErrNotFound
	}
	return record, err
}

type adminRowScanner interface {
	Scan(dest ...any) error
}

func scanAdminRecord(row adminRowScanner) (domain.AdminUserRecord, error) {
	var record domain.AdminUserRecord
	var roleStrings []string
	err := row.Scan(
		&record.User.ID,
		&record.User.Email,
		&record.User.Name,
		&record.User.PasswordHash,
		&record.User.Status,
		&record.User.AvatarURL,
		&record.User.NationalID,
		&record.User.Phone,
		&record.User.EmailVerified,
		&record.User.FailedLoginAttempts,
		&record.User.LoginLockedUntil,
		&record.User.CreatedAt,
		&record.User.UpdatedAt,
		&roleStrings,
		&record.SchoolID,
		&record.ClassIDs,
		&record.LinkedStudentIDs,
	)
	if err != nil {
		return domain.AdminUserRecord{}, err
	}

	record.User.Roles = make([]domain.Role, 0, len(roleStrings))
	for _, value := range roleStrings {
		record.User.Roles = append(record.User.Roles, domain.Role(value))
	}
	if record.ClassIDs == nil {
		record.ClassIDs = []string{}
	}
	if record.LinkedStudentIDs == nil {
		record.LinkedStudentIDs = []string{}
	}
	return record, nil
}

func hasRole(roles []domain.Role, target domain.Role) bool {
	for _, role := range roles {
		if role == target {
			return true
		}
	}
	return false
}
