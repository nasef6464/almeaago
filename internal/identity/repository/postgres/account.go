package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/nasef6464/almeaago/internal/identity/domain"
)

func (r *Repository) UpdateSelfProfile(
	ctx context.Context,
	userID string,
	input domain.SelfProfileUpdate,
) (domain.User, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return domain.User{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var exists string
	if err := tx.QueryRow(ctx,
		"SELECT id::text FROM users WHERE id = $1 FOR UPDATE",
		userID,
	).Scan(&exists); errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, domain.ErrNotFound
	} else if err != nil {
		return domain.User{}, err
	}

	changed := make([]string, 0, 2)
	if input.Name != nil {
		if _, err := tx.Exec(ctx,
			"UPDATE users SET name = $2, updated_at = now() WHERE id = $1",
			userID,
			*input.Name,
		); err != nil {
			return domain.User{}, err
		}
		changed = append(changed, "name")
	}
	if input.AvatarURL != nil {
		if _, err := tx.Exec(ctx,
			"UPDATE users SET avatar_url = $2, updated_at = now() WHERE id = $1",
			userID,
			*input.AvatarURL,
		); err != nil {
			return domain.User{}, err
		}
		changed = append(changed, "avatar")
	}

	if err := insertAudit(
		ctx,
		tx,
		userID,
		"auth.me.profile.update",
		"user",
		userID,
		"success",
		map[string]any{"changedKeys": changed},
	); err != nil {
		return domain.User{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.User{}, err
	}
	return r.UserByID(ctx, userID)
}

func (r *Repository) UpdateSelfIdentity(
	ctx context.Context,
	userID string,
	input domain.SelfIdentityUpdate,
) (domain.User, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return domain.User{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var email string
	var currentNationalID string
	var currentPhone string
	err = tx.QueryRow(ctx, `
		SELECT
			COALESCE(email, ''),
			COALESCE(national_id, ''),
			COALESCE(phone, '')
		FROM users
		WHERE id = $1
		FOR UPDATE
	`, userID).Scan(&email, &currentNationalID, &currentPhone)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.User{}, err
	}

	var nextNationalID any = nullableText(currentNationalID)
	var nextPhone any = nullableText(currentPhone)

	changed := make([]string, 0, 2)
	if input.NationalIDSet {
		if input.NationalID == nil {
			nextNationalID = nil
		} else {
			nextNationalID = *input.NationalID
		}
		changed = append(changed, "nationalId")
	}
	if input.PhoneSet {
		if input.Phone == nil {
			if email == "" {
				return domain.User{}, domain.ErrConflict
			}
			nextPhone = nil
		} else {
			nextPhone = *input.Phone
		}
		changed = append(changed, "phone")
	}

	_, err = tx.Exec(ctx, `
		UPDATE users
		SET national_id = $2,
		    phone = $3,
		    updated_at = now()
		WHERE id = $1
	`, userID, nextNationalID, nextPhone)
	if err != nil {
		if isUniqueViolation(err) {
			return domain.User{}, domain.ErrConflict
		}
		return domain.User{}, err
	}

	if err := insertAudit(
		ctx,
		tx,
		userID,
		"auth.me.identity.update",
		"user",
		userID,
		"success",
		map[string]any{"changedKeys": changed},
	); err != nil {
		return domain.User{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.User{}, err
	}
	return r.UserByID(ctx, userID)
}

func nullableText(value string) any {
	if value == "" {
		return nil
	}
	return value
}
