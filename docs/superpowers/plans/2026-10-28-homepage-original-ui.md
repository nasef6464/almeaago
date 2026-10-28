# Original homepage editor and persisted public identity implementation plan

> Execution: native implementation with independent read-only review, under plan03.

Goal: restore original HomepageManager and make saved brand/hero/section presentation reach public visitors through existing content Go/PostgreSQL.
Architecture: reuse source editor, typed catalog/API adapters; shared revision-protected read and successful-save event. No legacy store or business authority copied.
Spec: plan03 Gate1, matrix26 and contract29; original bf7281fc.

- [x] RED API, browser regression suite: original tab loads editor; saved brand reaches guest header and hero after reload; failed save retains draft; nonadmin denied; delayed load cannot overwrite save.
- [x] Reuse original editor/types/sanitizer and original student fields, with Go catalog pagination, real CSRF, explicit catalog-load errors. Retain unavailable dependencies as PARTIAL, never fabricate counts/access.
- [x] Bind public brand/hero/section settings, preserving false/empty/order and existing access checks.
- [x] Real isolated PG browser journey plus source-component screenshot comparison 390/820/1440. Keep whole-header/whole-homepage parity UNKNOWN where untested.
- [ ] Independent review; Go/vet/build/unit/E2E; four exact-SHA CI gates; merge only after passing; document remainder.

Review focus: stale response after save; failed initial load must not permit destructive save; draft while saving; forbidden links; unavailable catalog must not erase stored IDs. No production/source writes.

Ruling: keep unimplemented dependent consumers unavailable and visibly marked rather than claim Gate1 closure. Whole-editor and public-shell layout remain PARTIAL. Isolated JSX source/Go section renderers compare only brand/hero at equal coordinates; actual save/guest routes are tested separately. Initial full-editor-position screenshot mismatch remains recorded in doc30; no masks or tolerance.
