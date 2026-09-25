# Content UI Browser Evidence

Status: **E2E_SETUP_READY / VISUAL_PARITY_NOT_PROVEN**

PR #38 uses a manual Playwright workflow so browser checks do not run on every frontend commit.

Current deterministic checks:
- Admin desktop Content management renders the bounded Course list and opens the real Course curriculum builder.
- Admin mobile keeps Content navigation and Lesson creation reachable.
- Teacher Content page sends no broad Course list request until an exact path and subject are selected.
- API responses are mocked in-browser so the test does not require Vercel, Render, PostgreSQL, R2, Google, or WhatsApp credentials.
- Desktop and mobile screenshots are emitted as the `content-browser-evidence` workflow artifact.

These screenshots are **not** by themselves proof of legacy visual parity. They are implementation evidence only. The Content screens remain `PARITY_NOT_PROVEN` until the generated desktop/mobile images are compared against equivalent legacy ALMEAA states and discrepancies are resolved or explicitly approved.

The workflow is intentionally `workflow_dispatch` only to minimize GitHub Actions use. Run it at meaningful UI checkpoints, not on every commit.
