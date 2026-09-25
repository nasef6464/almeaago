# Content UI Browser Evidence

Status: **LEGACY_BASELINE_LOCATED / VISUAL_PARITY_REFINEMENT_IN_PROGRESS**

PR #38 uses a Playwright workflow that is manually dispatchable and automatically runs only when the E2E test/config/package/workflow files themselves change. Ordinary Content source commits do not trigger it.

Current deterministic checks:
- Admin desktop Content management renders the bounded Course list and opens the real Course curriculum builder.
- Admin mobile keeps Content navigation and Lesson creation reachable.
- Teacher Content page sends no broad Course list request until an exact path and subject are selected.
- Foundation editor resolves relational Lesson and Library placements without copying their content payloads.
- API responses are mocked in-browser so the test does not require Vercel, Render, PostgreSQL, R2, Google, or WhatsApp credentials.
- Desktop and mobile screenshots are emitted as the `content-browser-evidence` workflow artifact.

These screenshots are **not** by themselves proof of legacy visual parity. They are implementation evidence only. The Content screens remain `PARITY_NOT_PROVEN` until the generated desktop/mobile images are compared against equivalent legacy ALMEAA states and discrepancies are resolved or explicitly approved.

The workflow is intentionally path-limited to minimize GitHub Actions use. It may also be dispatched manually at meaningful UI checkpoints.


## Legacy comparison basis
The legacy repository now has an inspectable deep-premerge browser artifact from run `36148975277` (artifact `platform-v3-deep-premerge-36148975277`). It provides the real legacy admin shell on desktop/mobile, including:
- `ui-audit-exhaustive/deep-premerge-roles-36148975277/admin/desktop-_admin-dashboard_tab_paths.png`
- `ui-audit-exhaustive/deep-premerge-roles-36148975277/admin/mobile-_admin-dashboard_tab_paths.png`

For the Content builders, the legacy source remains the exact structural reference:
- `dashboards/admin/AdvancedCourseBuilder.tsx`
- `dashboards/admin/builders/UnifiedLessonBuilder.tsx`

The current cutover therefore aligns the admin shell, Course builder header/tabs/content frame, and Lesson editor modal structure to those references while deliberately retaining the new normalized backend contracts.

Intentional non-parity that remains outside this PR:
- assessment placements belong to Assessment and are not embedded back into Content.
- learner entitlement/access policy belongs to Commerce/Access rather than a legacy local `accessControl` blob.
- Media/R2 asset picking is a Media-owned UI slice; Content keeps asset IDs/URLs but does not proxy binary bytes through Go.
- bulk XLSX import/export will be restored only with bounded server contracts and preview/validation, not by copying the old in-browser full-inventory pattern.
