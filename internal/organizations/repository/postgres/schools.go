package postgres

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func (r *Repository) ListSchools(
	ctx context.Context,
	access org.AccessContext,
	query org.SchoolListQuery,
) (org.SchoolPage, error) {
	where, args := buildSchoolListWhere(access, query)

	var total int
	if err := r.db.QueryRow(
		ctx,
		"SELECT count(*)::int FROM schools s "+where,
		args...,
	).Scan(&total); err != nil {
		return org.SchoolPage{}, err
	}

	limitParam := len(args) + 1
	offsetParam := len(args) + 2
	listArgs := append(append([]any{}, args...), query.Limit, (query.Page-1)*query.Limit)
	rows, err := r.db.Query(ctx, `
		SELECT
			s.id::text,
			s.code,
			s.name,
			s.status,
			s.metadata,
			s.created_at,
			s.updated_at
		FROM schools s
	`+where+`
		ORDER BY s.created_at DESC, s.id DESC
		LIMIT $`+strconv.Itoa(limitParam)+` OFFSET $`+strconv.Itoa(offsetParam),
		listArgs...,
	)
	if err != nil {
		return org.SchoolPage{}, err
	}
	defer rows.Close()

	schools := make([]org.School, 0, query.Limit)
	for rows.Next() {
		school, err := scanSchool(rows)
		if err != nil {
			return org.SchoolPage{}, err
		}
		schools = append(schools, school)
	}
	if err := rows.Err(); err != nil {
		return org.SchoolPage{}, err
	}
	return org.SchoolPage{
		Schools: schools,
		Page:    query.Page,
		Limit:   query.Limit,
		Total:   total,
	}, nil
}

func buildSchoolListWhere(
	access org.AccessContext,
	query org.SchoolListQuery,
) (string, []any) {
	clauses := make([]string, 0, 4)
	args := make([]any, 0, 5)

	switch {
	case hasRole(access.ActorRoles, identity.RoleAdmin):
	case hasRole(access.ActorRoles, identity.RoleSupervisor):
		args = append(args, access.ActorUserID)
		n := strconv.Itoa(len(args))
		clauses = append(clauses, `EXISTS (
			SELECT 1
			FROM school_supervisor_scopes scope
			WHERE scope.school_id = s.id
			  AND scope.supervisor_user_id = $`+n+`::uuid
			  AND scope.status = 'active'
		)`)
	case hasRole(access.ActorRoles, identity.RoleTeacher):
		args = append(args, access.ActorUserID)
		n := strconv.Itoa(len(args))
		clauses = append(clauses, `EXISTS (
			SELECT 1
			FROM teaching_assignments ta
			WHERE ta.school_id = s.id
			  AND ta.teacher_id = $`+n+`::uuid
			  AND ta.status = 'active'
		)`)
	case hasRole(access.ActorRoles, identity.RoleSchoolAdmin):
		args = append(args, access.ActorUserID)
		n := strconv.Itoa(len(args))
		clauses = append(clauses, `EXISTS (
			SELECT 1
			FROM school_memberships sm
			WHERE sm.school_id = s.id
			  AND sm.user_id = $`+n+`::uuid
			  AND sm.role = 'school_admin'
			  AND sm.status = 'active'
		)`)
	default:
		clauses = append(clauses, "FALSE")
	}

	if query.Status != nil {
		args = append(args, string(*query.Status))
		clauses = append(clauses, "s.status = $"+strconv.Itoa(len(args)))
	} else {
		clauses = append(clauses, "s.status <> 'archived'")
	}

	if query.Search != "" {
		args = append(args, "%"+strings.ToLower(query.Search)+"%")
		n := strconv.Itoa(len(args))
		clauses = append(clauses,
			"(lower(s.name) LIKE $"+n+" OR lower(s.code) = lower(trim(both '%' from $"+n+")))",
		)
	}

	if len(clauses) == 0 {
		return "", args
	}
	return "WHERE " + strings.Join(clauses, " AND "), args
}

func (r *Repository) SchoolByID(
	ctx context.Context,
	_ org.AccessContext,
	schoolID string,
) (org.School, error) {
	school, err := scanSchool(r.db.QueryRow(ctx, `
		SELECT
			id::text,
			code,
			name,
			status,
			metadata,
			created_at,
			updated_at
		FROM schools
		WHERE id = $1::uuid
	`, schoolID))
	if errors.Is(err, pgx.ErrNoRows) {
		return org.School{}, org.ErrNotFound
	}
	return school, err
}

