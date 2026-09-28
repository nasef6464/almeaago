# Smart Classroom / Realtime Integrated Parity Certification

Status: **CERTIFICATION CANDIDATE**

## Source basis
Audited against V2 main and read-only legacy checkpoint `a5bcd4a1b43316d6dfc0c75e7f2d91a2e8d294e9`, especially:
- `docs/architecture/SMART_CLASSROOM_MASTER_SPEC_AR.md`
- `docs/architecture/SMART_CLASSROOM_EXECUTION_MASTER_AR.md`
- `docs/architecture/SMART_CLASSROOM_G6_PILOT_RUNBOOK_AR.md`
- live classroom teacher/student/aggregate/competition routes and classroom socket contracts.

## Already trusted V2 foundation
The merged Smart Classroom domain already owns:
- SchoolContract module gating and Organizations-backed school/class/teacher/student authority;
- exact Question Bank version pins;
- one live session per class;
- PIN join, single/batch publish, revisable open answers, reveal, aggregates and projector state;
- PostgreSQL durable session/response truth with Redis ephemeral multi-instance fanout/presence;
- role-safe student socket events and answer-key secrecy before reveal;
- immutable final report snapshots.

## Source-backed integrated additions

### QR join and reconnect truth
Legacy explicitly supports PIN/QR classroom entry and a reconnect/resume pilot path. V2 now exposes the same six-digit signed PIN through a QR URL. The QR never bypasses authorization: the authenticated student still passes the canonical Organizations school/class membership check. Join source is recorded as `pin | qr | dashboard_cta`. Student refresh/reconnect always reloads selected answers from PostgreSQL; browser state is not authoritative.

### Canonical roster attendance
Attendance is composed against the Organizations-owned active class roster. Joining before the first published question auto-classifies `present`; joining after publishing has begun auto-classifies `late`. A controlling teacher/admin may override `present | late | absent | excused`, including an official roster student who never joined. Arbitrary foreign student IDs fail closed. The immutable final report carries student IDs, join time/method and override evidence, but Realtime does not duplicate student profile/name ownership.

### Timed challenge / deterministic competition
Legacy runtime contains a real timed-challenge contract. V2 adds a bounded 10–600 second timer on the active batch and keeps the server authoritative for expiry. Answers after the server timer ends are rejected. Staff can read a leaderboard calculated only from persisted responses:
- 100 points per correct answer;
- no speed bonus;
- order by correct answers, then answered count, then earlier final submission time.
Student/projector payloads receive only challenge timer state; the student socket still cannot receive response/attendance internals or answer keys before reveal.

## Ownership / privacy boundaries
- Organizations owns roster and teaching/membership authority.
- Question Bank owns canonical question/answer content.
- Realtime pins versions and owns session/distribution/attendance/response/report truth.
- Redis remains ephemeral; PostgreSQL remains durable truth.
- Learning mastery is not mutated from classroom answers in this certification. The legacy execution plan explicitly defers rollup until benchmark evidence.
- exact retention/purge policy is not invented.

## Required closure
The documentation-inclusive exact head must pass Database CI, Backend CI, Frontend CI and Frontend E2E on the same SHA. Browser evidence must cover teacher QR/attendance/challenge, student QR/revision/reconnect, projector QR lobby and platform contract control. Direct legacy-runtime screenshot comparison and production multi-instance/load evidence remain external release evidence.

Status remains TESTED rather than PARITY_PROVEN until the full release-evidence contract is satisfied.
