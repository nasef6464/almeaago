package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/nasef6464/almeaago/internal/identity/domain"
	"github.com/nasef6464/almeaago/internal/platform/security"
)

func (r *Repository) UpsertSchoolStudentTx(
	ctx context.Context,
	tx pgx.Tx,
	name string,
	email string,
	password string,
) (domain.SchoolStudentAccount, bool, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	name = strings.TrimSpace(name)

	var account domain.SchoolStudentAccount
	var status string
	err := tx.QueryRow(ctx, \`
		SELECT
			u.id::text,
			u.name,
			COALESCE(u.email, ''),
			COALESCE(u.phone, ''),
			u.status
		FROM users u
		WHERE lower(u.email) = lower($1)
		FOR UPDATE OF u
	\`, email).Scan(
		&account.UserID,
		&account.Name,
		&account.Email,
		&account.Phone,
		&status,
	)
	if err == nil {
		var isStudent bool
		if err := tx.QueryRow(ctx, \`
			SELECT EXISTS (
				SELECT 1
				FROM user_roles ur
				WHERE ur.user_id = $1::uuid
				  AND ur.role = 'student'
			)
		\`, account.UserID).Scan(&isStudent); err != nil {
			return domain.SchoolStudentAccount{}, false, err
		}
		if !isStudent {
			return domain.SchoolStudentAccount{}, false, domain.ErrConflict
		}
		account.Active = status == "active"
		return account, false, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return domain.SchoolStudentAccount{}, false, err
	}

	passwordHash, err := security.HashPassword(password)
	if err != nil {
		return domain.SchoolStudentAccount{}, false, fmt.Errorf("hash school student password: %w", err)
	}

	err = tx.QueryRow(ctx, \`
		INSERT INTO users (email, name, password_hash, status)
		VALUES ($1, $2, $3, 'active')
		RETURNING id::text, name, COALESCE(email, ''), COALESCE(phone, ''), status
	\`, email, name, passwordHash).Scan(
		&account.UserID,
		&account.Name,
		&account.Email,
		&account.Phone,
		&status,
	)
	if err != nil {
		if isUniqueViolation(err) {
			return domain.SchoolStudentAccount{}, false, domain.ErrConflict
		}
		return domain.SchoolStudentAccount{}, false, err
	}

	if _, err := tx.Exec(ctx, \`
		INSERT INTO user_roles (user_id, role)
		VALUES ($1::uuid, 'student')
		ON CONFLICT DO NOTHING
	\`, account.UserID); err != nil {
		return domain.SchoolStudentAccount{}, false, err
	}
	account.Active = true
	return account, true, nil
}

func (r *Repository) UpdateSchoolStudentBasicTx(
	ctx context.Context,
	tx pgx.Tx,
	userID string,
	name *string,
	phone *string,
) (domain.SchoolStudentAccount, error) {
	if name != nil {
		value := strings.TrimSpace(*name)
		if _, err := tx.Exec(ctx, \`
			UPDATE users
			SET name = $2, updated_at = now()
			WHERE id = $1::uuid
			  AND EXISTS (
				SELECT 1 FROM user_roles ur
				WHERE ur.user_id = users.id AND ur.role = 'student'
			  )
		\`, userID, value); err != nil {
			return domain.SchoolStudentAccount{}, err
		}
	}
	if phone != nil {
		value := strings.TrimSpace(*phone)
		var normalized any
		if value == "" {
			normalized = nil
		} else {
			canonical, ok := domain.NormalizeSaudiPhone(value)
			if !ok {
				return domain.SchoolStudentAccount{}, domain.ErrConflict
			}
			normalized = canonical
		}
		if _, err := tx.Exec(ctx, \`
			UPDATE users
			SET phone = $2, updated_at = now()
			WHERE id = $1::uuid
			  AND EXISTS (
				SELECT 1 FROM user_roles ur
				WHERE ur.user_id = users.id AND ur.role = 'student'
			  )
		\`, userID, normalized); err != nil {
			if isUniqueViolation(err) {
				return domain.SchoolStudentAccount{}, domain.ErrConflict
			}
			return domain.SchoolStudentAccount{}, err
		}
	}
	return r.SchoolStudentAccountTx(ctx, tx, userID)
}

func (r *Repository) SetSchoolStudentActiveTx(
	ctx context.Context,
	tx pgx.Tx,
	userID string,
	active bool,
) (domain.SchoolStudentAccount, error) {
	status := "disabled"
	if active {
		status = "active"
	}
	tag, err := tx.Exec(ctx, \`
		UPDATE users
		SET status = $2, updated_at = now()
		WHERE id = $1::uuid
		  AND EXISTS (
			SELECT 1 FROM user_roles ur
			WHERE ur.user_id = users.id AND ur.role = 'student'
		  )
	\`, userID, status)
	if err != nil {
		return domain.SchoolStudentAccount{}, err
	}
	if tag.RowsAffected() == 0 {
		return domain.SchoolStudentAccount{}, domain.ErrNotFound
	}

	if !active {
		if _, err := tx.Exec(ctx, \`
			UPDATE auth_sessions
			SET revoked_at = COALESCE(revoked_at, now())
			WHERE user_id = $1::uuid
			  AND revoked_at IS NULL
		\`, userID); err != nil {
			return domain.SchoolStudentAccount{}, err
		}
	}
	return r.SchoolStudentAccountTx(ctx, tx, userID)
}

func (r *Repository) SchoolStudentAccountTx(
	ctx context.Context,
	tx pgx.Tx,
	userID string,
) (domain.SchoolStudentAccount, error) {
	var account domain.SchoolStudentAccount
	var status string
	err := tx.QueryRow(ctx, \`
		SELECT
			u.id::text,
			u.name,
			COALESCE(u.email, ''),
			COALESCE(u.phone, ''),
			u.status
		FROM users u
		WHERE u.id = $1::uuid
		  AND EXISTS (
			SELECT 1
			FROM user_roles ur
			WHERE ur.user_id = u.id
			  AND ur.role = 'student'
		  )
	\`, userID).Scan(
		&account.UserID,
		&account.Name,
		&account.Email,
		&account.Phone,
		&status,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.SchoolStudentAccount{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.SchoolStudentAccount{}, err
	}
	account.Active = status == "active"
	return account, nil
}
