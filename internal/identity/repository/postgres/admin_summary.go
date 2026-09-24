package postgres

import (
	"context"

	"github.com/nasef6464/almeaago/internal/identity/domain"
)

func (r *Repository) AdminSummary(ctx context.Context) (domain.AdminUserSummary, error) {
	var summary domain.AdminUserSummary
	if err := r.db.QueryRow(ctx, `
		SELECT
			count(*)::int,
			count(*) FILTER (WHERE status <> 'active')::int
		FROM users
	`).Scan(&summary.Total, &summary.Inactive); err != nil {
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

	summary.PlatformTrainers = 0
	return summary, nil
}
