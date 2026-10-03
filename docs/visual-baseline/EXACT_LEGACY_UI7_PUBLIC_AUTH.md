# Exact Legacy UI-7 — Public / Auth completeness

Status: ACTIVE

## Source-backed delta
- V2 already exposes the public/static routes: `/about`, `/contact`, `/faq`, `/privacy`, `/terms`.
- V2 already exposes auth routes: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`.
- Exact Legacy 404 includes both home and dashboard recovery actions. This slice restores the missing `لوحة التحكم` action to canonical V2 `/dashboard` without changing auth/server authority.

## Verification contract
- Keep existing auth parity coverage for login/signup/OTP/recovery/verification.
- Exercise public/static and 404 recovery at responsive widths.
- Require Database CI + Backend CI + Frontend CI + Frontend E2E green on the same final SHA before merge.
