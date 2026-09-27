# Organizations / Schools / Classes Parity Certification

Status: **TESTED — INTERNAL PARITY EVIDENCE GREEN / DIRECT LEGACY SCREENSHOT COMPARISON PENDING**

## Source basis

This batch reconciles the V2 Organizations domain against:
- the current ALMEAA Product Blueprint ownership model for schools, memberships, classes and teaching assignments;
- the legacy Account Workspaces G9–G12 evidence, especially the school-director workflow;
- the legacy `SchoolDirectorDashboard` observable states and delegated student/class/teacher operations;
- the existing V2 Organizations, Reporting, Learning and Realtime ownership boundaries.

The legacy repository remains read-only evidence.

## Internal gaps closed

### Director workspace

`/school-director-dashboard` is no longer a placeholder. It now provides:
- active school-admin context selection only;
- explicit no-delegated-school state;
- permission-aware school summary;
- bounded student list/search;
- add student;
- idempotent same-school class move;
- basic student edit and reversible activate/deactivate controls;
- class create/rename;
- teacher assignment;
- desktop and mobile RTL browser evidence.

No student hard-delete action is exposed.

### Contract-aware delegated core tools

Canonical school context now includes the active valid contract modules for the school.

The optional Organizations-owned delegated capabilities:
- `SCHOOL_STUDENTS_UPDATE_BASIC`
- `SCHOOL_STUDENTS_DEACTIVATE`
- `SCHOOL_CLASSES_MANAGE`
- `SCHOOL_TEACHERS_ASSIGN`

require both their explicit membership permission and an active valid `SCHOOL_CORE` module when authorization is resolved through `HasSchoolPermission`.

The UI uses the same permission + module pair before displaying those optional controls.

The legacy/basic student capabilities `SCHOOL_STUDENTS_VIEW`, `SCHOOL_STUDENTS_ADD` and `SCHOOL_STUDENTS_MOVE_CLASS` retain their existing permission semantics; this batch does not invent a new module requirement for them.

## Ownership boundaries preserved

- Organizations remains canonical for schools, memberships, permissions, classes and teaching assignments.
- Identity remains canonical for account/login state.
- Reporting remains owner of report composition/export.
- Assessment, Realtime and Learning keep their own school-scoped academic operations.
- This page links to those owner-domain surfaces rather than copying their business state into Organizations.
- Contract module projection is read-only evidence for the workspace; it does not create duplicate entitlement truth.

## Security and parity evidence

Source-backed negative behavior remains:
- school-admin operations require an active exact-school membership;
- permission revoke fails closed on the next server request;
- cross-school student operations stay rejected by repository/application guards;
- same-class move is idempotent;
- no student hard-delete endpoint exists;
- optional core controls require the active `SCHOOL_CORE` contract module in addition to permission.

## External evidence still required before PARITY_PROVEN

Repository CI can capture deterministic V2 desktop/mobile screenshots, but a direct side-by-side pixel comparison still requires the legacy runtime to be available in the evidence environment.

This batch therefore targets **TESTED**, not `PARITY_PROVEN`.

## First integrated exact-head verification

Integrated implementation head `6048bd10513d025bef336c6c052d2752904bc87d` passed all four gates:
- Database CI `36311795047`: PASS — full migration apply, delegated school permission/contract schema assertions, rollback and re-apply.
- Backend CI `36311794976`: PASS — module lock, sqlc compile, gofmt, go vet and Go tests.
- Frontend CI `36311795033`: PASS — typecheck and production build.
- Frontend E2E `36311795015`: PASS — **54/54 browser tests**, including all four Organizations director parity journeys.

Browser evidence:
- artifact `content-browser-evidence` id `10929725060`.
- digest `sha256:209817f3ff2506e0fa4cab74b97889418d8eea80d8c7592cf8d4dc8ddb08e621`.
- director screenshots include desktop operational workspace and mobile no-delegation state.

The first E2E attempt exposed only a notification-state bug in the new page: the generic operation wrapper cleared the operation-specific success message after add/move. The wrapper was corrected without changing authorization or data behavior, then the full suite reran green.

The documentation-inclusive final PR head must rerun the same four gates before merge.
