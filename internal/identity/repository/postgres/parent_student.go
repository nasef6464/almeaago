package postgres

import (
	"context"

	"github.com/nasef6464/almeaago/internal/identity/domain"
)

func (r *Repository) ParentStudentProfiles(ctx context.Context, studentIDs []string) ([]domain.ParentStudentProfile, error) {
	if len(studentIDs) == 0 {
		return []domain.ParentStudentProfile{}, nil
	}
	rows, err := r.db.Query(ctx, `
		SELECT u.id::text,u.name,COALESCE(u.avatar_url,'')
		FROM users u
		WHERE u.id::text=ANY($1::text[])
		  AND u.status='active'
		  AND EXISTS(
		    SELECT 1 FROM user_roles ur
		    WHERE ur.user_id=u.id AND ur.role='student'
		  )
		ORDER BY u.id
	`, studentIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]domain.ParentStudentProfile, 0, len(studentIDs))
	for rows.Next() {
		var row domain.ParentStudentProfile
		if err = rows.Scan(&row.ID, &row.Name, &row.AvatarURL); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}
