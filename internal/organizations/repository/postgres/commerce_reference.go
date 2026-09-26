package postgres

import "context"

// ActiveSchoolIDsForUser is the Organizations-owned membership projection used by
// Commerce. It intentionally returns IDs only; Commerce does not query membership tables.
func (r *Repository) ActiveSchoolIDsForUser(ctx context.Context, userID string) ([]string, error) {
	rows, err := r.db.Query(ctx, `
SELECT DISTINCT sm.school_id::text
FROM school_memberships sm
JOIN schools s ON s.id=sm.school_id
WHERE sm.user_id=$1::uuid AND sm.status='active' AND s.status='active'
ORDER BY sm.school_id::text
`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]string, 0, 4)
	for rows.Next() {
		var id string
		if err = rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}
