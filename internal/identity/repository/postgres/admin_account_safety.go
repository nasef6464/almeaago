package postgres

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/nasef6464/almeaago/internal/identity/domain"
)

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

	if err := lockAdminInvariant(ctx, tx); err != nil {
		return nil, err
	}

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
				EXISTS (
					SELECT 1
					FROM user_roles ur
					WHERE ur.user_id = u.id
					  AND ur.role = 'admin'
				)
			FROM users u
			WHERE u.id::text = $1
			FOR UPDATE OF u
		`, userID).Scan(&status, &isAdmin)
		if errors.Is(err, pgx.ErrNoRows) {
			results = append(results, domain.AdminBulkStatusResult{
				UserID: userID,
				Status: "not_found",
			})
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
		if _, err := tx.Exec(ctx, `
			UPDATE users
			SET status = $2, updated_at = now()
			WHERE id::text = $1
		`, userID, nextStatus); err != nil {
			return nil, err
		}

		if !active {
			if _, err := tx.Exec(ctx, `
				UPDATE auth_sessions
				SET revoked_at = COALESCE(revoked_at, now())
				WHERE user_id::text = $1
				  AND revoked_at IS NULL
			`, userID); err != nil {
				return nil, err
			}
		}

		results = append(results, domain.AdminBulkStatusResult{
			UserID: userID,
			Status: "updated",
		})
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

	if err := lockAdminInvariant(ctx, tx); err != nil {
		return err
	}

	var status string
	var isAdmin bool
	err = tx.QueryRow(ctx, `
		SELECT
			u.status,
			EXISTS (
				SELECT 1
				FROM user_roles ur
				WHERE ur.user_id = u.id
				  AND ur.role = 'admin'
			)
		FROM users u
		WHERE u.id::text = $1
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

	tag, err := tx.Exec(ctx, "DELETE FROM users WHERE id::text = $1", targetID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}

	return tx.Commit(ctx)
}

func lockAdminInvariant(ctx context.Context, tx pgx.Tx) error {
	_, err := tx.Exec(ctx,
		"SELECT pg_advisory_xact_lock(hashtext('identity_active_admin_invariant'))",
	)
	return err
}

func ensureAnotherActiveAdmin(
	ctx context.Context,
	tx pgx.Tx,
	targetID string,
) error {
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

func lockActiveAdmins(
	ctx context.Context,
	tx pgx.Tx,
) ([]string, error) {
	rows, err := tx.Query(ctx, `
		SELECT u.id::text
		FROM users u
		JOIN user_roles ur
		  ON ur.user_id = u.id
		 AND ur.role = 'admin'
		WHERE u.status = 'active'
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
			actor_user_id,
			action,
			resource_type,
			resource_id,
			status,
			metadata
		)
		SELECT
			u.id,
			$2,
			$3,
			$4,
			$5,
			$6::jsonb
		FROM users u
		WHERE u.id::text = $1
	`, actorID, action, resourceType, resourceID, status, string(raw))
	return err
}
