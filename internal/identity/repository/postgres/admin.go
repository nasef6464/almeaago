package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/nasef6464/almeaago/internal/identity/domain"
)

const adminInvariantLockKey int64 = 73100421

func (r *Repository) AdminCreateOrUpsertUser(
	ctx context.Context,
	actorUserID string,
	write domain.AdminUserWrite,
) (domain.AdminUserRecord, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return domain.AdminUserRecord{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := lockAdminInvariant(ctx, tx); err != nil {
		return domain.AdminUserRecord{}, err
	}

	var userID string
	err = tx.QueryRow(ctx, `
		SELECT id::text
		FROM users
		WHERE lower(email) = lower($1)
		FOR UPDATE
	`, valueString(write.Email)).Scan(&userID)

	existing := true
	if errors.Is(err, pgx.ErrNoRows) {
		existing = false
		err = tx.QueryRow(ctx, `
			INSERT INTO users (email, name, password_hash, status)
			VALUES ($1, $2, $3, 'active')
			RETURNING id::text
		`, valueString(write.Email), valueString(write.Name), valueString(write.PasswordHash)).Scan(&userID)
		if err != nil {
			if isUniqueViolation(err) {
				return domain.AdminUserRecord{}, domain.ErrConflict
			}
			return domain.AdminUserRecord{}, fmt.Errorf("admin create user: %w", err)
		}
	} else if err != nil {
		return domain.AdminUserRecord{}, err
	}

	if existing {
		currentRoles, err := rolesTx(ctx, tx, userID)
		if err != nil {
			return domain.AdminUserRecord{}, err
		}
		if domain.HasRole(currentRoles, domain.RoleAdmin) &&
			write.Role != nil && *write.Role != domain.RoleAdmin {
			count, err := activeAdminCountTx(ctx, tx)
			if err != nil {
				return domain.AdminUserRecord{}, err
			}
			currentStatus, err := userStatusTx(ctx, tx, userID)
			if err != nil {
				return domain.AdminUserRecord{}, err
			}
			if currentStatus == "active" && count <= 1 {
				return domain.AdminUserRecord{}, domain.ErrInvariant
			}
		}

		_, err = tx.Exec(ctx, `
			UPDATE users
			SET name = $2,
			    email = $3,
			    password_hash = $4,
			    status = 'active',
			    failed_login_attempts = 0,
			    last_failed_login_at = NULL,
			    login_locked_until = NULL,
			    updated_at = now()
			WHERE id::text = $1
		`, userID, valueString(write.Name), valueString(write.Email), valueString(write.PasswordHash))
		if err != nil {
			if isUniqueViolation(err) {
				return domain.AdminUserRecord{}, domain.ErrConflict
			}
			return domain.AdminUserRecord{}, fmt.Errorf("admin update existing user: %w", err)
		}
		if _, err := tx.Exec(ctx, `
			UPDATE auth_sessions
			SET revoked_at = COALESCE(revoked_at, now())
			WHERE user_id::text = $1 AND revoked_at IS NULL
		`, userID); err != nil {
			return domain.AdminUserRecord{}, err
		}
	}

	if write.Role == nil {
		return domain.AdminUserRecord{}, fmt.Errorf("admin create role missing")
	}
	if err := replacePrimaryRoleTx(ctx, tx, userID, *write.Role); err != nil {
		return domain.AdminUserRecord{}, err
	}
	if err := syncAdminScopesTx(ctx, tx, userID, *write.Role, true, write); err != nil {
		return domain.AdminUserRecord{}, err
	}

	if err := auditTx(ctx, tx, actorUserID, "auth.admin_user.upsert", "user", userID, map[string]any{
		"targetEmail": valueString(write.Email),
		"targetRole":  string(*write.Role),
		"existing":    existing,
	}); err != nil {
		return domain.AdminUserRecord{}, err
	}

	record, err := adminRecordTx(ctx, tx, userID)
	if err != nil {
		return domain.AdminUserRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.AdminUserRecord{}, err
	}
	return record, nil
}

func (r *Repository) AdminUpdateUser(
	ctx context.Context,
	actorUserID string,
	targetUserID string,
	write domain.AdminUserWrite,
) (domain.AdminUserRecord, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return domain.AdminUserRecord{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := lockAdminInvariant(ctx, tx); err != nil {
		return domain.AdminUserRecord{}, err
	}

	record, err := adminRecordForUpdateTx(ctx, tx, targetUserID)
	if err != nil {
		return domain.AdminUserRecord{}, err
	}
	currentRole := primaryRole(record.User.Roles)
	nextRole := currentRole
	if write.Role != nil {
		nextRole = *write.Role
	}

	nextActive := record.User.Status == "active"
	if write.Active != nil {
		nextActive = *write.Active
	}

	removesActiveAdmin := domain.HasRole(record.User.Roles, domain.RoleAdmin) &&
		record.User.Status == "active" &&
		(nextRole != domain.RoleAdmin || !nextActive)
	if removesActiveAdmin {
		count, err := activeAdminCountTx(ctx, tx)
		if err != nil {
			return domain.AdminUserRecord{}, err
		}
		if count <= 1 {
			return domain.AdminUserRecord{}, domain.ErrInvariant
		}
	}

	set := make([]string, 0, 4)
	args := []any{targetUserID}
	if write.Name != nil {
		args = append(args, *write.Name)
		set = append(set, fmt.Sprintf("name = $%d", len(args)))
	}
	if write.AvatarURL != nil {
		args = append(args, *write.AvatarURL)
		set = append(set, fmt.Sprintf("avatar_url = $%d", len(args)))
	}
	if write.Active != nil {
		status := "disabled"
		if *write.Active {
			status = "active"
		}
		args = append(args, status)
		set = append(set, fmt.Sprintf("status = $%d", len(args)))
	}

	if len(set) > 0 {
		set = append(set, "updated_at = now()")
		query := "UPDATE users SET " + strings.Join(set, ", ") + " WHERE id::text = $1"
		tag, err := tx.Exec(ctx, query, args...)
		if err != nil {
			return domain.AdminUserRecord{}, err
		}
		if tag.RowsAffected() == 0 {
			return domain.AdminUserRecord{}, domain.ErrNotFound
		}
	}

	roleChanged := write.Role != nil && nextRole != currentRole
	if write.Role != nil {
		if err := replacePrimaryRoleTx(ctx, tx, targetUserID, nextRole); err != nil {
			return domain.AdminUserRecord{}, err
		}
	}
	if err := syncAdminScopesTx(ctx, tx, targetUserID, nextRole, roleChanged, write); err != nil {
		return domain.AdminUserRecord{}, err
	}

	if roleChanged || (write.Active != nil && !*write.Active) {
		if _, err := tx.Exec(ctx, `
			UPDATE auth_sessions
			SET revoked_at = COALESCE(revoked_at, now())
			WHERE user_id::text = $1 AND revoked_at IS NULL
		`, targetUserID); err != nil {
			return domain.AdminUserRecord{}, err
		}
	}

	changed := make([]string, 0, 6)
	if write.Name != nil {
		changed = append(changed, "name")
	}
	if write.AvatarURL != nil {
		changed = append(changed, "avatar")
	}
	if write.Role != nil {
		changed = append(changed, "role")
	}
	if write.Active != nil {
		changed = append(changed, "isActive")
	}
	if write.SchoolID != nil {
		changed = append(changed, "schoolId")
	}
	if write.ClassIDs != nil {
		changed = append(changed, "groupIds")
	}
	if write.LinkedStudentIDs != nil {
		changed = append(changed, "linkedStudentIds")
	}

	if err := auditTx(ctx, tx, actorUserID, "auth.admin_user.update", "user", targetUserID, map[string]any{
		"changedKeys": changed,
		"targetRole":  string(nextRole),
	}); err != nil {
		return domain.AdminUserRecord{}, err
	}

	record, err = adminRecordTx(ctx, tx, targetUserID)
	if err != nil {
		return domain.AdminUserRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.AdminUserRecord{}, err
	}
	return record, nil
}

func (r *Repository) AdminDeleteUser(
	ctx context.Context,
	actorUserID string,
	targetUserID string,
) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := lockAdminInvariant(ctx, tx); err != nil {
		return err
	}

	record, err := adminRecordForUpdateTx(ctx, tx, targetUserID)
	if err != nil {
		return err
	}
	if domain.HasRole(record.User.Roles, domain.RoleAdmin) && record.User.Status == "active" {
		count, err := activeAdminCountTx(ctx, tx)
		if err != nil {
			return err
		}
		if count <= 1 {
			return domain.ErrInvariant
		}
	}

	tag, err := tx.Exec(ctx, `DELETE FROM users WHERE id::text = $1`, targetUserID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}

	if err := auditTx(ctx, tx, actorUserID, "auth.admin_user.delete", "user", targetUserID, map[string]any{
		"targetRole": string(primaryRole(record.User.Roles)),
	}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Repository) AdminBulkStatus(
	ctx context.Context,
	actorUserID string,
	userIDs []string,
	active bool,
) ([]domain.BulkStatusResult, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := lockAdminInvariant(ctx, tx); err != nil {
		return nil, err
	}

	activeAdmins, err := activeAdminCountTx(ctx, tx)
	if err != nil {
		return nil, err
	}
	remainingAdmins := activeAdmins
	results := make([]domain.BulkStatusResult, 0, len(userIDs))

	for _, id := range userIDs {
		record, err := adminRecordForUpdateTx(ctx, tx, id)
		if errors.Is(err, domain.ErrNotFound) {
			results = append(results, domain.BulkStatusResult{UserID: id, Status: "not_found"})
			continue
		}
		if err != nil {
			return nil, err
		}

		if !active && id == actorUserID {
			results = append(results, domain.BulkStatusResult{
				UserID: id,
				Status: "skipped",
				Reason: "cannot_deactivate_current_admin",
			})
			continue
		}

		currentActive := record.User.Status == "active"
		if currentActive == active {
			results = append(results, domain.BulkStatusResult{
				UserID: id,
				Status: "skipped",
				Reason: "already_in_requested_state",
			})
			continue
		}

		if !active && currentActive && domain.HasRole(record.User.Roles, domain.RoleAdmin) {
			if remainingAdmins <= 1 {
				results = append(results, domain.BulkStatusResult{
					UserID: id,
					Status: "skipped",
					Reason: "cannot_deactivate_last_admin",
				})
				continue
			}
			remainingAdmins--
		}

		status := "disabled"
		if active {
			status = "active"
		}
		if _, err := tx.Exec(ctx, `
			UPDATE users
			SET status = $2, updated_at = now()
			WHERE id::text = $1
		`, id, status); err != nil {
			return nil, err
		}
		if !active {
			if _, err := tx.Exec(ctx, `
				UPDATE auth_sessions
				SET revoked_at = COALESCE(revoked_at, now())
				WHERE user_id::text = $1 AND revoked_at IS NULL
			`, id); err != nil {
				return nil, err
			}
		}
		results = append(results, domain.BulkStatusResult{UserID: id, Status: "updated"})
	}

	if err := auditTx(ctx, tx, actorUserID, "auth.admin_user.bulk_status", "user", "bulk", map[string]any{
		"isActive": active,
		"results":  results,
	}); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return results, nil
}

func (r *Repository) AdminListUsers(
	ctx context.Context,
	options domain.AdminUserListOptions,
) (domain.AdminUserPage, error) {
	args := make([]any, 0, 8)
	conditions := []string{"TRUE"}

	if !domain.HasRole(options.ActorRoles, domain.RoleAdmin) {
		args = append(args, options.ActorUserID)
		p := len(args)
		conditions = append(conditions, fmt.Sprintf(`(
			u.id::text = $%d OR
			EXISTS (
				SELECT 1
				FROM school_memberships actor_sm
				JOIN school_memberships target_sm
				  ON target_sm.school_id = actor_sm.school_id
				 AND target_sm.user_id = u.id
				 AND target_sm.status = 'active'
				WHERE actor_sm.user_id::text = $%d
				  AND actor_sm.status = 'active'
			) OR
			EXISTS (
				SELECT 1
				FROM class_memberships actor_cm
				JOIN class_memberships target_cm
				  ON target_cm.class_id = actor_cm.class_id
				 AND target_cm.user_id = u.id
				 AND target_cm.status = 'active'
				WHERE actor_cm.user_id::text = $%d
				  AND actor_cm.status = 'active'
			)
		)`, p, p, p))
	}

	if options.Role != nil {
		args = append(args, string(*options.Role))
		conditions = append(conditions, fmt.Sprintf(
			"EXISTS (SELECT 1 FROM user_roles filter_role WHERE filter_role.user_id = u.id AND filter_role.role = $%d)",
			len(args),
		))
	}
	if options.Active != nil {
		if *options.Active {
			conditions = append(conditions, "u.status = 'active'")
		} else {
			conditions = append(conditions, "u.status <> 'active'")
		}
	}
	if options.Search != "" {
		args = append(args, "%"+strings.ToLower(options.Search)+"%")
		p := len(args)
		conditions = append(conditions, fmt.Sprintf(
			"(lower(u.name) LIKE $%d OR lower(COALESCE(u.email, '')) LIKE $%d)",
			p,
			p,
		))
	}

	where := strings.Join(conditions, " AND ")

	var total int
	if err := r.db.QueryRow(ctx, "SELECT count(*)::int FROM users u WHERE "+where, args...).Scan(&total); err != nil {
		return domain.AdminUserPage{}, err
	}

	args = append(args, options.Limit)
	limitParam := len(args)
	offset := (options.Page - 1) * options.Limit
	args = append(args, offset)
	offsetParam := len(args)

	query := fmt.Sprintf(`
		SELECT
			u.id::text,
			COALESCE(u.email, ''),
			u.name,
			COALESCE(u.password_hash, ''),
			u.status,
			u.avatar_url,
			COALESCE(u.national_id, ''),
			COALESCE(u.phone, ''),
			(u.email_verified_at IS NOT NULL),
			u.failed_login_attempts,
			COALESCE(u.login_locked_until, 'epoch'::timestamptz),
			u.created_at,
			u.updated_at,
			ARRAY(
				SELECT ur.role
				FROM user_roles ur
				WHERE ur.user_id = u.id
				ORDER BY ur.role
			)::text[],
			COALESCE((
				SELECT sm.school_id::text
				FROM school_memberships sm
				WHERE sm.user_id = u.id AND sm.status = 'active'
				ORDER BY sm.updated_at DESC, sm.created_at DESC
				LIMIT 1
			), ''),
			ARRAY(
				SELECT cm.class_id::text
				FROM class_memberships cm
				WHERE cm.user_id = u.id AND cm.status = 'active'
				ORDER BY cm.joined_at DESC
			)::text[],
			ARRAY(
				SELECT ps.student_user_id::text
				FROM parent_student_relationships ps
				WHERE ps.parent_user_id = u.id AND ps.status = 'active'
				ORDER BY ps.created_at DESC
			)::text[]
		FROM users u
		WHERE %s
		ORDER BY u.created_at DESC, u.id DESC
		LIMIT $%d OFFSET $%d
	`, where, limitParam, offsetParam)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return domain.AdminUserPage{}, err
	}
	defer rows.Close()

	records := make([]domain.AdminUserRecord, 0, options.Limit)
	for rows.Next() {
		record, err := scanAdminRecord(rows)
		if err != nil {
			return domain.AdminUserPage{}, err
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return domain.AdminUserPage{}, err
	}

	totalPages := 0
	if total > 0 {
		totalPages = int(math.Ceil(float64(total) / float64(options.Limit)))
	}
	return domain.AdminUserPage{
		Users:      records,
		Page:       options.Page,
		Limit:      options.Limit,
		Total:      total,
		TotalPages: totalPages,
	}, nil
}

func (r *Repository) AdminSummary(ctx context.Context) (domain.AdminSummary, error) {
	var summary domain.AdminSummary
	if err := r.db.QueryRow(ctx, `
		SELECT
			count(*)::int,
			count(*) FILTER (WHERE status <> 'active')::int
		FROM users
	`).Scan(&summary.Total, &summary.Inactive); err != nil {
		return domain.AdminSummary{}, err
	}

	rows, err := r.db.Query(ctx, `
		SELECT role, count(*)::int
		FROM user_roles
		GROUP BY role
	`)
	if err != nil {
		return domain.AdminSummary{}, err
	}
	defer rows.Close()

	summary.ByRole = make(map[domain.Role]int)
	for rows.Next() {
		var role domain.Role
		var count int
		if err := rows.Scan(&role, &count); err != nil {
			return domain.AdminSummary{}, err
		}
		summary.ByRole[role] = count
	}
	if err := rows.Err(); err != nil {
		return domain.AdminSummary{}, err
	}

	// Trainer ownership scopes belong to the Catalog/Content domain and are not
	// duplicated in Identity. This remains zero until that normalized scope is wired.
	summary.PlatformTrainers = 0
	return summary, nil
}

func syncAdminScopesTx(
	ctx context.Context,
	tx pgx.Tx,
	userID string,
	role domain.Role,
	roleChanged bool,
	write domain.AdminUserWrite,
) error {
	if roleChanged {
		if _, err := tx.Exec(ctx, `
			UPDATE school_memberships
			SET status = 'revoked', updated_at = now()
			WHERE user_id::text = $1 AND status = 'active'
		`, userID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			UPDATE class_memberships
			SET status = 'inactive', left_at = COALESCE(left_at, now())
			WHERE user_id::text = $1 AND status = 'active'
		`, userID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			UPDATE parent_student_relationships
			SET status = 'revoked', updated_at = now()
			WHERE parent_user_id::text = $1 AND status = 'active'
		`, userID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			UPDATE teaching_assignments
			SET status = 'revoked', updated_at = now()
			WHERE teacher_id::text = $1 AND status = 'active'
		`, userID); err != nil {
			return err
		}
	}

	if write.SchoolID != nil {
		if _, err := tx.Exec(ctx, `
			UPDATE school_memberships
			SET status = 'revoked', updated_at = now()
			WHERE user_id::text = $1 AND role = $2 AND status = 'active'
		`, userID, string(role)); err != nil {
			return err
		}
		schoolID := strings.TrimSpace(*write.SchoolID)
		if schoolID != "" && role != domain.RoleAdmin {
			tag, err := tx.Exec(ctx, `
				INSERT INTO school_memberships (school_id, user_id, role, status)
				SELECT s.id, u.id, $3, 'active'
				FROM schools s
				JOIN users u ON u.id::text = $1
				WHERE s.id::text = $2
				  AND s.status = 'active'
				ON CONFLICT (school_id, user_id, role)
				DO UPDATE SET status = 'active', updated_at = now()
			`, userID, schoolID, string(role))
			if err != nil {
				return err
			}
			if tag.RowsAffected() == 0 {
				return domain.ErrNotFound
			}
		}
	}

	if write.ClassIDs != nil {
		if _, err := tx.Exec(ctx, `
			UPDATE class_memberships
			SET status = 'inactive', left_at = COALESCE(left_at, now())
			WHERE user_id::text = $1 AND status = 'active'
		`, userID); err != nil {
			return err
		}
		for _, classID := range *write.ClassIDs {
			if _, err := tx.Exec(ctx, `
				INSERT INTO class_memberships (class_id, user_id, status, joined_at, left_at)
				SELECT c.id, u.id, 'active', now(), NULL
				FROM classes c
				JOIN users u ON u.id::text = $1
				WHERE c.id::text = $2
				  AND c.status = 'active'
				ON CONFLICT (class_id, user_id)
				DO UPDATE SET status = 'active', joined_at = now(), left_at = NULL
			`, userID, classID); err != nil {
				return err
			}
		}
	}

	if write.LinkedStudentIDs != nil || roleChanged {
		if _, err := tx.Exec(ctx, `
			UPDATE parent_student_relationships
			SET status = 'revoked', updated_at = now()
			WHERE parent_user_id::text = $1 AND status = 'active'
		`, userID); err != nil {
			return err
		}
		if role == domain.RoleParent && write.LinkedStudentIDs != nil {
			schoolID := ""
			if write.SchoolID != nil {
				schoolID = strings.TrimSpace(*write.SchoolID)
			}
			for _, studentID := range *write.LinkedStudentIDs {
				if _, err := tx.Exec(ctx, `
					INSERT INTO parent_student_relationships (
						parent_user_id, student_user_id, school_id, status, source
					)
					SELECT
						p.id,
						s.id,
						CASE
							WHEN $3 = '' THEN NULL
							ELSE (SELECT id FROM schools WHERE id::text = $3)
						END,
						'active',
						'admin'
					FROM users p
					JOIN users s ON s.id::text = $2
					WHERE p.id::text = $1
					  AND EXISTS (
						SELECT 1 FROM user_roles ur
						WHERE ur.user_id = s.id AND ur.role = 'student'
					  )
				`, userID, studentID, schoolID); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

func replacePrimaryRoleTx(ctx context.Context, tx pgx.Tx, userID string, role domain.Role) error {
	if _, err := tx.Exec(ctx, `DELETE FROM user_roles WHERE user_id::text = $1`, userID); err != nil {
		return err
	}
	tag, err := tx.Exec(ctx, `
		INSERT INTO user_roles (user_id, role)
		SELECT id, $2 FROM users WHERE id::text = $1
	`, userID, string(role))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func adminRecordForUpdateTx(ctx context.Context, tx pgx.Tx, userID string) (domain.AdminUserRecord, error) {
	var found string
	err := tx.QueryRow(ctx, `
		SELECT id::text
		FROM users
		WHERE id::text = $1
		FOR UPDATE
	`, userID).Scan(&found)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.AdminUserRecord{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.AdminUserRecord{}, err
	}
	return adminRecordTx(ctx, tx, found)
}

func adminRecordTx(ctx context.Context, tx pgx.Tx, userID string) (domain.AdminUserRecord, error) {
	row := tx.QueryRow(ctx, `
		SELECT
			u.id::text,
			COALESCE(u.email, ''),
			u.name,
			COALESCE(u.password_hash, ''),
			u.status,
			u.avatar_url,
			COALESCE(u.national_id, ''),
			COALESCE(u.phone, ''),
			(u.email_verified_at IS NOT NULL),
			u.failed_login_attempts,
			COALESCE(u.login_locked_until, 'epoch'::timestamptz),
			u.created_at,
			u.updated_at,
			ARRAY(SELECT ur.role FROM user_roles ur WHERE ur.user_id = u.id ORDER BY ur.role)::text[],
			COALESCE((
				SELECT sm.school_id::text
				FROM school_memberships sm
				WHERE sm.user_id = u.id AND sm.status = 'active'
				ORDER BY sm.updated_at DESC, sm.created_at DESC
				LIMIT 1
			), ''),
			ARRAY(
				SELECT cm.class_id::text
				FROM class_memberships cm
				WHERE cm.user_id = u.id AND cm.status = 'active'
				ORDER BY cm.joined_at DESC
			)::text[],
			ARRAY(
				SELECT ps.student_user_id::text
				FROM parent_student_relationships ps
				WHERE ps.parent_user_id = u.id AND ps.status = 'active'
				ORDER BY ps.created_at DESC
			)::text[]
		FROM users u
		WHERE u.id::text = $1
	`, userID)
	record, err := scanAdminRecord(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.AdminUserRecord{}, domain.ErrNotFound
	}
	return record, err
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanAdminRecord(row rowScanner) (domain.AdminUserRecord, error) {
	var record domain.AdminUserRecord
	var roleStrings []string
	err := row.Scan(
		&record.User.ID,
		&record.User.Email,
		&record.User.Name,
		&record.User.PasswordHash,
		&record.User.Status,
		&record.User.AvatarURL,
		&record.User.NationalID,
		&record.User.Phone,
		&record.User.EmailVerified,
		&record.User.FailedLoginAttempts,
		&record.User.LoginLockedUntil,
		&record.User.CreatedAt,
		&record.User.UpdatedAt,
		&roleStrings,
		&record.SchoolID,
		&record.ClassIDs,
		&record.LinkedStudentIDs,
	)
	if err != nil {
		return domain.AdminUserRecord{}, err
	}
	record.User.Roles = make([]domain.Role, 0, len(roleStrings))
	for _, value := range roleStrings {
		record.User.Roles = append(record.User.Roles, domain.Role(value))
	}
	return record, nil
}

func rolesTx(ctx context.Context, tx pgx.Tx, userID string) ([]domain.Role, error) {
	rows, err := tx.Query(ctx, `
		SELECT role
		FROM user_roles
		WHERE user_id::text = $1
		ORDER BY role
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]domain.Role, 0, 2)
	for rows.Next() {
		var role domain.Role
		if err := rows.Scan(&role); err != nil {
			return nil, err
		}
		result = append(result, role)
	}
	return result, rows.Err()
}

func primaryRole(roles []domain.Role) domain.Role {
	if len(roles) == 0 {
		return domain.RoleStudent
	}
	return roles[0]
}

func userStatusTx(ctx context.Context, tx pgx.Tx, userID string) (string, error) {
	var status string
	err := tx.QueryRow(ctx, `
		SELECT status FROM users WHERE id::text = $1
	`, userID).Scan(&status)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", domain.ErrNotFound
	}
	return status, err
}

func activeAdminCountTx(ctx context.Context, tx pgx.Tx) (int, error) {
	var count int
	err := tx.QueryRow(ctx, `
		SELECT count(*)::int
		FROM users u
		JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'admin'
		WHERE u.status = 'active'
	`).Scan(&count)
	return count, err
}

func lockAdminInvariant(ctx context.Context, tx pgx.Tx) error {
	_, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, adminInvariantLockKey)
	return err
}

func auditTx(
	ctx context.Context,
	tx pgx.Tx,
	actorUserID string,
	action string,
	resourceType string,
	resourceID string,
	metadata any,
) error {
	raw, err := json.Marshal(metadata)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO audit_logs (
			actor_user_id, action, resource_type, resource_id, status, metadata
		)
		SELECT id, $2, $3, $4, 'success', $5::jsonb
		FROM users
		WHERE id::text = $1
	`, actorUserID, action, resourceType, resourceID, string(raw))
	return err
}

func valueString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
