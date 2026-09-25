# assessment

Assessment owns definition/version/distribution/attempt/result semantics.

Canonical boundaries:
- definitions and immutable version composition live here.
- questions remain owned by Question Bank and are referenced by stable ID + exact version.
- learning placements reference Content locations but do not copy Content payloads.
- assignment audiences reference Organizations users/classes and must be scope-authorized by the application layer.
- entitlement/access remains Commerce authority.
- live socket/presence coordination remains Realtime authority.
- mastery/review side effects remain Learning authority.

Normal lists and relationship selection must be bounded. Attempt autosave is latest-state/idempotent, submit/scoring is server-owned, and pre-submit APIs must never expose answer keys or private explanations.

See `docs/domains/assessment/ASSESSMENT_FOUNDATION_AUDIT.md`.
