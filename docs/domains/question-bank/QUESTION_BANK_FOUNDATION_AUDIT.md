# Question Bank Foundation Audit

Status: schema audit complete; integrity/index patch proposed in migration 000011.

The normalized PostgreSQL foundation was compared with docs/blueprint/03_QUESTION_BANK_SKILLS_AR.md. This checkpoint does not translate legacy Mongoose models or copy embedded arrays.

## Already aligned
- Stable question UUID plus unique public question code.
- Versioned content in question_versions.
- Normalized options and relational skill links.
- Asset references instead of image bytes.
- Workflow state separate from version content.
- Skill-first index for coverage/filter joins.

## Gaps addressed by 000011
- Enforce question code immutability in PostgreSQL.
- Require current_version to resolve to a real version at transaction commit with a deferred composite foreign key.
- Reject negative option/answer indexes.
- Apply a broad source-year sanity bound without inventing exam policy.
- Add narrow workflow, owner, filter, and question-first skill indexes.

## Deliberate non-decisions
MCQ/true-false cardinality, exact difficulty/source vocabularies, taxonomy hierarchy validation, search indexing, coverage caching, deletion policy, and asset orphan cleanup remain application/domain concerns or later evidence-backed schema work. Search indexes should follow the implemented query contract and measurements rather than indexing large historical text blindly.

## Next API invariants
Create identity, version 1, options, and skill links atomically. Question code is create-only. Learner-visible edits create versions rather than rewriting history. Publishing validates taxonomy and answer/content rules. Learner DTOs must not expose answers or private review/AI/source data before policy permits. Lists stay bounded and select only required columns. Coverage counts distinct question IDs. Media uploads remain direct-to-R2/content-addressed.

## Verification target
Run migration apply, verification, rollback, and re-apply on PostgreSQL 18 in the existing Database gate before merge. Backend API work begins only after this schema checkpoint is green.
