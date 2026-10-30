# Director student class move — PostgreSQL concurrency checkpoint

Date: 2026-10-30. Draft PR #220.

Legacy reference (read only): nasef6464/almeaacodax main bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7.
Go baseline: nasef6464/almeaago main 98b0f6d9ad0bba031936d950d087c0bd3d19b7bb.

Journey: School director → student roster → change class → existing HTTP PUT director school student class endpoint → organizations application → PostgreSQL class_memberships.

The existing read-committed update/insert sequence allowed two simultaneous moves of one student to different classes to leave two active memberships in the same school. The new repository regression reproduces this on isolated real PostgreSQL.

RED commit: 51a3d879c1803a674e08c3126210e9ef8e34cf3f; CI run 40988364537; active count was 2 instead of 1.
GREEN commit: d0eca2b2ddf669b4362225fe81b373b3ee225f76; CI run 40988515324; the same PostgreSQL regression passed.

Fix: lock the stable student user row in the transaction before modifying class memberships. The director move obtains this lock before evaluating whether a move is idempotent. The regression checks that the final class is unique and another school's class membership remains unchanged.

VERIFIED: database-level concurrent class move and unrelated school membership preservation.
PARTIAL: complete UI-to-HTTP-to-PostgreSQL-to-browser reload journey.
NOT PROVEN: visual parity with Legacy at RTL 390/820/1440, HTTP failure draft retention and real-role authorization.
Next: owner of director page #172 must restore original roster UI according to #208 without editing this backend branch; then run same-role paired screenshots and HTTP persistence checks.

No production or Legacy writes, merge, deploy or permission-policy changes.
