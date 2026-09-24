# ADR-0006: Frontend Styling Compatibility for Visual Parity

Status: Accepted.

## Decision
ALMEAA V2 keeps the legacy visual utility contract where practical:
- Tailwind CSS 3.4.x compatibility during parity migration.
- Lucide icon semantics where the legacy UI uses them.
- RTL as a first-class document/application mode.
- Existing component proportions, spacing, radius and responsive breakpoints are treated as product behavior.

React/Vite versions may move forward, but visual primitives are not rewritten merely to modernize styling.

## Why
The legacy frontend contains extensive Tailwind utility composition. Translating thousands of utility classes into a new design system before parity is proven would:
- increase visual drift;
- consume development time without product value;
- make screenshot comparison noisy;
- risk mobile regressions.

## Migration rule
First achieve visual/behavioral parity. A future design-system consolidation may happen only as an intentional product/refactor phase with visual regression coverage.

## Constraint
This ADR does not require copying giant legacy components. Components should be decomposed by feature while preserving their rendered appearance and behavior.
