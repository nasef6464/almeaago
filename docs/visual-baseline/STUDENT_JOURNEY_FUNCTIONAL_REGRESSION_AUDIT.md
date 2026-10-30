# Student Journey Functional Regression Audit — Learning Entry

Status: **REGRESSION AUDIT CANDIDATE — EXACT-HEAD FOUR-GATE VERIFICATION PENDING**

## Identity
- Repository: `nasef6464/almeaago`.
- Base: UI-5 closure merge `4b8e220a2205269b2dd37cc5afbcddfd3a5bb651`.
- Latest legacy checkpoint read before this audit: `d4e5c831b632447e8b25009ffc17fee2076c67e5`.
- Legacy remains read-only.

## Proven test weakness fixed
The previous dashboard evidence asserted that the learner Learning link existed, and the Learning CTA evidence asserted only its `href`. Those checks could stay green even if navigation or the destination runtime regressed.

This audit strengthens the browser contract without weakening V2 authority:
- the dashboard Learning entry is clicked and must reach the real `/learning` workspace;
- canonical Path/Subject selection must render real mocked V2 learning-space content;
- the course start CTA is clicked rather than inspected only as an attribute;
- the legacy-shaped course player, selected lesson heading and video element must render after navigation.

No backend, schema, RBAC, CSRF, scoring or data-authority behavior changes in this slice.

## Next audit steps
Continue the same click-through rule across Assessments, Review, Plan, Results, Reports and Notifications. Re-open presentation code only when a concrete visual/functional regression is demonstrated. Learning/Course Player visual differences must be compared against exact legacy source before any presentation change.

## Merge rule
Database CI + Backend CI + Frontend CI + Frontend E2E must all pass on the same final documentation-inclusive SHA, followed by a latest-Legacy re-check.
