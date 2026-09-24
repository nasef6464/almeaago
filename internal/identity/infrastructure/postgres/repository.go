package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/nasef6464/almeaago/internal/identity/application"
	"github.com/nasef6464/almeaago/internal/identity/domain"
)

type Repository struct {
	db *pgxpool.Pool
}

type scanner interface {
	Scan(dest ...any) error
}

func New(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateUserWithRole(
	ctx context.Context,
	name string,
	email string,
	passwordHash string,
	role domain.Role,
) (domain.User, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return domain.User{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var userID string
	err = tx.QueryRow(
		ctx,
		"INSERT INTO users(email,name,password_hash,status) VALUES(lower($1),$2,$3,'active') RETURNING id::text",
		email,
		name,
		passwordHash,
	).Scan(&userID)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return domain.User{}, application.ErrEmailExists
		}
		return domain.User{}, err
	}

	if _, err := tx.Exec(
		ctx,
		"INSERT INTO user_roles(user_id,role) VALUES($1::uuid,$2)",
		userID,
		string(role),
	); err != nil {
		return domain.User{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.User{}, err
	}
	return r.FindUserByID(ctx, userID)
}

func (r *Repository) FindUserByID(ctx context.Context, userID string) (domain.User, error) {
	return r.findUser(ctx, "u.id=$1::uuid", userID)
}

func (r *Repository) FindUserByEmail(ctx context.Context, email string) (domain.User, error) {
	return r.findUser(ctx, "lower(u.email)=lower($1)", email)
}

func (r *Repository) FindUserByNationalID(ctx context.Context, nationalID string) (domain.User, error) {
	return r.findUser(ctx, "u.national_id=$1", nationalID)
}

func (r *Repository) findUser(ctx context.Context, predicate string, value any) (domain.User, error) {
	query := "SELECT u.id::text,u.email,u.name,u.password_hash,u.status,u.avatar_url," +
		"u.email_verified_at,u.national_id,u.phone,u.failed_login_attempts," +
		"u.last_failed_login_at,u.login_locked_until,u.password_changed_at," +
		"u.created_at,u.updated_at," +
		"COALESCE(array_agg(ur.role ORDER BY ur.role) FILTER (WHERE ur.role IS NOT NULL),'{}'::text[]) " +
		"FROM users u LEFT JOIN user_roles ur ON ur.user_id=u.id WHERE " + predicate +
		" GROUP BY u.id LIMIT 1"

	user, err := scanUser(r.db.QueryRow(ctx, query, value))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, application.ErrUnauthenticated
	}
	return user, err
}

func (r *Repository) RecordFailedLogin(
	ctx context.Context,
	userID string,
	threshold int,
	lockedUntil time.Time,
) error {
	_, err := r.db.Exec(
		ctx,
		"UPDATE users SET failed_login_attempts=failed_login_attempts+1,"+
			"last_failed_login_at=now(),"+
			"login_locked_until=CASE WHEN failed_login_attempts+1 >= $2 THEN $3 ELSE login_locked_until END,"+
			"updated_at=now() WHERE id=$1::uuid",
		userID,
		threshold,
		lockedUntil,
	)
	return err
}

func (r *Repository) ClearFailedLogin(ctx context.Context, userID string) error {
	_, err := r.db.Exec(
		ctx,
		"UPDATE users SET failed_login_attempts=0,last_failed_login_at=NULL,"+
			"login_locked_until=NULL,updated_at=now() WHERE id=$1::uuid",
		userID,
	)
	return err
}

func (r *Repository) CreateSession(
	ctx context.Context,
	userID string,
	tokenHash string,
	userAgent string,
	expiresAt time.Time,
) error {
	_, err := r.db.Exec(
		ctx,
		"INSERT INTO auth_sessions(user_id,token_hash,expires_at,user_agent) VALUES($1::uuid,$2,$3,$4)",
		userID,
		tokenHash,
		expiresAt,
		userAgent,
	)
	return err
}

func (r *Repository) FindUserBySessionHash(ctx context.Context, tokenHash string) (domain.User, error) {
	query := "SELECT u.id::text,u.email,u.name,u.password_hash,u.status,u.avatar_url," +
		"u.email_verified_at,u.national_id,u.phone,u.failed_login_attempts," +
		"u.last_failed_login_at,u.login_locked_until,u.password_changed_at," +
		"u.created_at,u.updated_at," +
		"COALESCE(array_agg(ur.role ORDER BY ur.role) FILTER (WHERE ur.role IS NOT NULL),'{}'::text[]) " +
		"FROM auth_sessions s JOIN users u ON u.id=s.user_id " +
		"LEFT JOIN user_roles ur ON ur.user_id=u.id " +
		"WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() " +
		"GROUP BY u.id LIMIT 1"

	user, err := scanUser(r.db.QueryRow(ctx, query, tokenHash))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, application.ErrUnauthenticated
	}
	return user, err
}

