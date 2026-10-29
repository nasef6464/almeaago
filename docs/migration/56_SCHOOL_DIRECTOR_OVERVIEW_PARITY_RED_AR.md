# RED: school director overview/header original parity (2026-10-30)

Legacy read-only `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`:
`dashboards/SchoolDirectorDashboard.tsx`, around lines 141–150:
- Header description is exactly `رؤية تنفيذية وعمليات الطلاب داخل المدارس المصرح بها فقط.`.
- That description appears only when `section==='overview'`.
- The overview renders six metric cards; no extra `مركز التشغيل الأكاديمي` migration placeholder.

Go `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`
and page owner PR #172 `beed512043a092bf8503a5cb7f3d7d359447eff4`:
- The header always shows a different description across sections.
- An extra overview section `aria-label="مركز تشغيل مدير المدرسة"` shows
  `مركز التشغيل الأكاديمي` and a `قيد النقل` placeholder.
- Existing `organizations-director.spec.ts` explicitly expects the invented
  region to exist, so previous GREEN CI is not a parity certificate.

## Tests / ownership
This stacked test PR adds 9 Playwright acceptance cases (3 original UI
requirements × 390/820/1440 RTL) and this document only. No owned page
or shared test file is edited. Tests are **expected RED**, but classify as
RED VERIFIED only after completed browser run. Owner of page is #172.
Owner action: restore original header text and conditional visibility,
remove invented overview card, update outdated existing E2E assertion,
preserve all six real metrics and original missing functions separately.
Do not change RBAC, scoring, payments or production data.

This tests mocked UI, not real Go/PostgreSQL or paired Legacy screenshots.
Full acceptance still needs role/data matched paired images, HTTP/Go/PG
school membership/assignment/entitlement evidence, save failures, back and
reload. Do not merge RED PR or silently add new UI.
