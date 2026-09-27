package postgres

import (
	"context"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

func (r *Repository) ResolveNotificationAudience(
	ctx context.Context,
	userIDs []string,
	roles []identity.Role,
	limit int,
) ([]identity.NotificationRecipient, error) {
	if limit < 1 {
		limit = 1
	}
	roleValues := make([]string, 0, len(roles))
	for _, role := range roles {
		roleValues = append(roleValues, string(role))
	}
	rows, err := r.db.Query(ctx, `
		SELECT
			u.id::text,
			u.name,
			COALESCE(u.email,''),
			COALESCE(u.phone,''),
			ARRAY(
				SELECT ur_all.role
				FROM user_roles ur_all
				WHERE ur_all.user_id=u.id
				ORDER BY ur_all.role
			)::text[]
		FROM users u
		WHERE u.status='active'
		  AND (
			(cardinality($1::text[]) > 0 AND u.id::text=ANY($1::text[]))
			OR
			(cardinality($2::text[]) > 0 AND EXISTS(
				SELECT 1
				FROM user_roles ur
				WHERE ur.user_id=u.id
				  AND ur.role=ANY($2::text[])
			))
		  )
		ORDER BY u.id
		LIMIT $3
	`, userIDs, roleValues, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]identity.NotificationRecipient, 0, limit)
	for rows.Next() {
		var item identity.NotificationRecipient
		var roleStrings []string
		if err = rows.Scan(&item.ID, &item.Name, &item.Email, &item.Phone, &roleStrings); err != nil {
			return nil, err
		}
		item.Roles = make([]identity.Role, 0, len(roleStrings))
		for _, role := range roleStrings {
			item.Roles = append(item.Roles, identity.Role(role))
		}
		out = append(out, item)
	}
	return out, rows.Err()
}