func (r *Repository) CreateSchool(
	ctx context.Context,
	actorUserID string,
	write org.SchoolWrite,
) (org.School, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return org.School{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	school, err := scanSchool(tx.QueryRow(ctx, `
		INSERT INTO schools (code, name, status, metadata)
		VALUES ($1, $2, $3, $4::jsonb)
		RETURNING
			id::text,
			code,
			name,
			status,
			metadata,
			created_at,
			updated_at
	`, write.Code, write.Name, string(write.Status), string(write.Metadata)))
	if err != nil {
		if isUniqueViolation(err) {
			return org.School{}, org.ErrConflict
		}
		return org.School{}, err
	}

	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorUserID,
		Action:       "organizations.school.create",
		ResourceType: "school",
		ResourceID:   school.ID,
		Metadata: map[string]any{
			"code": school.Code,
			"name": school.Name,
		},
	}); err != nil {
		return org.School{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return org.School{}, err
	}
	return school, nil
}

func (r *Repository) UpdateSchool(
	ctx context.Context,
	actorUserID string,
	schoolID string,
	patch org.SchoolPatch,
) (org.School, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return org.School{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	set := make([]string, 0, 4)
	args := []any{schoolID}
	changed := make([]string, 0, 3)
	if patch.Name != nil {
		args = append(args, *patch.Name)
		set = append(set, fmt.Sprintf("name = $%d", len(args)))
		changed = append(changed, "name")
	}
	if patch.Status != nil {
		args = append(args, string(*patch.Status))
		set = append(set, fmt.Sprintf("status = $%d", len(args)))
		changed = append(changed, "status")
	}
	if patch.Metadata != nil {
		args = append(args, string(*patch.Metadata))
		set = append(set, fmt.Sprintf("metadata = $%d::jsonb", len(args)))
		changed = append(changed, "metadata")
	}
	set = append(set, "updated_at = now()")

	query := `
		UPDATE schools
		SET ` + strings.Join(set, ", ") + `
		WHERE id = $1::uuid
		RETURNING
			id::text,
			code,
			name,
			status,
			metadata,
			created_at,
			updated_at
	`
	school, err := scanSchool(tx.QueryRow(ctx, query, args...))
	if errors.Is(err, pgx.ErrNoRows) {
		return org.School{}, org.ErrNotFound
	}
	if err != nil {
		return org.School{}, err
	}

	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorUserID,
		Action:       "organizations.school.update",
		ResourceType: "school",
		ResourceID:   school.ID,
		Metadata: map[string]any{
			"changedKeys": changed,
		},
	}); err != nil {
		return org.School{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return org.School{}, err
	}
	return school, nil
}

func (r *Repository) ArchiveSchool(
	ctx context.Context,
	actorUserID string,
	schoolID string,
) (org.School, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return org.School{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	school, err := scanSchool(tx.QueryRow(ctx, `
		UPDATE schools
		SET status = 'archived', updated_at = now()
		WHERE id = $1::uuid
		RETURNING
			id::text,
			code,
			name,
			status,
			metadata,
			created_at,
			updated_at
	`, schoolID))
	if errors.Is(err, pgx.ErrNoRows) {
		return org.School{}, org.ErrNotFound
	}
	if err != nil {
		return org.School{}, err
	}

	statements := []string{
		`UPDATE classes
		  SET status = 'archived', updated_at = now()
		  WHERE school_id = $1::uuid AND status <> 'archived'`,
		`UPDATE school_memberships
		  SET status = 'revoked', updated_at = now()
		  WHERE school_id = $1::uuid AND status = 'active'`,
		`UPDATE class_memberships cm
		  SET status = 'revoked', left_at = COALESCE(left_at, now())
		  WHERE cm.status = 'active'
		    AND EXISTS (
				SELECT 1 FROM classes c
				WHERE c.id = cm.class_id AND c.school_id = $1::uuid
		    )`,
		`UPDATE teaching_assignments
		  SET status = 'revoked', updated_at = now()
		  WHERE school_id = $1::uuid AND status = 'active'`,
		`UPDATE school_supervisor_scopes
		  SET status = 'revoked', updated_at = now()
		  WHERE school_id = $1::uuid AND status = 'active'`,
		`UPDATE parent_student_relationships
		  SET status = 'revoked', updated_at = now()
		  WHERE school_id = $1::uuid AND status = 'active'`,
	}
	for _, statement := range statements {
		if _, err := tx.Exec(ctx, statement, schoolID); err != nil {
			return org.School{}, fmt.Errorf("archive school scope: %w", err)
		}
	}

	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorUserID,
		Action:       "organizations.school.archive",
		ResourceType: "school",
		ResourceID:   school.ID,
		Metadata: map[string]any{
			"code": school.Code,
		},
	}); err != nil {
		return org.School{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return org.School{}, err
	}
	return school, nil
}