func (r *Repository) RevokeSessionByHash(ctx context.Context, tokenHash string) error {
	_, err := r.db.Exec(
		ctx,
		"UPDATE auth_sessions SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL",
		tokenHash,
	)
	return err
}

func (r *Repository) RevokeAllSessions(ctx context.Context, userID string) error {
	_, err := r.db.Exec(
		ctx,
		"UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1::uuid AND revoked_at IS NULL",
		userID,
	)
	return err
}

func (r *Repository) CreateOneTimeToken(
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
		"UPDATE auth_tokens SET used_at=now() WHERE user_id=$1::uuid AND purpose=$2 AND used_at IS NULL",
		userID,
		purpose,
	); err != nil {
		return err
	}

	if _, err := tx.Exec(
		ctx,
		"INSERT INTO auth_tokens(user_id,purpose,token_hash,expires_at) VALUES($1::uuid,$2,$3,$4)",
		userID,
		purpose,
		tokenHash,
		expiresAt,
	); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *Repository) ResetPasswordByToken(
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
		"SELECT user_id::text FROM auth_tokens "+
			"WHERE token_hash=$1 AND purpose='password_reset' AND used_at IS NULL AND expires_at>now() "+
			"FOR UPDATE",
		tokenHash,
	).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, application.ErrInvalidToken
	}
	if err != nil {
		return domain.User{}, err
	}

	if _, err := tx.Exec(
		ctx,
		"UPDATE auth_tokens SET used_at=now() WHERE token_hash=$1",
		tokenHash,
	); err != nil {
		return domain.User{}, err
	}

	if _, err := tx.Exec(
		ctx,
		"UPDATE users SET password_hash=$2,password_changed_at=$3,failed_login_attempts=0,"+
			"last_failed_login_at=NULL,login_locked_until=NULL,updated_at=now() WHERE id=$1::uuid",
		userID,
		newPasswordHash,
		changedAt,
	); err != nil {
		return domain.User{}, err
	}

	if _, err := tx.Exec(
		ctx,
		"UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1::uuid AND revoked_at IS NULL",
		userID,
	); err != nil {
		return domain.User{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.User{}, err
	}
	return r.FindUserByID(ctx, userID)
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
	err = tx.QueryRow(
		ctx,
		"SELECT user_id::text FROM auth_tokens "+
			"WHERE token_hash=$1 AND purpose='email_verification' AND used_at IS NULL AND expires_at>now() "+
			"FOR UPDATE",
		tokenHash,
	).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, application.ErrInvalidToken
	}
	if err != nil {
		return domain.User{}, err
	}

	if _, err := tx.Exec(
		ctx,
		"UPDATE auth_tokens SET used_at=now() WHERE token_hash=$1",
		tokenHash,
	); err != nil {
		return domain.User{}, err
	}

	if _, err := tx.Exec(
		ctx,
		"UPDATE users SET email_verified_at=COALESCE(email_verified_at,$2),updated_at=now() WHERE id=$1::uuid",
		userID,
		verifiedAt,
	); err != nil {
		return domain.User{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.User{}, err
	}
	return r.FindUserByID(ctx, userID)
}

func scanUser(row scanner) (domain.User, error) {
	var user domain.User
	var roleStrings []string

	err := row.Scan(
		&user.ID,
		&user.Email,
		&user.Name,
		&user.PasswordHash,
		&user.Status,
		&user.AvatarURL,
		&user.EmailVerifiedAt,
		&user.NationalID,
		&user.Phone,
		&user.FailedLoginAttempts,
		&user.LastFailedLoginAt,
		&user.LoginLockedUntil,
		&user.PasswordChangedAt,
		&user.CreatedAt,
		&user.UpdatedAt,
		&roleStrings,
	)
	if err != nil {
		return domain.User{}, err
	}

	user.Roles = make([]domain.Role, len(roleStrings))
	for i, role := range roleStrings {
		user.Roles[i] = domain.Role(role)
	}
	return user, nil
}
