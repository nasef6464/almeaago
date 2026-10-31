# Cloudinary staging media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, with RED→GREEN tests.

**Goal:** Make Cloudinary Free a secure, explicitly selectable direct media provider for isolated almeaago staging.

**Architecture:** Extend existing media upload target for provider-specific method/form fields; add an authenticated Cloudinary adapter with signed browser uploads and Admin API verification; enable it behind an explicit Go environment switch. Keep R2 behavior unchanged by default.

**Tech Stack:** Go 1.27, standard `net/http` and `crypto`, TypeScript/Vite/React, Cloudinary REST API.

**Spec:** `docs/superpowers/specs/2026-10-31-cloudinary-staging-media-design.md`

## Global Constraints

- No production or legacy writes, no unchecked release or implicit switch to Cloudinary.
- No secrets in repository, responses, or browser bundles; preserve the existing CSRF/roles and PostgreSQL reservation/activation flow.
- Direct uploads must bypass Go server binary transfers.
- Existing R2 presigned PUT response and browser behavior remain valid.

## Review Focus

- Invalid Cloudinary credentials: provider unavailable rather than open access.
- Unexpected MIME or path: presign fails without a reusable arbitrary Cloudinary upload signature.
- Missing/mismatched Cloudinary metadata: pending asset does not activate.
- Cloudinary resource not found: reported as missing, not server crash.
- R2 fallback remains PUT with exactly its old headers.

---

### Task 1: Cloudinary signed upload and resource verification

**Files:** Create `internal/media/provider/cloudinary/client.go`, `client_test.go`.

**Interfaces:** `New(Config) *Client`, `Available`, `PresignPut`, `Head`, `PublicURL` implementing `mediaapp.Provider`. Returns signed `POST` upload target, Cloudinary `image` or `video` resource type determined from key.

- [ ] Write tests for deterministic image/audio signed forms, expected cloud URL, unavailable/malformed keys, successful Admin resource response with SHA context, missing/error response and mismatched metadata.
- [ ] Run `/tmp/go/bin/go test ./internal/media/provider/cloudinary -count=1` and observe RED.
- [ ] Implement the adapter using Cloudinary's documented sorted form signature and Basic Auth Admin GET.
- [ ] Re-run the tests GREEN, then `/tmp/go/bin/go test ./internal/media/...`.
- [ ] Commit task with `git add` exact paths and `git commit`.

### Task 2: Backend/frontend provider selection and request compatibility

**Files:** Modify `internal/media/domain/media.go`, `internal/media/transport/http/handler.go`, `internal/platform/config/config.go`, `cmd/api/main.go`, `apps/web/src/features/questionbank/api/questionbank-client.ts`, `internal/media/README.md`; add focused handler/browser tests.

**Interfaces:** `media.UploadTarget.Method` and `FormFields`; handler JSON `method`, `formFields`; browser detects `POST` to construct `FormData` and retains `PUT` for R2. Set `MEDIA_STORAGE_PROVIDER=cloudinary` explicitly, otherwise R2.

- [ ] Add failing HTTP contract test for Cloudinary method/form fields and a frontend interaction test for signed direct POST.
- [ ] Run targeted tests to observe RED.
- [ ] Wire optional fields, provider selection, browser path and documentation.
- [ ] Re-run tests GREEN, `go test ./...`, frontend `npm run build` and run a safe Cloudinary staging canary.
- [ ] Commit and report evidence and blockers. Do not deploy production.
