# ADR-0005: Opaque Revocable Sessions

Status: Accepted.

## Decision
ALMEAA V2 uses random opaque browser session tokens stored only in an HttpOnly cookie. PostgreSQL stores only a cryptographic digest of the token.

## Why
The legacy system used JWT access tokens with cookie-first delivery. V2 has no production data migration constraint, so it can use a simpler revocable session model:
- immediate logout/revocation;
- simple password-reset global revocation;
- no stale role/scope claims embedded in long-lived tokens;
- authorization always reads current server truth;
- easier audit and incident response.

## Constraints
- token raw value is never logged/persisted;
- session lookup is indexed by token hash;
- expiry + revoked_at are enforced;
- cookie policy varies by environment but remains HttpOnly and Secure in production;
- CSRF protection remains mandatory for unsafe requests.

This is an internal implementation change. User-facing auth behavior remains parity-driven.
