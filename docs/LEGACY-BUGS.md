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
