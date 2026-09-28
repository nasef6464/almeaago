# Foundation Learning / Content Parity Certification

Status: **INTERNAL CERTIFICATION CANDIDATE**

## Source-backed scope
This checkpoint audits the normalized V2 Content implementation against the observable legacy Course, Foundation and Library learning-space behavior while retaining V2 owner-domain boundaries.

Legacy evidence reviewed at read-only reference commit `8724cd5081df75487e3207bf844e6db470fe0eda` includes:
- `dashboards/admin/FoundationManager.tsx` and `LibraryManager.tsx`;
- `scripts/smoke-library-support-contract.mjs`;
- `scripts/smoke-foundation-course-details-contract.mjs`;
- `utils/learningSpaceTabs.ts`.

## Certification scope
- existing staff Course/Lesson/Foundation/Library management remains canonical and bounded.
- a real authenticated learner `/learning` surface now consumes the existing bounded `/api/v1/learning-spaces/{pathId}/subjects/{subjectId}` projection.
- learner tabs preserve the observable product vocabulary: Courses, Foundation and Library.
- the browser does not load full Content inventories to compose the learner page.
- Course opening continues through `/learning/courses/:courseId`, where Commerce remains the server-side access authority.
- Foundation and Library lock metadata is displayed but never promoted by the browser into an access grant.
- Taxonomy remains the path/subject authority; Content stores references.
- Assessment placements, Media binary lifecycle, Commerce entitlement and Learning progress remain in their owner domains.

## Intentional non-parity
Legacy browser-side full-inventory filtering, direct Content-owned purchase authority, embedded assessment/question payloads, destructive deletes, and automatic mutation of attached content during Foundation preparation are not copied. V2 uses normalized relational references and owner-domain server authorization.

## Required exact-head gates
Before merge, the documentation-inclusive PR head must pass Database CI, Backend CI, Frontend CI and Frontend E2E. Deterministic browser evidence must include the learner mobile learning-space journey. Direct legacy-runtime side-by-side screenshots remain external visual evidence and do not become a fake `PARITY_PROVEN` claim.
