# realtime

Smart Classroom realtime lifecycle and durable session state.

Business logic belongs in this domain. Cross-domain access uses explicit owner contracts:
- Organizations owns SchoolContract, school/class/teacher/student scope and roster truth.
- Question Bank owns canonical versioned questions and private answer keys.
- Realtime owns classroom lifecycle, attendance/response facts, WebSocket protocol and final report snapshots.

PostgreSQL is durable truth. Redis is restricted to short-lived presence and cross-instance event fanout.

See `docs/domains/realtime/SMART_CLASSROOM_AUDIT.md` for the phase contract and explicit deferrals.
