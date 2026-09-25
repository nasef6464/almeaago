package postgres

import (
	"context"

	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func (r *Repository) ParentAuthority(ctx context.Context, parentUserID string) (org.ParentAuthority, error) {
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
		WHERE ps.parent_user_id = $1::uuid
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
		ORDER BY ps.created_at, ps.id
	`, parentUserID)
	if err != nil {
		return org.ParentAuthority{}, err
	}
	defer rows.Close()

	authority := org.ParentAuthority{Relationships: []org.ParentStudentRelationship{}}
	for rows.Next() {
		var relationship org.ParentStudentRelationship
		if err := rows.Scan(
			&relationship.ID,
			&relationship.ParentID,
			&relationship.StudentID,
			&relationship.SchoolID,
			&relationship.Status,
			&relationship.Source,
		); err != nil {
			return org.ParentAuthority{}, err
		}
		authority.Relationships = append(authority.Relationships, relationship)
	}
	if err := rows.Err(); err != nil {
		return org.ParentAuthority{}, err
	}
	return authority, nil
}
