package postgres

import (
	"context"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

func roleStrings(roles []identity.Role) []string {
	out := make([]string, 0, len(roles))
	for _, role := range roles {
		out = append(out, string(role))
	}
	return out
}

func (r *Repository) CountNotificationAudience(
	ctx context.Context,
	userIDs []string,
	roles []identity.Role,
) (int, error) {
	var count int
	err := r.db.QueryRow(ctx, `
		SELECT count(*)::int
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
	`, userIDs, roleStrings(roles)).Scan(&count)
	return count, err
}

func (r *Repository) ResolveNotificationAudiencePage(
	ctx context.Context,
	userIDs []string,
	roles []identity.Role,
	afterID string,
	limit int,
) ([]identity.NotificationRecipient, error) {
	if limit < 1 {
		limit = 1
	}
	if limit > 500 {
		limit = 500
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
		  AND ($3='' OR u.id > $3::uuid)
		ORDER BY u.id
		LIMIT $4
	`, userIDs, roleStrings(roles), afterID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]identity.NotificationRecipient, 0, limit)
	for rows.Next() {
		var item identity.NotificationRecipient
		var rolesRaw []string
		if err = rows.Scan(&item.ID, &item.Name, &item.Email, &item.Phone, &rolesRaw); err != nil {
			return nil, err
		}
		item.Roles = make([]identity.Role, 0, len(rolesRaw))
		for _, role := range rolesRaw {
			item.Roles = append(item.Roles, identity.Role(role))
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *Repository) ResolveNotificationAudience(
	ctx context.Context,
	userIDs []string,
	roles []identity.Role,
	limit int,
) ([]identity.NotificationRecipient, error) {
	return r.ResolveNotificationAudiencePage(ctx, userIDs, roles, "", limit)
}
