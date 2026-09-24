# ALMEAA V2 — almeaago

Clean rebuild of the ALMEAA education platform from a verified product blueprint.

## Approved stack
React + TypeScript · Go · PostgreSQL · Redis · Cloudflare R2 · OpenAPI · WebSocket · Modular Monolith.

## Repositories
- New implementation: `nasef6464/almeaago`
- Legacy behavioral/visual reference only: `nasef6464/almeaacodax`

## Non-negotiable rules
- Preserve functional, role, data and visual parity unless a change is explicitly approved.
- One stable question identity; assessments, review and remediation reference it instead of cloning it.
- School membership is separate from learning entitlement.
- Durable relationships use relational tables, not unbounded arrays on users.
- Large media lives in R2; PostgreSQL keeps metadata and references.
- Growing collections are paginated/bounded from the first endpoint.
- Sensitive commands are idempotent and audited.
- Server-side authorization is mandatory.
- AI is never the source of truth for scoring or deterministic mastery.
- CI/Vercel/Render/DB/bandwidth/AI consumption is budgeted.
- A feature is complete only at `PARITY_PROVEN`.

## Start here
1. `docs/CURRENT_STATE.md`
2. `docs/PROJECT_EXECUTION_PLAN_AR.md`
3. `docs/architecture/PROJECT_MAP.md`
4. `docs/architecture/VISUAL_PARITY_POLICY.md`
5. `docs/architecture/RESOURCE_BUDGET_POLICY.md`
6. `docs/blueprint/00_MASTER_INDEX_AR.md`
