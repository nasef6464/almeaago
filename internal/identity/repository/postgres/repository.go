package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/nasef6464/almeaago/internal/identity/domain"
)

type Repository struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateUser(ctx context.Context, name, email, passwordHash string, role domain.Role) (domain.User, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return domain.User{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var user domain.User
	err = tx.QueryRow(ctx, `
		INSERT INTO users (email, name, password_hash, status)
		VALUES ($1, $2, $3, 'active')
		RETURNING id::text, email, name, password_hash, status, avatar_url,
		          COALESCE(national_id, ''), COALESCE(phone, ''),
		          (email_verified_at IS NOT NULL), failed_login_attempts,
		          COALESCE(login_locked_until, 'epoch'::timestamptz),
		          created_at, updated_at
	`, email, name, passwordHash).Scan(
		&user.ID,
		&user.Email,
		&user.Name,
		&user.PasswordHash,
		&user.Status,
		&user.AvatarURL,
		&user.NationalID,
		&user.Phone,
		&user.EmailVerified,
		&user.FailedLoginAttempts,
		&user.LoginLockedUntil,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		if isUniqueViolation(err) {
			return domain.User{}, domain.ErrConflict
		}
		return domain.User{}, fmt.Errorf("create user: %w", err)
	}

	if _, err := tx.Exec(ctx, `INSERT INTO user_roles (user_id, role) VALUES ($1, $2)`, user.ID, role); err != nil {
		return domain.User{}, fmt.Errorf("create user role: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.User{}, err
	}

	user.Roles = []domain.Role{role}
	return user, nil
}

func (r *Repository) UserByEmail(ctx context.Context, email string) (domain.User, error) {
	return r.userBy(ctx, `lower(email) = lower($1)`, email)
}

func (r *Repository) UserByNationalID(ctx context.Context, nationalID string) (domain.User, error) {
	return r.userBy(ctx, `national_id = $1`, nationalID)
}

func (r *Repository) UserByPhone(ctx context.Context, phone string) (domain.User, error) {
	return r.userBy(ctx, `phone = $1`, phone)
}

func (r *Repository) UserByID(ctx context.Context, id string) (domain.User, error) {
	return r.userBy(ctx, `id = $1`, id)
}

func (r *Repository) userBy(ctx context.Context, predicate string, value any) (domain.User, error) {
	query := `
		SELECT id::text, COALESCE(email, ''), name, COALESCE(password_hash, ''), status, avatar_url,
		       COALESCE(national_id, ''), COALESCE(phone, ''),
		       (email_verified_at IS NOT NULL), failed_login_attempts,
		       COALESCE(login_locked_until, 'epoch'::timestamptz),
		       created_at, updated_at
		FROM users
		WHERE ` + predicate + `
		LIMIT 1
	`

	var user domain.User
	err := r.db.QueryRow(ctx, query, value).Scan(
		&user.ID,
		&user.Email,
		&user.Name,
		&user.PasswordHash,
		&user.Status,
		&user.AvatarURL,
		&user.NationalID,
		&user.Phone,
		&user.EmailVerified,
		&user.FailedLoginAttempts,
		&user.LoginLockedUntil,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.User{}, err
	}

	roles, err := r.roles(ctx, user.ID)
	if err != nil {
		return domain.User{}, err
	}
	user.Roles = roles
	return user, nil
}

func (r *Repository) roles(ctx context.Context, userID string) ([]domain.Role, error) {
	rows, err := r.db.Query(ctx, `SELECT role FROM user_roles WHERE user_id = $1 ORDER BY role`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	roles := make([]domain.Role, 0, 2)
	for rows.Next() {
		var role domain.Role
		if err := rows.Scan(&role); err != nil {
			return nil, err
		}
		roles = append(roles, role)
	}
	return roles, rows.Err()
}

func (r *Repository) RecordFailedLogin(ctx context.Context, userID string, threshold int, lockFor time.Duration) error {
	_, err := r.db.Exec(ctx, `
		UPDATE users
		SET failed_login_attempts = failed_login_attempts + 1,
		    last_failed_login_at = now(),
		    login_locked_until = CASE
		      WHEN failed_login_attempts + 1 >= $2
		      THEN now() + ($3 * interval '1 second')
		      ELSE login_locked_until
		    END,
		    updated_at = now()
		WHERE id = $1
	`, userID, threshold, int(lockFor.Seconds()))
	return err
}

func (r *Repository) ClearFailedLogin(ctx context.Context, userID string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE users
		SET failed_login_attempts = 0,
		    last_failed_login_at = NULL,
		    login_locked_until = NULL,
		    updated_at = now()
		WHERE id = $1
	`, userID)
	return err
}

func (r *Repository) CreateSession(ctx context.Context, userID, tokenHash, csrfHash string, expiresAt time.Time) (domain.Session, error) {
	var session domain.Session
	err := r.db.QueryRow(ctx, `
		INSERT INTO auth_sessions (user_id, token_hash, csrf_token_hash, expires_at)
		VALUES ($1, $2, $3, $4)
		RETURNING id::text, user_id::text, token_hash, csrf_token_hash, expires_at, last_seen_at
	`, userID, tokenHash, csrfHash, expiresAt).Scan(
		&session.ID,
		&session.UserID,
		&session.TokenHash,
		&session.CSRFHash,
		&session.ExpiresAt,
		&session.LastSeenAt,
	)
	return session, err
}

func (r *Repository) SessionByTokenHash(ctx context.Context, tokenHash string) (domain.Session, domain.User, error) {
	var session domain.Session
	var user domain.User
	err := r.db.QueryRow(ctx, `
		SELECT s.id::text, s.user_id::text, s.token_hash, s.csrf_token_hash, s.expires_at, s.last_seen_at,
		       u.id::text, COALESCE(u.email, ''), u.name, COALESCE(u.password_hash, ''), u.status, u.avatar_url,
		       COALESCE(u.national_id, ''), COALESCE(u.phone, ''),
		       (u.email_verified_at IS NOT NULL), u.failed_login_attempts,
		       COALESCE(u.login_locked_until, 'epoch'::timestamptz),
		       u.created_at, u.updated_at
		FROM auth_sessions s
		JOIN users u ON u.id = s.user_id
		WHERE s.token_hash = $1
		  AND s.revoked_at IS NULL
		  AND s.expires_at > now()
		LIMIT 1
	`, tokenHash).Scan(
		&session.ID,
		&session.UserID,
		&session.TokenHash,
		&session.CSRFHash,
		&session.ExpiresAt,
		&session.LastSeenAt,
		&user.ID,
		&user.Email,
		&user.Name,
		&user.PasswordHash,
		&user.Status,
		&user.AvatarURL,
		&user.NationalID,
		&user.Phone,
		&user.EmailVerified,
		&user.FailedLoginAttempts,
		&user.LoginLockedUntil,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Session{}, domain.User{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Session{}, domain.User{}, err
	}

	roles, err := r.roles(ctx, user.ID)
	if err != nil {
		return domain.Session{}, domain.User{}, err
	}
	user.Roles = roles

	_, _ = r.db.Exec(ctx, `UPDATE auth_sessions SET last_seen_at = now() WHERE id = $1 AND last_seen_at < now() - interval '5 minutes'`, session.ID)
	return session, user, nil
}

func (r *Repository) RotateSessionCSRF(ctx context.Context, sessionID, csrfHash string) error {
	_, err := r.db.Exec(
		ctx,
		`UPDATE auth_sessions SET csrf_token_hash = $2 WHERE id = $1 AND revoked_at IS NULL`,
		sessionID,
		csrfHash,
	)
	return err
}

func (r *Repository) RevokeSessionByTokenHash(ctx context.Context, tokenHash string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE auth_sessions
		SET revoked_at = COALESCE(revoked_at, now())
		WHERE token_hash = $1
	`, tokenHash)
	return err
}

func (r *Repository) IssueOneTimeToken(
	ctx context.Context,
	userID string,
	purpose string,
	tokenHash string,
	expiresAt time.Time,
) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `
		UPDATE auth_one_time_tokens
		SET used_at = now()
		WHERE user_id = $1
		  AND purpose = $2
		  AND used_at IS NULL
	`, userID, purpose); err != nil {
		return fmt.Errorf("invalidate prior auth tokens: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO auth_one_time_tokens (user_id, purpose, token_hash, expires_at)
		VALUES ($1, $2, $3, $4)
	`, userID, purpose, tokenHash, expiresAt); err != nil {
		return fmt.Errorf("create one-time auth token: %w", err)
	}

	return tx.Commit(ctx)
}

func (r *Repository) ResetPasswordByToken(
	ctx context.Context,
	tokenHash string,
	passwordHash string,
	changedAt time.Time,
) (domain.User, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return domain.User{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var userID string
	err = tx.QueryRow(ctx, `
		SELECT user_id::text
		FROM auth_one_time_tokens
		WHERE purpose = 'password_reset'
		  AND token_hash = $1
		  AND used_at IS NULL
		  AND expires_at > now()
		FOR UPDATE
	`, tokenHash).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.User{}, fmt.Errorf("load password reset token: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE auth_one_time_tokens
		SET used_at = now()
		WHERE token_hash = $1
	`, tokenHash); err != nil {
		return domain.User{}, fmt.Errorf("consume password reset token: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE users
		SET password_hash = $2,
		    password_changed_at = $3,
		    failed_login_attempts = 0,
		    last_failed_login_at = NULL,
		    login_locked_until = NULL,
		    updated_at = now()
		WHERE id = $1
	`, userID, passwordHash, changedAt); err != nil {
		return domain.User{}, fmt.Errorf("update password: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE auth_sessions
		SET revoked_at = COALESCE(revoked_at, now())
		WHERE user_id = $1
		  AND revoked_at IS NULL
	`, userID); err != nil {
		return domain.User{}, fmt.Errorf("revoke sessions after password reset: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.User{}, err
	}
	return r.UserByID(ctx, userID)
}

func (r *Repository) VerifyEmailByToken(
	ctx context.Context,
	tokenHash string,
	verifiedAt time.Time,
) (domain.User, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return domain.User{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var userID string
	err = tx.QueryRow(ctx, `
		SELECT user_id::text
		FROM auth_one_time_tokens
		WHERE purpose = 'email_verification'
		  AND token_hash = $1
		  AND used_at IS NULL
		  AND expires_at > now()
		FOR UPDATE
	`, tokenHash).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.User{}, fmt.Errorf("load email verification token: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE auth_one_time_tokens
		SET used_at = now()
		WHERE token_hash = $1
	`, tokenHash); err != nil {
		return domain.User{}, fmt.Errorf("consume email verification token: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE users
		SET email_verified_at = COALESCE(email_verified_at, $2),
		    updated_at = now()
		WHERE id = $1
	`, userID, verifiedAt); err != nil {
		return domain.User{}, fmt.Errorf("verify email: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.User{}, err
	}
	return r.UserByID(ctx, userID)
}


func (r *Repository) CountRecentOTPChallenges(
	ctx context.Context,
	phone string,
	channel string,
	since time.Time,
) (int, error) {
	var count int
	err := r.db.QueryRow(ctx, `
		SELECT count(*)::int
		FROM auth_otp_challenges
		WHERE phone = $1
		  AND channel = $2
		  AND created_at >= $3
	`, phone, channel, since).Scan(&count)
	return count, err
}

func (r *Repository) CreateOTPChallenge(
	ctx context.Context,
	phone string,
	channel string,
	codeHash string,
	expiresAt time.Time,
) (domain.OTPChallenge, error) {
	var challenge domain.OTPChallenge
	err := r.db.QueryRow(ctx, `
		INSERT INTO auth_otp_challenges (phone, channel, code_hash, expires_at)
		VALUES ($1, $2, $3, $4)
		RETURNING id::text, phone, channel, code_hash, expires_at, attempts, used_at, created_at
	`, phone, channel, codeHash, expiresAt).Scan(
		&challenge.ID,
		&challenge.Phone,
		&challenge.Channel,
		&challenge.CodeHash,
		&challenge.ExpiresAt,
		&challenge.Attempts,
		&challenge.UsedAt,
		&challenge.CreatedAt,
	)
	return challenge, err
}

func (r *Repository) LatestActiveOTPChallenge(
	ctx context.Context,
	phone string,
	channel string,
) (domain.OTPChallenge, error) {
	var challenge domain.OTPChallenge
	err := r.db.QueryRow(ctx, `
		SELECT id::text, phone, channel, code_hash, expires_at, attempts, used_at, created_at
		FROM auth_otp_challenges
		WHERE phone = $1
		  AND channel = $2
		  AND used_at IS NULL
		ORDER BY created_at DESC
		LIMIT 1
	`, phone, channel).Scan(
		&challenge.ID,
		&challenge.Phone,
		&challenge.Channel,
		&challenge.CodeHash,
		&challenge.ExpiresAt,
		&challenge.Attempts,
		&challenge.UsedAt,
		&challenge.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.OTPChallenge{}, domain.ErrNotFound
	}
	return challenge, err
}

func (r *Repository) IncrementOTPAttempts(ctx context.Context, challengeID string) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE auth_otp_challenges
		SET attempts = attempts + 1
		WHERE id = $1
		  AND used_at IS NULL
	`, challengeID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *Repository) ConsumeOTPChallenge(ctx context.Context, challengeID string) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE auth_otp_challenges
		SET used_at = now()
		WHERE id = $1
		  AND used_at IS NULL
	`, challengeID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *Repository) ExpireOTPChallenge(ctx context.Context, challengeID string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE auth_otp_challenges
		SET used_at = COALESCE(used_at, now())
		WHERE id = $1
	`, challengeID)
	return err
}

func (r *Repository) ResolveWhatsAppUser(
	ctx context.Context,
	phone string,
	verifiedAt time.Time,
) (domain.User, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return domain.User{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var userID string
	err = tx.QueryRow(ctx, `
		SELECT user_id::text
		FROM auth_provider_identities
		WHERE provider = 'whatsapp'
		  AND provider_subject = $1
		LIMIT 1
	`, phone).Scan(&userID)

	if errors.Is(err, pgx.ErrNoRows) {
		err = tx.QueryRow(ctx, `
			SELECT id::text
			FROM users
			WHERE phone = $1
			LIMIT 1
		`, phone).Scan(&userID)

		if errors.Is(err, pgx.ErrNoRows) {
			name := "طالب واتساب"
			err = tx.QueryRow(ctx, `
				INSERT INTO users (email, name, password_hash, status, phone)
				VALUES (NULL, $1, NULL, 'active', $2)
				RETURNING id::text
			`, name, phone).Scan(&userID)
			if err != nil {
				return domain.User{}, fmt.Errorf("create whatsapp user: %w", err)
			}
			if _, err := tx.Exec(ctx, `
				INSERT INTO user_roles (user_id, role)
				VALUES ($1, 'student')
				ON CONFLICT DO NOTHING
			`, userID); err != nil {
				return domain.User{}, fmt.Errorf("create whatsapp role: %w", err)
			}
		} else if err != nil {
			return domain.User{}, err
		}

		var linkedUserID string
		err = tx.QueryRow(ctx, `
			INSERT INTO auth_provider_identities (
				user_id, provider, provider_subject, verified_at
			)
			VALUES ($1, 'whatsapp', $2, $3)
			ON CONFLICT (provider, provider_subject)
			DO UPDATE SET updated_at = now()
			RETURNING user_id::text
		`, userID, phone, verifiedAt).Scan(&linkedUserID)
		if err != nil {
			return domain.User{}, fmt.Errorf("link whatsapp identity: %w", err)
		}
		userID = linkedUserID
	} else if err != nil {
		return domain.User{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.User{}, err
	}
	return r.UserByID(ctx, userID)
}

func (r *Repository) ResolveGoogleUser(
	ctx context.Context,
	profile domain.GoogleProfile,
	verifiedAt time.Time,
) (domain.User, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return domain.User{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var userID string
	err = tx.QueryRow(ctx, `
		SELECT user_id::text
		FROM auth_provider_identities
		WHERE provider = 'google'
		  AND provider_subject = $1
		LIMIT 1
	`, profile.Subject).Scan(&userID)

	if errors.Is(err, pgx.ErrNoRows) {
		err = tx.QueryRow(ctx, `
			SELECT id::text
			FROM users
			WHERE lower(email) = lower($1)
			LIMIT 1
		`, profile.Email).Scan(&userID)

		if errors.Is(err, pgx.ErrNoRows) {
			err = tx.QueryRow(ctx, `
				INSERT INTO users (
					email, name, password_hash, status, avatar_url, email_verified_at
				)
				VALUES ($1, $2, NULL, 'active', $3, $4)
				RETURNING id::text
			`, profile.Email, profile.Name, profile.AvatarURL, verifiedAt).Scan(&userID)
			if err != nil {
				return domain.User{}, fmt.Errorf("create google user: %w", err)
			}
			if _, err := tx.Exec(ctx, `
				INSERT INTO user_roles (user_id, role)
				VALUES ($1, 'student')
				ON CONFLICT DO NOTHING
			`, userID); err != nil {
				return domain.User{}, fmt.Errorf("create google role: %w", err)
			}
		} else if err != nil {
			return domain.User{}, err
		} else {
			if _, err := tx.Exec(ctx, `
				UPDATE users
				SET email_verified_at = COALESCE(email_verified_at, $2),
				    avatar_url = CASE WHEN avatar_url = '' THEN $3 ELSE avatar_url END,
				    updated_at = now()
				WHERE id = $1
			`, userID, verifiedAt, profile.AvatarURL); err != nil {
				return domain.User{}, fmt.Errorf("refresh google-linked user: %w", err)
			}
		}

		var linkedUserID string
		err = tx.QueryRow(ctx, `
			INSERT INTO auth_provider_identities (
				user_id, provider, provider_subject, verified_at,
				metadata
			)
			VALUES (
				$1, 'google', $2, $3,
				jsonb_build_object('email', $4)
			)
			ON CONFLICT (provider, provider_subject)
			DO UPDATE SET updated_at = now()
			RETURNING user_id::text
		`, userID, profile.Subject, verifiedAt, profile.Email).Scan(&linkedUserID)
		if err != nil {
			return domain.User{}, fmt.Errorf("link google identity: %w", err)
		}
		userID = linkedUserID
	} else if err != nil {
		return domain.User{}, err
	} else {
		if _, err := tx.Exec(ctx, `
			UPDATE users
			SET email_verified_at = COALESCE(email_verified_at, $2),
			    avatar_url = CASE WHEN avatar_url = '' THEN $3 ELSE avatar_url END,
			    updated_at = now()
			WHERE id = $1
		`, userID, verifiedAt, profile.AvatarURL); err != nil {
			return domain.User{}, fmt.Errorf("refresh google identity: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.User{}, err
	}
	return r.UserByID(ctx, userID)
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
