# Identity/Auth Contract — ALMEAA V2

## Legacy observable baseline
The rebuild must preserve these user-facing capabilities:
- Register with name + email + password.
- Login with email + password.
- Login with Saudi National ID + password when identity is configured.
- Google OAuth.
- WhatsApp OTP.
- Logout.
- Current user session lookup.
- Forgot/reset password.
- Email verification + resend.
- Disabled account denial.
- Login lock after 5 failed attempts for 15 minutes.
- Password rule: 8-160 chars and at least one letter + one digit.
- Generic forgot-password response to reduce account enumeration.
- Reset token TTL: 60 minutes.
- Email verification token TTL: 24 hours.
- Google OAuth state TTL: 10 minutes.
- WhatsApp OTP TTL: 10 minutes, max 5 verification attempts, max 3 sends per 15 minutes.

## Clean target design
### User
`users` owns identity profile only:
- id
- email
- name
- password_hash
- account status
- email verification state
- optional national_id / phone identity
- failed login / lock state
- created/updated timestamps

School/class/parent/content/progress relations do not live on the user row.

### Session
Use opaque random session tokens.
- Browser receives only an HttpOnly cookie.
- Database stores SHA-256 token hash, never the raw token.
- Session can be revoked immediately.
- Session expiry is server-owned.
- Password reset can revoke existing sessions.
- Logout revokes current session + clears cookie.

This preserves cookie-first UX while improving revocation and auditability.

### Password hashing
Use Argon2id for new passwords.
The implementation must store parameters with the hash and support future rehashing.

### CSRF / cookie policy
- HttpOnly.
- Secure in production.
- SameSite configurable per environment.
- State-changing cookie-auth requests require CSRF protection.
- CORS origin allow-list is explicit.
- No wildcard credentials.

### Recovery tokens
Use dedicated token records or strongly bounded user recovery fields.
Raw verification/reset tokens are never persisted.
Store SHA-256 digest + purpose + expiry + used/revoked state.

### Google OAuth
- state bound to short-lived cookie/session.
- timing-safe state verification.
- safe returnTo normalization.
- only verified Google email claims can link/create accounts.
- provider secrets never reach frontend.

### WhatsApp OTP
- normalized phone.
- hashed OTP.
- request throttling.
- attempt throttling.
- one-time use.
- provider adapter isolated under communication/integration boundary.
- no OTP in production logs.

## Responsibility boundaries
Identity owns login/session/password/account identity.
Organizations owns school membership/class assignment/parent relationship.
Commerce owns entitlements.
Learning owns progress/review.
Admin user management may call Identity application services but must not mutate auth tables directly.

## Required API contract
- GET /api/v1/auth/csrf
- POST /api/v1/auth/register
- POST /api/v1/auth/login
- POST /api/v1/auth/login/national-id
- POST /api/v1/auth/logout
- GET /api/v1/auth/me
- POST /api/v1/auth/forgot-password
- POST /api/v1/auth/reset-password
- POST /api/v1/auth/email/verify
- POST /api/v1/auth/email/resend
- GET /api/v1/auth/google/start
- GET /api/v1/auth/google/callback
- POST /api/v1/auth/whatsapp/start
- POST /api/v1/auth/whatsapp/verify

## Security acceptance
- wrong email/password gives generic 401.
- fifth failed attempt locks according policy.
- disabled user cannot log in.
- successful login clears failed-login state.
- password reset invalidates the token and revokes active sessions.
- forgot-password never reveals account existence.
- raw session/recovery/OTP tokens never appear in DB.
- CSRF is required for unsafe cookie-auth requests.
- session cookie is HttpOnly.
- auth responses never expose password/security fields.

## Visual parity
The login/register modal and forgot/reset/verify screens must match the legacy UI:
- same RTL structure.
- same modal proportions and rounded card.
- same Google entry point.
- same login/register toggle.
- same error banner.
- same password visibility controls.
- same mobile behavior.
- same Arabic wording unless an intentional copy change is approved.
