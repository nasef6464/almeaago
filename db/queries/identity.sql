-- name: GetUserByID :one
SELECT id,email,name,password_hash,status,avatar_url,email_verified_at,national_id,phone,
       failed_login_attempts,last_failed_login_at,login_locked_until,password_changed_at,
       created_at,updated_at
FROM users
WHERE id=$1;

-- name: GetUserByEmail :one
SELECT id,email,name,password_hash,status,avatar_url,email_verified_at,national_id,phone,
       failed_login_attempts,last_failed_login_at,login_locked_until,password_changed_at,
       created_at,updated_at
FROM users
WHERE lower(email)=lower($1)
LIMIT 1;

-- name: GetUserByNationalID :one
SELECT id,email,name,password_hash,status,avatar_url,email_verified_at,national_id,phone,
       failed_login_attempts,last_failed_login_at,login_locked_until,password_changed_at,
       created_at,updated_at
FROM users
WHERE national_id=$1
LIMIT 1;

-- name: CreateUser :one
INSERT INTO users(email,name,password_hash,status)
VALUES(lower($1),$2,$3,'active')
RETURNING id,email,name,password_hash,status,avatar_url,email_verified_at,national_id,phone,
          failed_login_attempts,last_failed_login_at,login_locked_until,password_changed_at,
          created_at,updated_at;

-- name: AddUserRole :exec
INSERT INTO user_roles(user_id,role)
VALUES($1,$2)
ON CONFLICT DO NOTHING;

-- name: ListUserRoles :many
SELECT role
FROM user_roles
WHERE user_id=$1
ORDER BY role;

-- name: CreateAuthSession :one
INSERT INTO auth_sessions(user_id,token_hash,expires_at,user_agent)
VALUES($1,$2,$3,$4)
RETURNING id,user_id,token_hash,expires_at,revoked_at,created_at,user_agent,last_seen_at;

-- name: RevokeAuthSessionByHash :execrows
UPDATE auth_sessions
SET revoked_at=now()
WHERE token_hash=$1 AND revoked_at IS NULL;

-- name: CreateAuthToken :one
INSERT INTO auth_tokens(user_id,purpose,token_hash,expires_at)
VALUES($1,$2,$3,$4)
RETURNING id,user_id,purpose,token_hash,expires_at,used_at,created_at;
