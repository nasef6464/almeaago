# Legacy Bugs and Intentional Fixes

This file records cases where ALMEAA V2 intentionally does not reproduce an unsafe or internally inconsistent legacy behavior.

## ID-ADMIN-001 — Last-admin protection was inconsistent

Legacy behavior:
- deleting the last admin was blocked;
- bulk deactivation protected the current admin and last active admin;
- the single-user update route did not apply the same protection when changing role/status.

V2 decision: **fix**.

All admin-account mutation paths must preserve at least one active admin. Self-delete is forbidden. Bulk deactivation cannot deactivate the acting admin. Single-user status/role updates also cannot leave the platform without an active admin.

Reason:
This is an account-recovery and platform-governance invariant, not a UX feature.

Parity status:
Intentional security fix. The admin UI flow remains the same; only the unsafe edge case changes.


## ID-MEDIA-001 — Large inline avatar payloads

Legacy behavior:
- profile/admin avatar fields could accept very large strings, including inline data payloads.

V2 decision: **intentional change**.

Identity stores only a small avatar reference string. Media bytes must use the media/object-storage flow (R2) instead of the users row or ordinary auth JSON requests.

Reason:
- prevents database bloat;
- prevents repeated large API payloads;
- follows ALMEAA bandwidth/media policy.


## ORG-CONTRACT-001 — Reversed school contract validity range

Legacy behavior:
- the admin UI prevented an end date before the start date;
- the legacy API/schema could still store that invalid range when called directly.

V2 decision: **fix**.

PostgreSQL and the Organizations application both reject `validUntil < validFrom`.

Reason:
An impossible validity window should never become persistent contract state. The visible admin UI behavior is unchanged; the unsafe API edge case is closed.
