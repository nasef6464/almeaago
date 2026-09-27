# Smart Classroom / Realtime Audit

Status: **TESTED / MERGED**

## Source-backed product contract
The target blueprint assigns Realtime ownership of:
- Smart Classroom live lifecycle.
- WebSocket protocol and presence.
- durable classroom sessions, participants, batches, responses and report snapshots.
- canonical Question Bank consumption rather than copied/question-authoritative payloads.
- Organizations-owned school/class/teaching and roster scope.
- Redis for short-lived realtime state/fanout while PostgreSQL remains durable truth.

The verified legacy implementation additionally establishes:
- lifecycle `draft | scheduled | live | ended | archived`.
- school module entitlement `SMART_CLASSROOM` through an active SchoolContract validity window.
- six-digit PIN join with a 30-minute expiry and hashed server storage.
- student join only while the session is live.
- bounded initial question selection of at most 30.
- bounded appended batches of at most 20.
- `single | batch` publish modes.
- latest answer revision while the question remains open.
- answer-key/explanation reveal controlled by the teacher.
- final attendance/response report snapshot.

## Module boundaries
### Organizations owns
- SchoolContract lifecycle and enabled school modules.
- school/class validity.
- teaching assignments.
- active school/class student roster.
- supervisor/school-admin classroom read scope.

Realtime asks Organizations through narrow methods and does not query Organizations tables directly.

### Question Bank owns
- approved current question discovery.
- exact versioned question/options/skill facts.
- private correct option and explanation.

Realtime persists only exact `question_id + question_version` references and presentation lifecycle. Question Bank resolves the server-owned correct key for scoring. Learner responses never receive private Question Bank authoring metadata.

### Realtime owns
- classroom sessions.
- batches and exact pinned question ordinals.
- participants/attendance overrides.
- latest student responses.
- live aggregate queries.
- immutable final report snapshots.
- WebSocket fanout/presence protocol.

## SchoolContract
Migration `000036_realtime_smart_classroom` introduces normalized:
- `school_contracts`.
- `school_contract_modules`.

The module catalogue preserves the verified legacy module codes including `SMART_CLASSROOM`.

A normal teacher/student classroom path fails closed unless:
- the school is active.
- the contract is active.
- current time is within optional `valid_from/valid_until`.
- `SMART_CLASSROOM` is enabled.

Platform admins manage this contract through `/api/v1/school-contracts/{schoolId}` with CSRF and optimistic `expectedRevision`.

## Durable classroom model
The migration adds:
- `classroom_sessions`.
- `classroom_batches`.
- `classroom_questions`.
- `classroom_participants`.
- `classroom_responses`.
- `classroom_report_snapshots`.

Important invariants:
- at most one live session for the same school/class.
- session questions pin an exact Question Bank version.
- the same question cannot appear twice in one session.
- responses have one latest row per session/question ordinal/student, enabling pre-reveal revision without unbounded row growth.
- response rows require a joined participant.
- report snapshots are immutable through a database trigger.
- active batch/question pointers reference rows belonging to the same session.

No unbounded participant/answer/question arrays are stored inside a session record.

## Teacher authority
A non-admin teacher may create/control a session only when:
- their user account and teacher school membership are active.
- the class belongs to the same active school.
- an active teaching assignment covers the exact class and subject.
- the school's current Smart Classroom contract is enabled.

The question picker is scoped by the same school/class/subject authority before the canonical Question Bank read.

## Student authority
A student can join only when:
- the session is live.
- the PIN is valid where PIN join is used.
- the school contract still permits Smart Classroom.
- Organizations confirms active student school membership and active class membership for the exact school/class.

Join is idempotent and creates the durable participant/attendance fact.

## PIN security
- six decimal digits are generated cryptographically.
- plaintext is returned only on create.
- PostgreSQL stores HMAC-SHA256 only.
- `CLASSROOM_PIN_SECRET` is required configuration.
- PIN expiry is 30 minutes.
- PIN lookup is restricted to still-live sessions with future expiry.

The browser may retain the one-time PIN in same-session `sessionStorage` to populate the teacher-opened projector window. It is not re-read from the database.

## Question lifecycle and answer secrecy
Question selection:
- approved current Question Bank questions only.
- MCQ/true-false only in this slice.
- exact subject match.
- initial selection: 1–30.
- appended batch: 1–20.
- exact current version is pinned at selection time.

