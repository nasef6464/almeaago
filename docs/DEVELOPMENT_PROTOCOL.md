# Development Protocol

## Before work
1. Read CURRENT_STATE.md.
2. Read WORKING_SET.md.
3. Read relevant blueprint/domain docs.
4. Identify exact domain owner.
5. Define tests and parity evidence before implementation.

## During work
- Keep business logic out of HTTP handlers.
- No cross-domain arbitrary SQL.
- No new dependency without a reason.
- No hidden schema changes; migrations only.
- No new external service just to simplify local development.
- No Vercel/Render deploy for routine code edits.
- Prefer one coherent commit/PR over noisy micro-pushes.

## After work
- Run targeted tests first.
- Run required CI gate once.
- Update CURRENT_STATE + PARITY_MATRIX + WORKING_SET.
- Record the next exact action.
- Do not call a feature complete without evidence.

## Debugging rule
Every production bug should map to:
Domain -> application/service -> repository/infrastructure -> transport/UI.
If ownership is unclear, fix the architecture boundary rather than adding a random workaround.
