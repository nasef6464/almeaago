-- name: GetUserByID :one
SELECT id,email,name,password_hash,status,created_at,updated_at FROM users WHERE id=$1;
-- name: GetUserByEmail :one
SELECT id,email,name,password_hash,status,created_at,updated_at FROM users WHERE lower(email)=lower($1) LIMIT 1;
-- name: CreateUser :one
INSERT INTO users(email,name,password_hash,status) VALUES($1,$2,$3,$4) RETURNING *;
-- name: CreateAuthSession :one
INSERT INTO auth_sessions(user_id,token_hash,expires_at) VALUES($1,$2,$3) RETURNING *;
-- name: RevokeAuthSession :execrows
UPDATE auth_sessions SET revoked_at=now() WHERE id=$1 AND revoked_at IS NULL;
