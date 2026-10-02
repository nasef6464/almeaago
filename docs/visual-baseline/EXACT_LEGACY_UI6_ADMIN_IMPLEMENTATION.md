# Exact Legacy UI-6 Admin / Control Panels — Implementation Certificate

Status: **IMPLEMENTATION CANDIDATE — EXACT-HEAD FOUR-GATE VERIFICATION PENDING**

## Identity
- Phase: UI-6 Admin/control panels.
- V2 base: UI-5 closure merge `4b8e220a2205269b2dd37cc5afbcddfd3a5bb651`.
- Latest legacy main read first: `d4e5c831b632447e8b25009ffc17fee2076c67e5`.
- Primary shell source: `dashboards/admin/AdminDashboard.tsx`.
- Supporting protected legacy sources read: CoursesManager, PathsManager, LessonsManager, LibraryManager, SkillsTreeManager, QuestionBankManager, QuizzesManager, FinancialManager, NotificationsManager, LiveSessionsManager, AiAssistantManager, OperationsCommandCenter and `pages/Reports.tsx`.

## Official UI-6 route inventory
The authoritative transplant plan lists:
- Admin shell → `/admin-dashboard`;
- Content → `/admin-dashboard/content`;
- Taxonomy → `/admin-dashboard/taxonomy`;
- Question Bank → `/admin-dashboard/questions`;
- Assessment → `/admin-dashboard/assessments`;
- Commerce → `/admin-dashboard/commerce`;
- Notifications → `/admin-dashboard/notifications`;
- Classroom contracts → `/admin-dashboard/classroom`;
- AI → `/admin-dashboard/ai`;
- Reports → `/admin-dashboard/reports`;
- Operations → `/admin-dashboard/operations`.

All eleven destinations are real V2 routes; none is a placeholder.

## Source-backed shell fix
The V2 shell already reproduces the Legacy white/amber admin identity and `لوحة الإدارة / التحكم الكامل بالمنصة` hierarchy. This slice:
- restores the Legacy dashboard icon identity for overview;
- gives the sidebar an explicit accessible admin-navigation landmark;
- certifies every official UI-6 destination in the mobile drawer and desktop sidebar.

No legacy browser state/store is reintroduced.

## Owner-domain authority retained
Each control panel continues to use its canonical V2 client/API, server authorization and CSRF where writes exist. The slice does not combine domain truth in React and does not reactivate Legacy-only managers without a V2 owner route.

## Existing functional evidence exercised by the full E2E gate
- Content: `content-management.spec.ts`.
- Taxonomy: `taxonomy-admin.spec.ts`.
- Question Bank: `question-bank-admin.spec.ts`.
- Assessment: `assessment-management.spec.ts` + session/placement coverage.
- Commerce: `commerce-checkout.spec.ts` + foundation coverage.
- Notifications: `notifications.spec.ts`.
- Classroom contracts/realtime: `classroom.spec.ts`.
- AI: `ai-assistant.spec.ts` + question-assistant coverage.
- Reports/Operations: `reporting-operations.spec.ts`.
- Admin shell: new responsive navigation proof at 390px and 1440px.

## Merge gate
The exact documentation-inclusive head must pass Database CI, Backend CI, Frontend CI and Frontend E2E. Latest Legacy must be re-checked immediately before merge. If green and unchanged, UI-6 may close as one protected phase because every official control-panel surface is a real route with domain-specific E2E.
