package postgres

import (
	"context"

	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func (r *Repository) SchoolContexts(
	ctx context.Context,
	userID string,
) ([]org.SchoolContext, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			sm.school_id::text,
			s.name,
			sm.role,
			ARRAY(
				SELECT p.permission
				FROM school_membership_permissions p
				WHERE p.membership_id = sm.id
				ORDER BY p.permission
			)::text[]
		FROM school_memberships sm
		JOIN schools s ON s.id = sm.school_id
		WHERE sm.user_id = $1::uuid
		  AND sm.status = 'active'
		  AND s.status <> 'archived'
		ORDER BY s.name, sm.role
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	contexts := make([]org.SchoolContext, 0, 4)
	for rows.Next() {
		var item org.SchoolContext
		if err := rows.Scan(
			&item.SchoolID,
			&item.SchoolName,
			&item.Role,
			&item.Permissions,
		); err != nil {
			return nil, err
		}
		if item.Permissions == nil {
			item.Permissions = []string{}
		}
		item.Source = "membership"
		contexts = append(contexts, item)
	}
	return contexts, rows.Err()
}
