package postgres

import (
	"context"
	"errors"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func (r *Repository) ListAssignments(
	ctx context.Context,
	access org.AccessContext,
	schoolID string,
	query org.AssignmentQuery,
) (org.AssignmentPage, error) {
	where, args := buildAssignmentWhere(access, schoolID, query)

	var total int
	if err := r.db.QueryRow(
		ctx,
		"SELECT count(*)::int FROM teaching_assignments ta"+where,
		args...,
	).Scan(&total); err != nil {
		return org.AssignmentPage{}, err
	}

	limitParam := len(args) + 1
	offsetParam := len(args) + 2
	listArgs := append(append([]any{}, args...), query.Limit, (query.Page-1)*query.Limit)
	rows, err := r.db.Query(
		ctx,
		assignmentSelect+where+
			" ORDER BY ta.updated_at DESC, ta.id DESC"+
			" LIMIT $"+strconv.Itoa(limitParam)+
			" OFFSET $"+strconv.Itoa(offsetParam),
		listArgs...,
	)
	if err != nil {
		return org.AssignmentPage{}, err
	}
	defer rows.Close()

	assignments := make([]org.TeachingAssignment, 0, query.Limit)
	for rows.Next() {
		assignment, err := scanAssignment(rows)
		if err != nil {
			return org.AssignmentPage{}, err
		}
		assignments = append(assignments, assignment)
	}
	if err := rows.Err(); err != nil {
		return org.AssignmentPage{}, err
	}

	return org.AssignmentPage{
		Assignments: assignments,
		Page:        query.Page,
		Limit:       query.Limit,
		Total:       total,
	}, nil
}

func buildAssignmentWhere(
	access org.AccessContext,
	schoolID string,
	query org.AssignmentQuery,
) (string, []any) {
	args := []any{schoolID}
	clauses := []string{"ta.school_id = $1::uuid"}

	if hasRole(access.ActorRoles, identity.RoleTeacher) &&
		!hasRole(access.ActorRoles, identity.RoleAdmin) &&
		!hasRole(access.ActorRoles, identity.RoleSchoolAdmin) {
		args = append(args, access.ActorUserID)
		clauses = append(clauses, "ta.teacher_id = $"+strconv.Itoa(len(args))+"::uuid")
	}

	if query.TeacherID != "" {
		args = append(args, query.TeacherID)
		clauses = append(clauses, "ta.teacher_id = $"+strconv.Itoa(len(args))+"::uuid")
	}
	if query.ClassID != "" {
		args = append(args, query.ClassID)
		clauses = append(clauses, "ta.class_id = $"+strconv.Itoa(len(args))+"::uuid")
	}
	if query.SubjectID != nil {
		subjectID := strings.TrimSpace(*query.SubjectID)
		if subjectID == "" {
			clauses = append(clauses, "ta.subject_id IS NULL")
		} else {
			args = append(args, subjectID)
			clauses = append(clauses, "ta.subject_id = $"+strconv.Itoa(len(args))+"::uuid")
		}
	}
	if query.Status != nil {
		args = append(args, string(*query.Status))
		clauses = append(clauses, "ta.status = $"+strconv.Itoa(len(args)))
	}
	return " WHERE " + strings.Join(clauses, " AND "), args
}

func (r *Repository) UpsertAssignment(
	ctx context.Context,
	actorUserID string,
	schoolID string,
	write org.AssignmentWrite,
) (org.TeachingAssignment, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return org.TeachingAssignment{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	const insertSQL = "INSERT INTO teaching_assignments " +
		"(school_id, teacher_id, class_id, subject_id, status) " +
		"SELECT s.id, u.id, c.id, subject.id, $5 " +
		"FROM schools s " +
		"JOIN users u ON u.id = $2::uuid " +
		"JOIN classes c ON c.id = $3::uuid AND c.school_id = s.id " +
		"LEFT JOIN subjects subject ON subject.id = NULLIF($4, '')::uuid " +
		"WHERE s.id = $1::uuid AND s.status <> 'archived' AND c.status = 'active' " +
		"AND ($4 = '' OR subject.id IS NOT NULL) " +
		"AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'teacher') " +
		"AND EXISTS (SELECT 1 FROM school_memberships sm WHERE sm.school_id = s.id " +
		"AND sm.user_id = u.id AND sm.role = 'teacher' AND sm.status = 'active') " +
		"ON CONFLICT DO NOTHING " +
		"RETURNING id::text, school_id::text, teacher_id::text, class_id::text, " +
		"COALESCE(subject_id::text, ''), status, created_at, updated_at"

	assignment, err := scanAssignment(tx.QueryRow(
		ctx,
		insertSQL,
		schoolID,
		write.TeacherID,
		write.ClassID,
		write.SubjectID,
		string(write.Status),
	))
	if errors.Is(err, pgx.ErrNoRows) {
		const updateSQL = "UPDATE teaching_assignments SET status = $5, updated_at = now() " +
			"WHERE school_id = $1::uuid AND teacher_id = $2::uuid AND class_id = $3::uuid " +
			"AND subject_id IS NOT DISTINCT FROM NULLIF($4, '')::uuid " +
			"RETURNING id::text, school_id::text, teacher_id::text, class_id::text, " +
			"COALESCE(subject_id::text, ''), status, created_at, updated_at"
		assignment, err = scanAssignment(tx.QueryRow(
			ctx,
			updateSQL,
			schoolID,
			write.TeacherID,
			write.ClassID,
			write.SubjectID,
			string(write.Status),
		))
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return org.TeachingAssignment{}, org.ErrNotFound
	}
	if err != nil {
		return org.TeachingAssignment{}, err
	}

	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorUserID,
		Action:       "organizations.assignment.upsert",
		ResourceType: "teaching_assignment",
		ResourceID:   assignment.ID,
		Metadata: map[string]any{
			"schoolId":  assignment.SchoolID,
			"teacherId": assignment.TeacherID,
			"classId":   assignment.ClassID,
			"subjectId": assignment.SubjectID,
			"status":    assignment.Status,
		},
	}); err != nil {
		return org.TeachingAssignment{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return org.TeachingAssignment{}, err
	}
	return assignment, nil
}

const assignmentSelect = " SELECT " +
	"ta.id::text, ta.school_id::text, ta.teacher_id::text, ta.class_id::text, " +
	"COALESCE(ta.subject_id::text, ''), ta.status, ta.created_at, ta.updated_at " +
	"FROM teaching_assignments ta"

func scanAssignment(row rowScanner) (org.TeachingAssignment, error) {
	var assignment org.TeachingAssignment
	err := row.Scan(
		&assignment.ID,
		&assignment.SchoolID,
		&assignment.TeacherID,
		&assignment.ClassID,
		&assignment.SubjectID,
		&assignment.Status,
		&assignment.CreatedAt,
		&assignment.UpdatedAt,
	)
	return assignment, err
}
