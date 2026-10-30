# Public static information pages — Legacy parity checkpoint (2026-10-30)

## Source / target
- Read-only Legacy: `nasef6464/almeaacodax@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`, `pages/StaticInfoPage.tsx`.
- Go base: `nasef6464/almeaago@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
- Branch: `codex/public-static-info-legacy-parity-20261030`; Draft PR #240.
- Owner: public site only; no shared header/footer, school, student, admin, scoring, payments, RBAC, schema or production writes.

## Verified code differences before correction
The Go implementation of five static pages used a newly invented outer slate background, rounded white card, different vertical spacing and font weights. It also silently rewrote the Arabic information on contact, FAQ and terms. Legacy is the exact presentation and wording authority, including paragraph text, card order and original back-home action.

## Implementation
- Reuse the Legacy `StaticInfoPage` markup, class names and Arabic copy verbatim for `/about`, `/contact`, `/faq`, `/privacy`, `/terms`, retaining Go's named export expected by `App.tsx`.
- No API/storage path is involved in these read-only pages. Links are React Router navigation, not a mutation.
- Browser acceptance checks exact Arabic headings, subtitles, section order/body, source container/card classes, reload, return navigation, back and RTL horizontal overflow at 390/820/1440.

## RED proof
- Test-first commit `b979dff7ef15c85df9f097f3b4e5d2d56859ddeb`.
- [Frontend E2E RED run 41006770907](https://github.com/nasef6464/almeaago/actions/runs/41006770907): 15 source-backed failures, 136 other passes. All fifteen failed on the absent original outer container. This is a browser test of Go against source-derived assertions, not paired Legacy runtime screenshots.
- [Frontend CI on RED commit](https://github.com/nasef6464/almeaago/actions/runs/41006770906): PASS (typecheck/build); this is not visual parity proof.

## GREEN and outstanding acceptance
- Implementation commit `ed556185f0e5f60dfecea038c3945c514edb347d`.
- Check exact final-head Backend/Frontend/Database/Browser CI before accepting this PR. CI success only proves its scoped tests.
- Browser screenshots are Go-only. Paired Legacy↔Go screenshots with the same browser, data, role and viewport are **NOT PROVEN**.
- Header/footer and dynamic settings are owned by other active PRs; this PR does not certify them.
- Read-only routes have no PostgreSQL write to exercise. Manager homepage settings → visitor consumption is a separate outstanding integration slice owned jointly with the admin team.
- Overall Gate 1 remains **PARTIAL** until header/navigation, homepage/catalog, runtime paired evidence and real admin→visitor persistence are proved. Do not merge, deploy or cut over from this checkpoint alone.
