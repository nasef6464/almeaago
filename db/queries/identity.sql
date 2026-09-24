-- name: GetUserByID :one
SELECT
  id, email, name, password_hash, status, avatar_url, national_id, phone,
  email_verified_at, failed_login_attempts, login_locked_until, created_at, updated_at
FROM users
WHERE id = $1;

-- name: GetUserByEmail :one
SELECT
  id, email, name, password_hash, status, avatar_url, national_id, phone,
  email_verified_at, failed_login_attempts, login_locked_until, created_at, updated_at
FROM users
WHERE lower(email) = lower($1)
LIMIT 1;

-- name: GetUserByNationalID :one
SELECT
  id, email, name, password_hash, status, avatar_url, national_id, phone,
  email_verified_at, failed_login_attempts, login_locked_until, created_at, updated_at
FROM users
WHERE national_id = $1
LIMIT 1;

-- name: CreateUser :one
INSERT INTO users (email, name, password_hash, status)
VALUES ($1, $2, $3, 'active')
RETURNING *;

-- name: AddUserRole :exec
INSERT INTO user_roles (user_id, role)
VALUES ($1, $2)
ON CONFLICT DO NOTHING;

-- name: ListUserRoles :many
SELECT role
FROM user_roles
WHERE user_id = $1
ORDER BY role;

-- name: CreateAuthSession :one
INSERT INTO auth_sessions (user_id, token_hash, csrf_token_hash, expires_at)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: RevokeAuthSessionByTokenHash :execrows
UPDATE auth_sessions
SET revoked_at = COALESCE(revoked_at, now())
WHERE token_hash = $1;