Student/current and projector projections:
- include only the currently published question or active batch.
- omit correct option and explanation before reveal.
- include correct option/explanation only after the teacher reveal transition.

Answer writes:
- joined student only.
- live session only.
- currently published question/batch only.
- rejected after reveal or batch end.
- latest selection may replace the previous selection while open.
- selected option is range checked.
- correctness is calculated server-side from the pinned Question Bank version.
- the answer response does not return correctness.

## Attendance
Joining records `present`.

The assigned teacher may explicitly override attendance to:
- `present`.
- `late`.
- `absent`.
- `excused`.

Overrides are audited. Redis presence is never used as durable attendance truth.

## Realtime transport
The WebSocket endpoint authenticates and authorizes before upgrade.

On connect/reconnect:
- one role-safe snapshot is sent.

Afterward:
- Redis Pub/Sub carries compact lifecycle/presence deltas.
- a student receives only safe lifecycle/presence event types; response/participant detail events are not forwarded to student sockets.
- presence is stored as an expiring Redis sorted-set member with a 45-second expiry horizon and refreshed every 20 seconds.
- disconnect removes the local presence member where possible.
- PostgreSQL remains the source for durable session/participant/response/report state.

The React client also uses bounded HTTP refresh as a reconnect/failure fallback. The socket is acceleration, not a second durable state engine.

## Final report
Ending a live session:
- uses the current canonical Organizations roster.
- closes started batches.
- clears active live pointers.
- transitions the session to ended.
- writes one immutable report snapshot.

The snapshot contains:
- expected/joined/absent-from-session counts.
- per-question answered/correct/wrong/unanswered counts.
- option distribution.
- batch totals and accuracy.
- overall response/correct totals.
- timing facts where available.

No competition score, speed bonus, grade, mastery mutation or AI interpretation is invented by this report.

## UI
Implemented screens:
- teacher Smart Classroom workspace at `/school-teacher-dashboard`.
- student PIN join at `/classroom/join`.
- student live room at `/classroom/{sessionId}`.
- teacher/projector view at `/classroom/{sessionId}/projector`.
- platform-admin Smart Classroom SchoolContract module control at `/admin-dashboard/classroom`.

The teacher UI consumes the canonical Organizations teacher workspace and exact subject assignment rather than client-supplied authority.

## Deliberate exclusions
Not invented in this slice:
- timed challenge/competition scoring or speed bonuses.
- automatic mastery/Review evidence writes from classroom responses.
- anonymous/guest classroom participation.
- cross-school public PIN access.
- automatic attendance based only on socket presence.
- durable Redis state.
- arbitrary client Question payloads/correct keys.
- reconnect rules that change response authority.
- school contract limits beyond the source-backed module/validity model.
- retention/purge duration for classroom response history.

These remain later policy/evidence work if required.

## Verification checkpoint
- PR #65 merged from exact tested head `a84c389a383991f3f53002bf1199825f95fca3b7`.
- squash merge commit: `ac4310da776abe64762b3b1a46bfd413e1b8b56d`.
- Database CI `36299477569`: PASS — all migrations applied; classroom/contract tables, indexes, foreign-key invariants and immutable report trigger verified; every migration rolled back and re-applied.
- Backend CI `36299477645`: PASS — module lock, sqlc compile, gofmt, go vet and all Go tests.
- Frontend CI `36299477556`: PASS — TypeScript typecheck + production build.
- Frontend E2E `36299477576`: PASS — all 39 browser tests, including platform SchoolContract control, teacher create/start/publish/reveal/finalize and student PIN/join/answer mobile journeys.
- browser evidence artifact `content-browser-evidence` id `10924508359`, digest `sha256:3fb9e6394a294e9cc76bd9f346abeb357d0f970de7b50d0bd8d9827b2eebf83a`.
- early Backend runs exposed gofmt-only differences and a duplicate `Presentation` declaration; both were corrected without weakening behavior.
- early browser runs exposed malformed URL-regex syntax and a literal `+` locator bug. Artifact evidence showed the question was rendered correctly, so the test locator was corrected rather than changing product behavior. The question-picker route mock was also aligned with the actual query family.
- all four required gates then reran green on the exact final head.
