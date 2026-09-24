-- name: InsertAuthOneTimeToken :one
INSERT INTO auth_one_time_tokens (user_id, purpose, token_hash, expires_at)
VALUES ($1, $2, $3, $4)
RETURNING id, user_id, purpose, token_hash, expires_at, used_at, created_at;

-- name: InvalidateActiveAuthTokens :exec
UPDATE auth_one_time_tokens
SET used_at = now()
WHERE user_id = $1
  AND purpose = $2
  AND used_at IS NULL;

-- name: RevokeAllUserSessions :exec
UPDATE auth_sessions
SET revoked_at = COALESCE(revoked_at, now())
WHERE user_id = $1
  AND revoked_at IS NULL;
