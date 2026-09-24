package postgres

import (
	"context"
	"fmt"
	"strconv"
	"strings"

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

	users := make([]domain.User, 0, query.Limit)
	for rows.Next() {
		user, err := scanAdminUser(rows)
		if err != nil {
			return domain.AdminUserPage{}, err
		}
		users = append(users, user)
	}
	if err := rows.Err(); err != nil {
		return domain.AdminUserPage{}, err
	}

	return domain.AdminUserPage{
		Users: users,
		Page:  query.Page,
		Limit: query.Limit,
		Total: total,
	}, nil
}

func buildAdminUserWhere(query domain.AdminUserQuery) (string, []any) {
	clauses := make([]string, 0, 3)
	args := make([]any, 0, 3)

	if query.Search != "" {
		args = append(args, strings.ToLower(query.Search))
		n := strconv.Itoa(len(args))
		clauses = append(clauses,
			"(lower(u.name) LIKE '%' || $"+n+" || '%' OR lower(COALESCE(u.email,'')) LIKE '%' || $"+n+" || '%')",
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
		args = append(args, *query.Active)
		n := strconv.Itoa(len(args))
		clauses = append(clauses,
			"(CASE WHEN $"+n+"::boolean THEN u.status = 'active' ELSE u.status = 'disabled' END)",
		)
	}

	if len(clauses) == 0 {
		return "", args
	}
	return "WHERE " + strings.Join(clauses, " AND "), args
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanAdminUser(row rowScanner) (domain.User, error) {
	var user domain.User
	var roleStrings []string
	err := row.Scan(
		&user.ID,
		&user.Email,
		&user.Name,
		&user.PasswordHash,
		&user.Status,
		&user.AvatarURL,
		&user.NationalID,
		&user.Phone,
		&user.EmailVerified,
		&user.FailedLoginAttempts,
		&user.LoginLockedUntil,
		&user.CreatedAt,
		&user.UpdatedAt,
		&roleStrings,
	)
	if err != nil {
		return domain.User{}, err
	}

	user.Roles = make([]domain.Role, 0, len(roleStrings))
	for _, value := range roleStrings {
		user.Roles = append(user.Roles, domain.Role(value))
	}
	return user, nil
}

func (r *Repository) AdminSummary(ctx context.Context) (domain.AdminUserSummary, error) {
	var summary domain.AdminUserSummary
	err := r.db.QueryRow(ctx, `
		SELECT
			count(*)::int,
			count(*) FILTER (WHERE status = 'disabled')::int
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
	return summary, rows.Err()
}
