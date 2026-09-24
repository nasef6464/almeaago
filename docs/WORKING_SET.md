# Current Working Set

## Current phase
Identity/Auth.

## Foundation gate
GREEN.

## Allowed code areas
- internal/identity/**
- internal/platform/security/**
- internal/platform/httpserver/**
- migrations/000003_identity_auth.*
- db/queries/identity.sql
- api/openapi/**
- apps/web/src/features/auth/**
- apps/web/src/shared/auth/**
- auth visual-baseline docs
- targeted CI files only when needed

## Identity/Auth target
Email/password + session cookie first, then recovery/email verification, National ID, Google OAuth and WhatsApp OTP while preserving the legacy UI and behavior.

## Do not start yet
Organizations/Schools implementation beyond existing foundation schema.
No Vercel/Render deployment.
No external database/Redis/R2/AI account.

## Next exact action
Ship the Identity/Auth backend slice and prove it with database/backend tests before starting the Auth frontend parity slice.
