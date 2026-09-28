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

## Implementation checkpoint
Implementation head `eeea9ef2ee57ba1b0768ee6cefbd351da513f19b` passed Frontend CI `36371070686` and Frontend E2E `36371070688` (62/62). Browser evidence artifact `10949063460`, digest `sha256:4b8dad84f2c1b894406bc44bbd73da446a549d9af04a16aacbd70c522eb6b682`.

The first E2E attempt exposed only a deterministic test setup issue: URL query initialization raced with the taxonomy bootstrap. The test was corrected to select the canonical path/subject through the UI; runtime authorization or product behavior was not weakened.

## Final certification evidence
Final documentation-inclusive head `ddf8961c606b8f9d3184997cc655f6be2cf3bae5` passed Frontend CI `36371378688` and Frontend E2E `36371378748` (62/62). Final browser evidence artifact `10949426615`, digest `sha256:c731b5c03f32a9dc8c61c23775e1d5a5f6c19877077c198bf5440d724c1b6375`. PR #74 squash-merged as `2596e564854edf41e296998b0b641161d1d60a16`.
