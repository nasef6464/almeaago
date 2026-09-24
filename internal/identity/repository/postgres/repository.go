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

func (r *Repository) CreateRegisteredUser(
	ctx context.Context,
	name string,
	email string,
	passwordHash string,
	role domain.Role,
	verificationTokenHash string,
	verificationExpiresAt time.Time,
) (domain.User, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return domain.User{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var user domain.User
	err = tx.QueryRow(
		ctx,
		"INSERT INTO users (email, name, password_hash, status) "+
			"VALUES ($1, $2, $3, 'active') "+
			"RETURNING id::text, email, name, password_hash, status, avatar_url, "+
			"COALESCE(national_id, ''), COALESCE(phone, ''), "+
			"(email_verified_at IS NOT NULL), failed_login_attempts, "+
			"COALESCE(login_locked_until, 'epoch'::timestamptz), created_at, updated_at",
		email,
		name,
		passwordHash,
	).Scan(
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

	if _, err := tx.Exec(
		ctx,
		"INSERT INTO user_roles (user_id, role) VALUES ($1::uuid, $2)",
		user.ID,
		role,
	); err != nil {
		return domain.User{}, fmt.Errorf("create user role: %w", err)
	}

	if _, err := tx.Exec(
		ctx,
		"INSERT INTO auth_one_time_tokens (user_id, purpose, token_hash, expires_at) "+
			"VALUES ($1::uuid, 'email_verification', $2, $3)",
		user.ID,
		verificationTokenHash,
		verificationExpiresAt,
	); err != nil {
		return domain.User{}, fmt.Errorf("create email verification token: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.User{}, err
	}

	user.Roles = []domain.Role{role}
	return user, nil
}

func (r *Repository) UserByEmail(ctx context.Context, email string) (domain.User, error) {
	return r.userBy(ctx, "lower(email) = lower($1)", email)
}

func (r *Repository) UserByNationalID(ctx context.Context, nationalID string) (domain.User, error) {
	return r.userBy(ctx, "national_id = $1", nationalID)
}

func (r *Repository) UserByPhone(ctx context.Context, phone string) (domain.User, error) {
	return r.userBy(ctx, "phone = $1", phone)
}

func (r *Repository) UserByID(ctx context.Context, id string) (domain.User, error) {
	return r.userBy(ctx, "id = $1::uuid", id)
}

func (r *Repository) userBy(ctx context.Context, predicate string, value any) (domain.User, error) {
	query := "SELECT id::text, email, name, password_hash, status, avatar_url, " +
		"COALESCE(national_id, ''), COALESCE(phone, ''), " +
		"(email_verified_at IS NOT NULL), failed_login_attempts, " +
		"COALESCE(login_locked_until, 'epoch'::timestamptz), created_at, updated_at " +
		"FROM users WHERE " + predicate + " LIMIT 1"

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
	rows, err := r.db.Query(
		ctx,
		"SELECT role FROM user_roles WHERE user_id = $1::uuid ORDER BY role",
		userID,
	)
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

func (r *Repository) RecordFailedLogin(
	ctx context.Context,
	userID string,
	threshold int,
	lockFor time.Duration,
) error {
	_, err := r.db.Exec(
		ctx,
		"UPDATE users SET failed_login_attempts = failed_login_attempts + 1, "+
			"last_failed_login_at = now(), "+
			"login_locked_until = CASE "+
			"WHEN failed_login_attempts + 1 >= $2 "+
			"THEN now() + ($3 * interval '1 second') "+
			"ELSE login_locked_until END, updated_at = now() "+
			"WHERE id = $1::uuid",
		userID,
		threshold,
		int(lockFor.Seconds()),
	)
	return err
}

func (r *Repository) ClearFailedLogin(ctx context.Context, userID string) error {
	_, err := r.db.Exec(
		ctx,
		"UPDATE users SET failed_login_attempts = 0, last_failed_login_at = NULL, "+
			"login_locked_until = NULL, updated_at = now() WHERE id = $1::uuid",
		userID,
	)
	return err
}

func (r *Repository) UpdatePasswordHash(ctx context.Context, userID, passwordHash string) error {
	_, err := r.db.Exec(
		ctx,
		"UPDATE users SET password_hash = $2, password_changed_at = now(), updated_at = now() "+
			"WHERE id = $1::uuid",
		userID,
		passwordHash,
	)
	return err
}

func (r *Repository) CreateSession(
	ctx context.Context,
	userID string,
	tokenHash string,
	csrfHash string,
	expiresAt time.Time,
) (domain.Session, error) {
	var session domain.Session
	err := r.db.QueryRow(
		ctx,
		"INSERT INTO auth_sessions (user_id, token_hash, csrf_token_hash, expires_at) "+
			"VALUES ($1::uuid, $2, $3, $4) "+
			"RETURNING id::text, user_id::text, token_hash, csrf_token_hash, expires_at, last_seen_at",
		userID,
		tokenHash,
		csrfHash,
		expiresAt,
	).Scan(
		&session.ID,
		&session.UserID,
		&session.TokenHash,
		&session.CSRFHash,
		&session.ExpiresAt,
		&session.LastSeenAt,
	)
	return session, err
}

func (r *Repository) SessionByTokenHash(
	ctx context.Context,
	tokenHash string,
) (domain.Session, domain.User, error) {
	var session domain.Session
	var user domain.User

	err := r.db.QueryRow(
		ctx,
		"SELECT s.id::text, s.user_id::text, s.token_hash, s.csrf_token_hash, s.expires_at, s.last_seen_at, "+
			"u.id::text, u.email, u.name, u.password_hash, u.status, u.avatar_url, "+
			"COALESCE(u.national_id, ''), COALESCE(u.phone, ''), "+
			"(u.email_verified_at IS NOT NULL), u.failed_login_attempts, "+
			"COALESCE(u.login_locked_until, 'epoch'::timestamptz), u.created_at, u.updated_at "+
			"FROM auth_sessions s JOIN users u ON u.id = s.user_id "+
			"WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() LIMIT 1",
		tokenHash,
	).Scan(
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

	_, _ = r.db.Exec(
		ctx,
		"UPDATE auth_sessions SET last_seen_at = now() "+
			"WHERE id = $1::uuid AND last_seen_at < now() - interval '5 minutes'",
		session.ID,
	)

	return session, user, nil
}

func (r *Repository) RotateSessionCSRF(ctx context.Context, sessionID, csrfHash string) error {
	_, err := r.db.Exec(
		ctx,
		"UPDATE auth_sessions SET csrf_token_hash = $2 "+
			"WHERE id = $1::uuid AND revoked_at IS NULL",
		sessionID,
		csrfHash,
	)
	return err
}

func (r *Repository) RevokeSessionByTokenHash(ctx context.Context, tokenHash string) error {
	_, err := r.db.Exec(
		ctx,
		"UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE token_hash = $1",
		tokenHash,
	)
	return err
}

func (r *Repository) ReplaceOneTimeToken(
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

	if _, err := tx.Exec(
		ctx,
		"UPDATE auth_one_time_tokens SET revoked_at = now() "+
			"WHERE user_id = $1::uuid AND purpose = $2 "+
			"AND consumed_at IS NULL AND revoked_at IS NULL",
		userID,
		purpose,
	); err != nil {
		return err
	}

	if _, err := tx.Exec(
		ctx,
		"INSERT INTO auth_one_time_tokens (user_id, purpose, token_hash, expires_at) "+
			"VALUES ($1::uuid, $2, $3, $4)",
		userID,
		purpose,
		tokenHash,
		expiresAt,
	); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *Repository) ConsumePasswordResetToken(
	ctx context.Context,
	tokenHash string,
	newPasswordHash string,
	changedAt time.Time,
) (domain.User, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return domain.User{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var userID string
	err = tx.QueryRow(
		ctx,
		"SELECT user_id::text FROM auth_one_time_tokens "+
			"WHERE token_hash = $1 AND purpose = 'password_reset' "+
			"AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at > now() "+
			"FOR UPDATE",
		tokenHash,
	).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.User{}, err
	}

	if _, err := tx.Exec(
		ctx,
		"UPDATE auth_one_time_tokens SET consumed_at = now() WHERE token_hash = $1",
		tokenHash,
	); err != nil {
		return domain.User{}, err
	}

	if _, err := tx.Exec(
		ctx,
		"UPDATE users SET password_hash = $2, password_changed_at = $3, "+
			"failed_login_attempts = 0, last_failed_login_at = NULL, login_locked_until = NULL, "+
			"updated_at = now() WHERE id = $1::uuid",
		userID,
		newPasswordHash,
		changedAt,
	); err != nil {
		return domain.User{}, err
	}

	if _, err := tx.Exec(
		ctx,
		"UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, now()) "+
			"WHERE user_id = $1::uuid AND revoked_at IS NULL",
		userID,
	); err != nil {
		return domain.User{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.User{}, err
	}
	return r.UserByID(ctx, userID)
}

func (r *Repository) ConsumeEmailVerificationToken(
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
	err = tx.QueryRow(
		ctx,
		"SELECT user_id::text FROM auth_one_time_tokens "+
			"WHERE token_hash = $1 AND purpose = 'email_verification' "+
			"AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at > now() "+
			"FOR UPDATE",
		tokenHash,
	).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.User{}, err
	}

	if _, err := tx.Exec(
		ctx,
		"UPDATE auth_one_time_tokens SET consumed_at = now() WHERE token_hash = $1",
		tokenHash,
	); err != nil {
		return domain.User{}, err
	}

	if _, err := tx.Exec(
		ctx,
		"UPDATE users SET email_verified_at = COALESCE(email_verified_at, $2), updated_at = now() "+
			"WHERE id = $1::uuid",
		userID,
		verifiedAt,
	); err != nil {
		return domain.User{}, err
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
