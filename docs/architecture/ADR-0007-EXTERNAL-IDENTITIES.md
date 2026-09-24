# ADR-0007: External identities are first-class

Status: Accepted.

## Decision

Google and WhatsApp identities are modeled explicitly instead of manufacturing fake email addresses or fake user-visible credentials.

- `users` is the person/account record.
- email and password may be absent for provider-only accounts.
- `auth_provider_identities` binds a verified external subject to one user.
- phone is canonicalized before persistence.
- OTP challenges are short-lived authentication evidence, not user identity rows.

## Why

The legacy WhatsApp flow created addresses such as `wa_<phone>@otp.almeaa.local`.
That leaks implementation detail into profile/search/reporting data and makes identity cleanup harder.

A provider identity table gives:
- stable Google subject binding even if profile data changes;
- no duplicate fake contacts;
- cleaner account linking;
- auditable provider lifecycle;
- easier future provider additions.

## Security

- provider subject is unique per provider.
- verified external email/phone is required before linking.
- OAuth state is short-lived and integrity protected.
- OTP values are never stored in plaintext.
- OTP verification is attempt-limited and one-time.
- provider credentials stay outside the database-facing domain layer.

## Performance

Provider login uses unique indexed `(provider, provider_subject)`.
Phone lookup uses the existing unique phone index.
OTP lookup uses `(phone, channel, created_at DESC) WHERE used_at IS NULL`.
No broad user scan is required.
