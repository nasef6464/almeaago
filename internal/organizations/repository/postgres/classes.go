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

func (r *Repository) ListClasses(
	ctx context.Context,
	access org.AccessContext,
	schoolID string,
	query org.ClassListQuery,
) (org.ClassPage, error) {
	where, args := buildClassListWhere(access, schoolID, query)

	var total int
	if err := r.db.QueryRow(
		ctx,
		"SELECT count(*)::int FROM classes c "+where,
		args...,
	).Scan(&total); err != nil {
		return org.ClassPage{}, err
	}

	limitParam := len(args) + 1
	offsetParam := len(args) + 2
	listArgs := append(append([]any{}, args...), query.Limit, (query.Page-1)*query.Limit)
	rows, err := r.db.Query(ctx, `
		SELECT
			c.id::text,
			c.school_id::text,
			c.code,
			c.name,
			c.status,
			c.metadata,
			c.created_at,
			c.updated_at
		FROM classes c
	`+where+`
		ORDER BY c.created_at DESC, c.id DESC
		LIMIT $`+strconv.Itoa(limitParam)+` OFFSET $`+strconv.Itoa(offsetParam),
		listArgs...,
	)
	if err != nil {
		return org.ClassPage{}, err
	}
	defer rows.Close()

	classes := make([]org.Class, 0, query.Limit)
	for rows.Next() {
		class, err := scanClass(rows)
		if err != nil {
			return org.ClassPage{}, err
		}
		classes = append(classes, class)
	}
	if err := rows.Err(); err != nil {
		return org.ClassPage{}, err
	}

	return org.ClassPage{
		Classes: classes,
		Page:    query.Page,
		Limit:   query.Limit,
		Total:   total,
	}, nil
}

func buildClassListWhere(
	access org.AccessContext,
	schoolID string,
	query org.ClassListQuery,
) (string, []any) {
	args := []any{schoolID}
	clauses := []string{"c.school_id = $1::uuid"}

	switch {
	case hasRole(access.ActorRoles, identity.RoleAdmin):
	case hasRole(access.ActorRoles, identity.RoleSupervisor):
		args = append(args, access.ActorUserID)
		n := strconv.Itoa(len(args))
		clauses = append(clauses, `(
			EXISTS (
				SELECT 1
				FROM school_supervisor_scopes school_scope
				WHERE school_scope.school_id = c.school_id
				  AND school_scope.supervisor_user_id = $`+n+`::uuid
				  AND school_scope.scope_type = 'school'
				  AND school_scope.status = 'active'
			)
			OR EXISTS (
				SELECT 1
				FROM school_supervisor_scopes class_scope
				WHERE class_scope.school_id = c.school_id
				  AND class_scope.class_id = c.id
				  AND class_scope.supervisor_user_id = $`+n+`::uuid
				  AND class_scope.scope_type = 'class'
				  AND class_scope.status = 'active'
			)
		)`)
	case hasRole(access.ActorRoles, identity.RoleTeacher):
		args = append(args, access.ActorUserID)
		n := strconv.Itoa(len(args))
		clauses = append(clauses, `EXISTS (
			SELECT 1
			FROM teaching_assignments ta
			WHERE ta.class_id = c.id
			  AND ta.school_id = c.school_id
			  AND ta.teacher_id = $`+n+`::uuid
			  AND ta.status = 'active'
		)`)
	case hasRole(access.ActorRoles, identity.RoleSchoolAdmin):
		args = append(args, access.ActorUserID)
		n := strconv.Itoa(len(args))
		clauses = append(clauses, `EXISTS (
			SELECT 1
			FROM school_memberships sm
			WHERE sm.school_id = c.school_id
			  AND sm.user_id = $`+n+`::uuid
			  AND sm.role = 'school_admin'
			  AND sm.status = 'active'
		)`)
	default:
		clauses = append(clauses, "FALSE")
	}

	if query.Status != nil {
		args = append(args, string(*query.Status))
		clauses = append(clauses, "c.status = $"+strconv.Itoa(len(args)))
	} else {
		clauses = append(clauses, "c.status <> 'archived'")
	}

	if query.Search != "" {
		args = append(args, "%"+strings.ToLower(query.Search)+"%")
		n := strconv.Itoa(len(args))
		clauses = append(clauses,
			"(lower(c.name) LIKE $"+n+" OR lower(c.code) = lower(trim(both '%' from $"+n+")))",
		)
	}

	return "WHERE " + strings.Join(clauses, " AND "), args
}

