package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/nasef6464/almeaago/internal/identity/domain"
)

func (r *Repository) AdminUpsertUser(
	ctx context.Context,
	actorID string,
	input domain.AdminUpsertUserInput,
) (domain.User, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return domain.User{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var userID string
	var currentStatus string
	var currentIsAdmin bool
	err = tx.QueryRow(ctx, `
		SELECT
			u.id::text,
			u.status,
			EXISTS(
				SELECT 1 FROM user_roles ur
				WHERE ur.user_id = u.id AND ur.role = 'admin'
			)
		FROM users u
		WHERE lower(u.email) = lower($1)
		FOR UPDATE OF u
	`, input.Email).Scan(&userID, &currentStatus, &currentIsAdmin)

	switch {
	case errors.Is(err, pgx.ErrNoRows):
		err = tx.QueryRow(ctx, `
			INSERT INTO users (email, name, password_hash, status)
			VALUES ($1, $2, $3, 'active')
			RETURNING id::text
		`, input.Email, input.Name, input.PasswordHash).Scan(&userID)
		if err != nil {
			if isUniqueViolation(err) {
				return domain.User{}, domain.ErrConflict
			}
			return domain.User{}, fmt.Errorf("admin create user: %w", err)
		}
	case err != nil:
		return domain.User{}, err
	default:
		if currentIsAdmin && currentStatus == "active" && input.Role != domain.RoleAdmin {
			if err := ensureAnotherActiveAdmin(ctx, tx, userID); err != nil {
				return domain.User{}, err
			}
		}
		if _, err := tx.Exec(ctx, `
			UPDATE users
			SET name = $2,
			    password_hash = $3,
			    status = 'active',
			    failed_login_attempts = 0,
			    last_failed_login_at = NULL,
			    login_locked_until = NULL,
			    updated_at = now()
			WHERE id = $1
		`, userID, input.Name, input.PasswordHash); err != nil {
			return domain.User{}, fmt.Errorf("admin update existing user: %w", err)
		}
	}

	if _, err := tx.Exec(ctx, "DELETE FROM user_roles WHERE user_id = $1", userID); err != nil {
		return domain.User{}, err
	}
	if _, err := tx.Exec(ctx,
		"INSERT INTO user_roles (user_id, role) VALUES ($1, $2)",
		userID,
		input.Role,
	); err != nil {
		return domain.User{}, err
	}

	if err := insertAudit(ctx, tx, actorID, "auth.admin_user.upsert", "user", userID, "success", map[string]any{
		"targetEmail": input.Email,
		"targetRole":  input.Role,
	}); err != nil {
		return domain.User{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.User{}, err
	}
	return r.UserByID(ctx, userID)
}

func (r *Repository) AdminUpdateUser(
	ctx context.Context,
	actorID string,
	targetID string,
	input domain.AdminUpdateUserInput,
) (domain.User, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return domain.User{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var currentStatus string
	var currentIsAdmin bool
	err = tx.QueryRow(ctx, `
		SELECT
			u.status,
			EXISTS(
				SELECT 1 FROM user_roles ur
				WHERE ur.user_id = u.id AND ur.role = 'admin'
			)
		FROM users u
		WHERE u.id = $1
		FOR UPDATE OF u
	`, targetID).Scan(&currentStatus, &currentIsAdmin)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.User{}, err
	}

	nextActive := currentStatus == "active"
	if input.Active != nil {
		nextActive = *input.Active
	}
	nextAdmin := currentIsAdmin
	if input.Role != nil {
		nextAdmin = *input.Role == domain.RoleAdmin
	}
	if currentIsAdmin && currentStatus == "active" && (!nextActive || !nextAdmin) {
		if err := ensureAnotherActiveAdmin(ctx, tx, targetID); err != nil {
			return domain.User{}, err
		}
	}

	if input.Name != nil {
		if _, err := tx.Exec(ctx,
			"UPDATE users SET name = $2, updated_at = now() WHERE id = $1",
			targetID,
			*input.Name,
		); err != nil {
			return domain.User{}, err
		}
	}
	if input.AvatarURL != nil {
		if _, err := tx.Exec(ctx,
			"UPDATE users SET avatar_url = $2, updated_at = now() WHERE id = $1",
			targetID,
			*input.AvatarURL,
		); err != nil {
			return domain.User{}, err
		}
	}
	if input.Active != nil {
		status := "disabled"
		if *input.Active {
			status = "active"
		}
		if _, err := tx.Exec(ctx,
			"UPDATE users SET status = $2, updated_at = now() WHERE id = $1",
			targetID,
			status,
		); err != nil {
			return domain.User{}, err
		}
		if !*input.Active {
			if _, err := tx.Exec(ctx, `
				UPDATE auth_sessions
				SET revoked_at = COALESCE(revoked_at, now())
				WHERE user_id = $1 AND revoked_at IS NULL
			`, targetID); err != nil {
				return domain.User{}, err
			}
		}
	}
	if input.Role != nil {
		if _, err := tx.Exec(ctx, "DELETE FROM user_roles WHERE user_id = $1", targetID); err != nil {
			return domain.User{}, err
		}
		if _, err := tx.Exec(ctx,
			"INSERT INTO user_roles (user_id, role) VALUES ($1, $2)",
			targetID,
			*input.Role,
		); err != nil {
			return domain.User{}, err
		}
	}

	changed := make([]string, 0, 4)
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
	if err := insertAudit(ctx, tx, actorID, "auth.admin_user.update", "user", targetID, "success", map[string]any{
		"changedKeys": changed,
	}); err != nil {
		return domain.User{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.User{}, err
	}
	return r.UserByID(ctx, targetID)
}

func (r *Repository) AdminBulkStatus(
	ctx context.Context,
	actorID string,
	userIDs []string,
	active bool,
) ([]domain.AdminBulkStatusResult, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	activeAdminIDs, err := lockActiveAdmins(ctx, tx)
	if err != nil {
		return nil, err
	}
	activeAdmins := make(map[string]struct{}, len(activeAdminIDs))
	for _, id := range activeAdminIDs {
		activeAdmins[id] = struct{}{}
	}
	remainingActiveAdmins := len(activeAdminIDs)

	results := make([]domain.AdminBulkStatusResult, 0, len(userIDs))
	for _, userID := range userIDs {
		var status string
		var isAdmin bool
		err := tx.QueryRow(ctx, `
			SELECT
				u.status,
				EXISTS(
					SELECT 1 FROM user_roles ur
					WHERE ur.user_id = u.id AND ur.role = 'admin'
				)
			FROM users u
			WHERE u.id = $1
			FOR UPDATE OF u
		`, userID).Scan(&status, &isAdmin)
		if errors.Is(err, pgx.ErrNoRows) {
			results = append(results, domain.AdminBulkStatusResult{UserID: userID, Status: "not_found"})
			continue
		}
		if err != nil {
			return nil, err
		}

		if !active && userID == actorID {
			results = append(results, domain.AdminBulkStatusResult{
				UserID: userID,
				Status: "skipped",
				Reason: "cannot_deactivate_current_admin",
			})
			continue
		}

		currentActive := status == "active"
		if currentActive == active {
			results = append(results, domain.AdminBulkStatusResult{
				UserID: userID,
				Status: "skipped",
				Reason: "already_in_requested_state",
			})
			continue
		}

		if !active && isAdmin {
			if _, ok := activeAdmins[userID]; ok {
				if remainingActiveAdmins <= 1 {
					results = append(results, domain.AdminBulkStatusResult{
						UserID: userID,
						Status: "skipped",
						Reason: "cannot_deactivate_last_admin",
					})
					continue
				}
				remainingActiveAdmins--
			}
		}

		nextStatus := "disabled"
		if active {
			nextStatus = "active"
		}
		if _, err := tx.Exec(ctx,
			"UPDATE users SET status = $2, updated_at = now() WHERE id = $1",
			userID,
			nextStatus,
		); err != nil {
			return nil, err
		}
		if !active {
			if _, err := tx.Exec(ctx, `
				UPDATE auth_sessions
				SET revoked_at = COALESCE(revoked_at, now())
				WHERE user_id = $1 AND revoked_at IS NULL
			`, userID); err != nil {
				return nil, err
			}
		}

		results = append(results, domain.AdminBulkStatusResult{UserID: userID, Status: "updated"})
	}

	if err := insertAudit(ctx, tx, actorID, "auth.admin_user.bulk_status", "user", "bulk", "success", map[string]any{
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

func (r *Repository) AdminDeleteUser(
	ctx context.Context,
	actorID string,
	targetID string,
) error {
	if actorID == targetID {
		return domain.ErrSelfDelete
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var status string
	var isAdmin bool
	err = tx.QueryRow(ctx, `
		SELECT
			u.status,
			EXISTS(
				SELECT 1 FROM user_roles ur
				WHERE ur.user_id = u.id AND ur.role = 'admin'
			)
		FROM users u
		WHERE u.id = $1
		FOR UPDATE OF u
	`, targetID).Scan(&status, &isAdmin)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrNotFound
	}
	if err != nil {
		return err
	}

	if isAdmin && status == "active" {
		if err := ensureAnotherActiveAdmin(ctx, tx, targetID); err != nil {
			return err
		}
	}

	if err := insertAudit(ctx, tx, actorID, "auth.admin_user.delete", "user", targetID, "success", map[string]any{
		"targetWasAdmin": isAdmin,
	}); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, "DELETE FROM users WHERE id = $1", targetID); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func ensureAnotherActiveAdmin(ctx context.Context, tx pgx.Tx, targetID string) error {
	ids, err := lockActiveAdmins(ctx, tx)
	if err != nil {
		return err
	}
	for _, id := range ids {
		if id != targetID {
			return nil
		}
	}
	return domain.ErrLastAdmin
}

func lockActiveAdmins(ctx context.Context, tx pgx.Tx) ([]string, error) {
	rows, err := tx.Query(ctx, `
		SELECT u.id::text
		FROM users u
		JOIN user_roles ur ON ur.user_id = u.id
		WHERE ur.role = 'admin'
		  AND u.status = 'active'
		ORDER BY u.id
		FOR UPDATE OF u
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ids := make([]string, 0, 4)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func insertAudit(
	ctx context.Context,
	tx pgx.Tx,
	actorID string,
	action string,
	resourceType string,
	resourceID string,
	status string,
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
		VALUES ($1, $2, $3, $4, $5, $6::jsonb)
	`, actorID, action, resourceType, resourceID, status, raw)
	return err
}
