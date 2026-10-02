# Exact Legacy UI-7 — Public / Static / Auth

Status: CANDIDATE

Legacy checkpoint read first: fec75f28ec5ddcc63b3f96047099935dd25579db.

## Scope
- Public landing and source-backed static routes: /about, /contact, /faq, /privacy, /terms.
- Authentication entry/recovery routes: /login, /signup, /forgot-password, /reset-password, /verify-email.
- Catch-all 404.
- Compatibility routes are accepted only where the existing route map documents a safe V2 owner destination.

## Proven source-backed fix
Legacy pages/NotFound.tsx exposes both العودة للرئيسية and لوحة التحكم. V2 had only the home action. UI-7 restores the dashboard action without moving auth, data, scoring or authorization authority into the browser.

## Existing evidence
Public landing already has 390 / 820 / 1440 responsive evidence in public-user-workspaces-parity.spec.ts. The route inventory marks the five static pages and the five auth routes as existing V2 routes. AUTH_UI_BASELINE.md preserves the legacy modal/recovery contract.

## Closure gates
Database CI + Backend CI + Frontend CI + Frontend E2E must all pass on the same final documentation-inclusive SHA. Re-read latest Legacy immediately before merge.
