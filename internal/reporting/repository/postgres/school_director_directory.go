package postgres

import (
	"context"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

type directorQueryer interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
	QueryRow(context.Context, string, ...any) pgx.Row
}

type SchoolDirectorDirectory struct {
	db directorQueryer
}

func NewSchoolDirectorDirectory(db *pgxpool.Pool) *SchoolDirectorDirectory {
	return &SchoolDirectorDirectory{db: db}
}

func (d *SchoolDirectorDirectory) ListDirectorStudents(
	ctx context.Context,
	schoolID string,
	query org.DirectorStudentQuery,
) (org.DirectorStudentPage, error) {
	args := []any{schoolID}
	where := `
		WHERE sm.school_id = $1::uuid
		  AND sm.role = 'student'
		  AND sm.status IN ('active','suspended')
	`
	if query.Search != "" {
		args = append(args, "%"+strings.ToLower(query.Search)+"%")
		n := strconv.Itoa(len(args))
		where += " AND (lower(u.name) LIKE $" + n + " OR (u.email IS NOT NULL AND lower(u.email) LIKE $" + n + "))"
	}

	var total int
	if err := d.db.QueryRow(ctx, `
		SELECT count(*)::int
		FROM school_memberships sm
		JOIN users u ON u.id = sm.user_id
	`+where, args...).Scan(&total); err != nil {
		return org.DirectorStudentPage{}, err
	}

	limitParam := len(args) + 1
	offsetParam := len(args) + 2
	listArgs := append(append([]any{}, args...), query.Limit, (query.Page-1)*query.Limit)

	rows, err := d.db.Query(ctx, `
		SELECT
			u.id::text,
			u.name,
			COALESCE(u.email, ''),
			COALESCE(u.phone, ''),
			(u.status = 'active'),
			COALESCE(current_class.class_id, ''),
			COALESCE(current_class.class_name, '')
		FROM school_memberships sm
		JOIN users u ON u.id = sm.user_id
		LEFT JOIN LATERAL (
			SELECT c.id::text AS class_id, c.name AS class_name
			FROM class_memberships cm
			JOIN classes c ON c.id = cm.class_id
			WHERE cm.user_id = u.id
			  AND cm.status = 'active'
			  AND c.school_id = sm.school_id
			  AND c.status = 'active'
			ORDER BY cm.joined_at DESC
			LIMIT 1
		) current_class ON true
	`+where+`
		ORDER BY lower(u.name), u.id
		LIMIT $`+strconv.Itoa(limitParam)+`
		OFFSET $`+strconv.Itoa(offsetParam),
		listArgs...,
	)
	if err != nil {
		return org.DirectorStudentPage{}, err
	}
	defer rows.Close()

	students := make([]org.DirectorStudent, 0, query.Limit)
	for rows.Next() {
		var student org.DirectorStudent
		if err := rows.Scan(
			&student.StudentID,
			&student.Name,
			&student.Email,
			&student.Phone,
			&student.Active,
			&student.ClassID,
			&student.ClassName,
		); err != nil {
			return org.DirectorStudentPage{}, err
		}
		students = append(students, student)
	}
	if err := rows.Err(); err != nil {
		return org.DirectorStudentPage{}, err
	}

	return org.DirectorStudentPage{
		Students: students,
		Page:     query.Page,
		Limit:    query.Limit,
		Total:    total,
	}, nil
}

func (d *SchoolDirectorDirectory) DirectorTeachers(
	ctx context.Context,
	schoolID string,
	query ...org.DirectorTeacherQuery,
) (org.DirectorTeacherWorkspace, error) {
	limit := 500
	offset := 0
	assignmentLimit := 1000
	assignmentOffset := 0
	if len(query) > 0 {
		if query[0].Limit > 0 {
			limit = query[0].Limit
			if limit > 1000 {
				limit = 1000
			}
		}
		if query[0].Offset > 0 {
			offset = query[0].Offset
		}
		if query[0].AssignmentLimit > 0 {
			assignmentLimit = query[0].AssignmentLimit
			if assignmentLimit > 2000 {
				assignmentLimit = 2000
			}
		}
		if query[0].AssignmentOffset > 0 {
			assignmentOffset = query[0].AssignmentOffset
		}
	}

	rows, err := d.db.Query(ctx, `
		SELECT
			u.id::text,
			u.name,
			COALESCE(u.email, ''),
			(u.status = 'active')
		FROM school_memberships sm
		JOIN users u ON u.id = sm.user_id
		WHERE sm.school_id = $1::uuid
		  AND sm.role = 'teacher'
		  AND sm.status = 'active'
		ORDER BY lower(u.name), u.id
		LIMIT $2 OFFSET $3
	`, schoolID, limit, offset)
	if err != nil {
		return org.DirectorTeacherWorkspace{}, err
	}
	defer rows.Close()

	teachers := make([]org.DirectorTeacher, 0, 64)
	for rows.Next() {
		var teacher org.DirectorTeacher
		if err := rows.Scan(
			&teacher.TeacherID,
			&teacher.Name,
			&teacher.Email,
			&teacher.Active,
		); err != nil {
			return org.DirectorTeacherWorkspace{}, err
		}
		teachers = append(teachers, teacher)
	}
	if err := rows.Err(); err != nil {
		return org.DirectorTeacherWorkspace{}, err
	}

	assignmentRows, err := d.db.Query(ctx, `
		SELECT
			ta.id::text,
			ta.school_id::text,
			ta.teacher_id::text,
			ta.class_id::text,
			COALESCE(ta.subject_id::text, ''),
			ta.status,
			ta.created_at,
			ta.updated_at
		FROM teaching_assignments ta
		WHERE ta.school_id = $1::uuid
		ORDER BY ta.updated_at DESC, ta.id DESC
		LIMIT $2 OFFSET $3
	`, schoolID, assignmentLimit, assignmentOffset)
	if err != nil {
		return org.DirectorTeacherWorkspace{}, err
	}
	defer assignmentRows.Close()

	assignments := make([]org.TeachingAssignment, 0, 128)
	for assignmentRows.Next() {
		var assignment org.TeachingAssignment
		if err := assignmentRows.Scan(
			&assignment.ID,
			&assignment.SchoolID,
			&assignment.TeacherID,
			&assignment.ClassID,
			&assignment.SubjectID,
			&assignment.Status,
			&assignment.CreatedAt,
			&assignment.UpdatedAt,
		); err != nil {
			return org.DirectorTeacherWorkspace{}, err
		}
		assignments = append(assignments, assignment)
	}
	if err := assignmentRows.Err(); err != nil {
		return org.DirectorTeacherWorkspace{}, err
	}

	var totalTeachers int
	if err := d.db.QueryRow(ctx, `
		SELECT count(*)::int
		FROM school_memberships sm
		WHERE sm.school_id = $1::uuid
		  AND sm.role = 'teacher'
		  AND sm.status = 'active'
	`, schoolID).Scan(&totalTeachers); err != nil {
		return org.DirectorTeacherWorkspace{}, err
	}

	var totalAssignments int
	if err := d.db.QueryRow(ctx, `
		SELECT count(*)::int
		FROM teaching_assignments ta
		WHERE ta.school_id = $1::uuid
	`, schoolID).Scan(&totalAssignments); err != nil {
		return org.DirectorTeacherWorkspace{}, err
	}

	return org.DirectorTeacherWorkspace{
		Teachers:         teachers,
		Assignments:      assignments,
		TotalTeachers:    totalTeachers,
		TotalAssignments: totalAssignments,
	}, nil
}
