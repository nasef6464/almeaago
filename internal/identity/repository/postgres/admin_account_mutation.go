package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/nasef6464/almeaago/internal/identity/domain"
	orgdomain "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func (r *Repository) AdminUpsertUser(
	ctx context.Context,
	actorID string,
	input domain.AdminUpsertUserInput,
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
	var currentStatus string
	var currentRole domain.Role
	var currentIsAdmin bool
	err = tx.QueryRow(ctx, `
		SELECT
			u.id::text,
			u.status,
			COALESCE((
				SELECT ur.role
				FROM user_roles ur
				WHERE ur.user_id = u.id
				ORDER BY ur.role
				LIMIT 1
			), 'student'),
			EXISTS (
				SELECT 1
				FROM user_roles ur
				WHERE ur.user_id = u.id AND ur.role = 'admin'
			)
		FROM users u
		WHERE lower(u.email) = lower($1)
		FOR UPDATE OF u
	`, input.Email).Scan(&userID, &currentStatus, &currentRole, &currentIsAdmin)

	existing := true
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		existing = false
		currentRole = input.Role
		err = tx.QueryRow(ctx, `
			INSERT INTO users (email, name, password_hash, status)
			VALUES ($1, $2, $3, 'active')
			RETURNING id::text
		`, input.Email, input.Name, input.PasswordHash).Scan(&userID)
		if err != nil {
			if isUniqueViolation(err) {
				return domain.AdminUserRecord{}, domain.ErrConflict
			}
			return domain.AdminUserRecord{}, fmt.Errorf("admin create user: %w", err)
		}
	case err != nil:
		return domain.AdminUserRecord{}, err
	default:
		if currentIsAdmin && currentStatus == "active" && input.Role != domain.RoleAdmin {
			if err := ensureAnotherActiveAdmin(ctx, tx, userID); err != nil {
				return domain.AdminUserRecord{}, err
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
		`, userID, input.Name, input.Email, input.PasswordHash)
		if err != nil {
			if isUniqueViolation(err) {
				return domain.AdminUserRecord{}, domain.ErrConflict
			}
			return domain.AdminUserRecord{}, fmt.Errorf("admin update existing user: %w", err)
		}

		if _, err := tx.Exec(ctx, `
			UPDATE auth_sessions
			SET revoked_at = COALESCE(revoked_at, now())
			WHERE user_id::text = $1
			  AND revoked_at IS NULL
		`, userID); err != nil {
			return domain.AdminUserRecord{}, err
		}
	}

	roleChanged := existing && currentRole != input.Role
	if err := replaceAdminRoleTx(ctx, tx, userID, input.Role); err != nil {
		return domain.AdminUserRecord{}, err
	}

	schoolID := input.SchoolID
	classIDs := append([]string(nil), input.ClassIDs...)
	linkedStudentIDs := append([]string(nil), input.LinkedStudentIDs...)
	if err := r.syncOrganizationScopesTx(ctx, tx, orgdomain.AdminAccountScopeCommand{
		UserID:           userID,
		Role:             input.Role,
		RoleChanged:      roleChanged,
		SchoolID:         &schoolID,
		ClassIDs:         &classIDs,
		LinkedStudentIDs: &linkedStudentIDs,
	}); err != nil {
		if errors.Is(err, orgdomain.ErrScopeNotFound) {
			return domain.AdminUserRecord{}, domain.ErrNotFound
		}
		return domain.AdminUserRecord{}, err
	}

	pathIDs := append([]string(nil), input.ManagedPathIDs...)
	subjectIDs := append([]string(nil), input.ManagedSubjectIDs...)
	if err := r.syncContentScopesTx(ctx, tx, domain.AdminTrainerScopeCommand{
		ActorUserID: actorID,
		UserID:      userID,
		IsTrainer:   input.Role == domain.RoleTeacher,
		RoleChanged: roleChanged,
		PathIDs:     &pathIDs,
		SubjectIDs:  &subjectIDs,
	}); err != nil {
		return domain.AdminUserRecord{}, err
	}

	if err := insertAudit(ctx, tx, actorID, "auth.admin_user.upsert", "user", userID, "success", map[string]any{
		"targetEmail": input.Email,
		"targetRole":  input.Role,
		"existing":    existing,
	}); err != nil {
		return domain.AdminUserRecord{}, err
	}

	record, err := r.adminUserRecordTx(ctx, tx, userID)
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
	actorID string,
	targetID string,
	input domain.AdminUpdateUserInput,
) (domain.AdminUserRecord, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return domain.AdminUserRecord{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := lockAdminInvariant(ctx, tx); err != nil {
		return domain.AdminUserRecord{}, err
	}

	var currentStatus string
	var currentRole domain.Role
	var currentIsAdmin bool
	err = tx.QueryRow(ctx, `
		SELECT
			u.status,
			COALESCE((
				SELECT ur.role
				FROM user_roles ur
				WHERE ur.user_id = u.id
				ORDER BY ur.role
				LIMIT 1
			), 'student'),
			EXISTS (
				SELECT 1
				FROM user_roles ur
				WHERE ur.user_id = u.id AND ur.role = 'admin'
			)
		FROM users u
		WHERE u.id::text = $1
		FOR UPDATE OF u
	`, targetID).Scan(&currentStatus, &currentRole, &currentIsAdmin)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.AdminUserRecord{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.AdminUserRecord{}, err
	}

	nextActive := currentStatus == "active"
	if input.Active != nil {
		nextActive = *input.Active
	}
	nextRole := currentRole
	if input.Role != nil {
		nextRole = *input.Role
	}

	if currentIsAdmin && currentStatus == "active" && (!nextActive || nextRole != domain.RoleAdmin) {
		if err := ensureAnotherActiveAdmin(ctx, tx, targetID); err != nil {
			return domain.AdminUserRecord{}, err
		}
	}

	if input.Name != nil {
		if _, err := tx.Exec(ctx,
			"UPDATE users SET name = $2, updated_at = now() WHERE id::text = $1",
			targetID,
			*input.Name,
		); err != nil {
			return domain.AdminUserRecord{}, err
		}
	}
	if input.AvatarURL != nil {
		if _, err := tx.Exec(ctx,
			"UPDATE users SET avatar_url = $2, updated_at = now() WHERE id::text = $1",
			targetID,
			*input.AvatarURL,
		); err != nil {
			return domain.AdminUserRecord{}, err
		}
	}
	if input.Active != nil {
		status := "disabled"
		if *input.Active {
			status = "active"
		}
		if _, err := tx.Exec(ctx,
			"UPDATE users SET status = $2, updated_at = now() WHERE id::text = $1",
			targetID,
			status,
		); err != nil {
			return domain.AdminUserRecord{}, err
		}
	}

	roleChanged := input.Role != nil && nextRole != currentRole
	if input.Role != nil {
		if err := replaceAdminRoleTx(ctx, tx, targetID, nextRole); err != nil {
			return domain.AdminUserRecord{}, err
		}
	}
	if err := r.syncOrganizationScopesTx(ctx, tx, orgdomain.AdminAccountScopeCommand{
		UserID:           targetID,
		Role:             nextRole,
		RoleChanged:      roleChanged,
		SchoolID:         input.SchoolID,
		ClassIDs:         input.ClassIDs,
		LinkedStudentIDs: input.LinkedStudentIDs,
	}); err != nil {
		if errors.Is(err, orgdomain.ErrScopeNotFound) {
			return domain.AdminUserRecord{}, domain.ErrNotFound
		}
		return domain.AdminUserRecord{}, err
	}

	if err := r.syncContentScopesTx(ctx, tx, domain.AdminTrainerScopeCommand{
		ActorUserID: actorID,
		UserID:      targetID,
		IsTrainer:   nextRole == domain.RoleTeacher,
		RoleChanged: roleChanged,
		PathIDs:     input.ManagedPathIDs,
		SubjectIDs:  input.ManagedSubjectIDs,
	}); err != nil {
		return domain.AdminUserRecord{}, err
	}

	if roleChanged || (input.Active != nil && !*input.Active) {
		if _, err := tx.Exec(ctx, `
			UPDATE auth_sessions
			SET revoked_at = COALESCE(revoked_at, now())
			WHERE user_id::text = $1
			  AND revoked_at IS NULL
		`, targetID); err != nil {
			return domain.AdminUserRecord{}, err
		}
	}

	changed := make([]string, 0, 7)
	if input.Name != nil {
		changed = append(changed, "name")
	}
	if input.AvatarURL != nil {
		changed = append(changed, "avatar")
	}
	if input.Role != nil {
		changed = append(changed, "role")
	}
	if input.Active != nil {
		changed = append(changed, "isActive")
	}
	if input.SchoolID != nil {
		changed = append(changed, "schoolId")
	}
	if input.ClassIDs != nil {
		changed = append(changed, "groupIds")
	}
	if input.LinkedStudentIDs != nil {
		changed = append(changed, "linkedStudentIds")
	}
	if input.ManagedPathIDs != nil {
		changed = append(changed, "managedPathIds")
	}
	if input.ManagedSubjectIDs != nil {
		changed = append(changed, "managedSubjectIds")
	}

	if err := insertAudit(ctx, tx, actorID, "auth.admin_user.update", "user", targetID, "success", map[string]any{
		"changedKeys": changed,
		"targetRole":  nextRole,
	}); err != nil {
		return domain.AdminUserRecord{}, err
	}

	record, err := r.adminUserRecordTx(ctx, tx, targetID)
	if err != nil {
		return domain.AdminUserRecord{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.AdminUserRecord{}, err
	}
	return record, nil
}
