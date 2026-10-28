# Learning source golden implementation plan

**Goal:** Execute pinned source policies and test shared Go behavior without changing runtime policy.
**Spec:** docs/migration/22_LEARNING_SOURCE_GOLDEN_AR.md and existing platform pedagogical design.
**Constraints:** source read-only, exact source blobs, no production data, no thresholds/API changes.
**Review Focus:** fractional boundaries; source provenance; fixture drift; no false adaptive equivalence; Node22 CI compatibility.

### Task 1: Reproducible source oracle and shared policy guard
- [x] Pin original TS source byte-for-byte and generate 51 shared/12 adaptive observations.
- [x] Test rejection of bad/missing fixture RED→GREEN.
- [x] Compare actual Go functions to source oracle, run full Go and parity tests.
- [x] Document cross-layer mapping and unknown denominator/rounding/adaptive boundaries.
- [ ] Independent branch review, PR and exact-head four-gate CI; record actual outcomes in PR.
