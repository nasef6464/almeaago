package postgres

import (
	"context"

	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func (r *Repository) ParentAuthorities(
	ctx context.Context,
	parentUserIDs []string,
) (map[string]org.ParentAuthority, error) {
	out := make(map[string]org.ParentAuthority, len(parentUserIDs))
	for _, parentID := range parentUserIDs {
		out[parentID] = org.ParentAuthority{Relationships: []org.ParentStudentRelationship{}}
	}
	if len(parentUserIDs) == 0 {
		return out, nil
	}
	rows, err := r.db.Query(ctx, `
		SELECT
			ps.id::text,
			ps.parent_user_id::text,
			ps.student_user_id::text,
			COALESCE(ps.school_id::text, ''),
			ps.status,
			ps.source
		FROM parent_student_relationships ps
		JOIN users student
		  ON student.id = ps.student_user_id
		 AND student.status = 'active'
		WHERE ps.parent_user_id::text=ANY($1::text[])
		  AND ps.status = 'active'
		  AND EXISTS (
			  SELECT 1
			  FROM user_roles ur
			  WHERE ur.user_id = student.id
			    AND ur.role = 'student'
		  )
		  AND (
			  ps.school_id IS NULL
			  OR EXISTS (
				  SELECT 1
				  FROM schools s
				  WHERE s.id = ps.school_id
				    AND s.status = 'active'
			  )
		  )
		ORDER BY ps.parent_user_id,ps.created_at,ps.id
	`, parentUserIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var relationship org.ParentStudentRelationship
		if err = rows.Scan(
			&relationship.ID,
			&relationship.ParentID,
			&relationship.StudentID,
			&relationship.SchoolID,
			&relationship.Status,
			&relationship.Source,
		); err != nil {
			return nil, err
		}
		authority := out[relationship.ParentID]
		authority.Relationships = append(authority.Relationships, relationship)
		out[relationship.ParentID] = authority
	}
	return out, rows.Err()
}

func (r *Repository) ParentAuthority(ctx context.Context, parentUserID string) (org.ParentAuthority, error) {
	rows, err := r.ParentAuthorities(ctx, []string{parentUserID})
	if err != nil {
		return org.ParentAuthority{}, err
	}
	return rows[parentUserID], nil
}
