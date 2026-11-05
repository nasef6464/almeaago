package postgres

import (
	"context"

	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func (r *Repository) TeacherWorkspace(
	ctx context.Context,
	userID string,
) (org.TeacherWorkspace, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			s.id::text,
			s.name,
			ta.id::text,
			c.id::text,
			c.name,
			COALESCE(ta.subject_id::text, ''),
			(
				SELECT count(DISTINCT cm.user_id)::int
				FROM class_memberships cm
				WHERE cm.class_id = c.id
				  AND cm.status = 'active'
				  AND EXISTS (
					SELECT 1 FROM users student_user
					WHERE student_user.id = cm.user_id
					  AND student_user.status = 'active'
				  )
				  AND EXISTS (
					SELECT 1
					FROM school_memberships sm
					WHERE sm.user_id = cm.user_id
					  AND sm.school_id = s.id
					  AND sm.role = 'student'
					  AND sm.status = 'active'
				  )
			) AS student_count
		FROM teaching_assignments ta
		JOIN schools s
		  ON s.id = ta.school_id
		 AND s.status = 'active'
		JOIN classes c
		  ON c.id = ta.class_id
		 AND c.school_id = ta.school_id
		 AND c.status = 'active'
		WHERE ta.teacher_id = $1::uuid
		  AND ta.status = 'active'
		  AND EXISTS (
			SELECT 1 FROM users teacher_user
			WHERE teacher_user.id = ta.teacher_id
			  AND teacher_user.status = 'active'
		  )
		  AND EXISTS (
			SELECT 1 FROM user_roles teacher_role
			WHERE teacher_role.user_id = ta.teacher_id
			  AND teacher_role.role = 'teacher'
		  )
		  AND EXISTS (
			SELECT 1 FROM school_memberships teacher_membership
			WHERE teacher_membership.school_id = ta.school_id
			  AND teacher_membership.user_id = ta.teacher_id
			  AND teacher_membership.role = 'teacher'
			  AND teacher_membership.status = 'active'
		  )
		ORDER BY s.name, s.id, c.name, c.id, ta.id
	`, userID)
	if err != nil {
		return org.TeacherWorkspace{}, err
	}
	defer rows.Close()

	workspace := org.TeacherWorkspace{Schools: []org.TeacherWorkspaceSchool{}}
	schoolIndex := make(map[string]int)
	for rows.Next() {
		var schoolID, schoolName string
		var assignment org.TeacherWorkspaceAssignment
		if err := rows.Scan(
			&schoolID,
			&schoolName,
			&assignment.AssignmentID,
			&assignment.ClassID,
			&assignment.ClassName,
			&assignment.SubjectID,
			&assignment.StudentCount,
		); err != nil {
			return org.TeacherWorkspace{}, err
		}
		index, ok := schoolIndex[schoolID]
		if !ok {
			index = len(workspace.Schools)
			schoolIndex[schoolID] = index
			workspace.Schools = append(workspace.Schools, org.TeacherWorkspaceSchool{
				SchoolID:    schoolID,
				SchoolName:  schoolName,
				Source:      "membership",
				Assignments: []org.TeacherWorkspaceAssignment{},
			})
		}
		workspace.Schools[index].Assignments = append(workspace.Schools[index].Assignments, assignment)
	}
	if err := rows.Err(); err != nil {
		return org.TeacherWorkspace{}, err
	}
	return workspace, nil
}

func (r *Repository) CanTeachSubject(
	ctx context.Context,
	userID string,
	pathID string,
	subjectID string,
) (bool, error) {
	var ok bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM teaching_assignments ta
			JOIN users u
			  ON u.id=ta.teacher_id
			 AND u.status='active'
			JOIN user_roles ur
			  ON ur.user_id=u.id
			 AND ur.role='teacher'
			JOIN school_memberships sm
			  ON sm.school_id=ta.school_id
			 AND sm.user_id=ta.teacher_id
			 AND sm.role='teacher'
			 AND sm.status='active'
			JOIN schools school
			  ON school.id=ta.school_id
			 AND school.status='active'
			JOIN classes class
			  ON class.id=ta.class_id
			 AND class.school_id=ta.school_id
			 AND class.status='active'
			JOIN subjects subject
			  ON subject.id=ta.subject_id
			 AND subject.status='active'
			JOIN paths path
			  ON path.id=subject.path_id
			 AND path.status='active'
			WHERE ta.teacher_id=$1::uuid
			  AND ta.status='active'
			  AND ta.subject_id=$3::uuid
			  AND subject.path_id=$2::uuid
		)
	`, userID, pathID, subjectID).Scan(&ok)
	return ok, err
}