func (r *Repository) CreateClass(
	ctx context.Context,
	actorUserID string,
	schoolID string,
	write org.ClassWrite,
) (org.Class, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return org.Class{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	class, err := scanClass(tx.QueryRow(ctx, `
		INSERT INTO classes (
			school_id,
			code,
			name,
			status,
			metadata
		)
		SELECT
			s.id,
			$2,
			$3,
			$4,
			$5::jsonb
		FROM schools s
		WHERE s.id = $1::uuid
		  AND s.status = 'active'
		RETURNING
			id::text,
			school_id::text,
			code,
			name,
			status,
			metadata,
			created_at,
			updated_at
	`, schoolID, write.Code, write.Name, string(write.Status), string(write.Metadata)))
	if errors.Is(err, pgx.ErrNoRows) {
		return org.Class{}, org.ErrNotFound
	}
	if err != nil {
		if isUniqueViolation(err) {
			return org.Class{}, org.ErrConflict
		}
		return org.Class{}, err
	}

	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorUserID,
		Action:       "organizations.class.create",
		ResourceType: "class",
		ResourceID:   class.ID,
		Metadata: map[string]any{
			"schoolId": schoolID,
			"code":     class.Code,
			"name":     class.Name,
		},
	}); err != nil {
		return org.Class{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return org.Class{}, err
	}
	return class, nil
}

func (r *Repository) UpdateClass(
	ctx context.Context,
	actorUserID string,
	schoolID string,
	classID string,
	patch org.ClassPatch,
) (org.Class, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return org.Class{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	set := make([]string, 0, 4)
	args := []any{schoolID, classID}
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
		UPDATE classes
		SET ` + strings.Join(set, ", ") + `
		WHERE school_id = $1::uuid
		  AND id = $2::uuid
		RETURNING
			id::text,
			school_id::text,
			code,
			name,
			status,
			metadata,
			created_at,
			updated_at
	`
	class, err := scanClass(tx.QueryRow(ctx, query, args...))
	if errors.Is(err, pgx.ErrNoRows) {
		return org.Class{}, org.ErrNotFound
	}
	if err != nil {
		return org.Class{}, err
	}

	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorUserID,
		Action:       "organizations.class.update",
		ResourceType: "class",
		ResourceID:   class.ID,
		Metadata: map[string]any{
			"schoolId":    schoolID,
			"changedKeys": changed,
		},
	}); err != nil {
		return org.Class{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return org.Class{}, err
	}
	return class, nil
}

func (r *Repository) ArchiveClass(
	ctx context.Context,
	actorUserID string,
	schoolID string,
	classID string,
) (org.Class, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return org.Class{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	class, err := scanClass(tx.QueryRow(ctx, `
		UPDATE classes
		SET status = 'archived', updated_at = now()
		WHERE school_id = $1::uuid
		  AND id = $2::uuid
		RETURNING
			id::text,
			school_id::text,
			code,
			name,
			status,
			metadata,
			created_at,
			updated_at
	`, schoolID, classID))
	if errors.Is(err, pgx.ErrNoRows) {
		return org.Class{}, org.ErrNotFound
	}
	if err != nil {
		return org.Class{}, err
	}

	statements := []string{
		`UPDATE class_memberships
		  SET status = 'revoked', left_at = COALESCE(left_at, now())
		  WHERE class_id = $1::uuid AND status = 'active'`,
		`UPDATE teaching_assignments
		  SET status = 'revoked', updated_at = now()
		  WHERE class_id = $1::uuid AND status = 'active'`,
		`UPDATE school_supervisor_scopes
		  SET status = 'revoked', updated_at = now()
		  WHERE class_id = $1::uuid AND status = 'active'`,
	}
	for _, statement := range statements {
		if _, err := tx.Exec(ctx, statement, classID); err != nil {
			return org.Class{}, fmt.Errorf("archive class scope: %w", err)
		}
	}

	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorUserID,
		Action:       "organizations.class.archive",
		ResourceType: "class",
		ResourceID:   class.ID,
		Metadata: map[string]any{
			"schoolId": schoolID,
			"code":     class.Code,
		},
	}); err != nil {
		return org.Class{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return org.Class{}, err
	}
	return class, nil
}
