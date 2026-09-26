# learning

Progress, mastery, evidence, review, study plans and adaptive actions.

Business logic belongs in this domain. Cross-domain access must use explicit contracts, not arbitrary table access.


## Current foundation checkpoint

The first implemented Learning slice owns:
- idempotent Assessment submission evidence application;
- materialized learner/skill mastery;
- canonical learner/question ReviewCards;
- bounded review/mastery reads;
- deterministic next-action policy.

Assessment remains scoring/result authority. Question Bank remains review-question content authority. Learning receives explicit contracts; it does not become a second Assessment or Question Bank repository.
