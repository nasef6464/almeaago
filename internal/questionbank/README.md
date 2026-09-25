# questionbank

Question identity, versions, options, skills, provenance and workflow.

Business logic belongs in this domain. Cross-domain access must use explicit contracts, not arbitrary table access.


## Content and bandwidth rule

A question may be:
- text-only.
- image-only.
- text + image.

Question Bank stores media references/metadata only. Image bytes do not travel through the Go question APIs; Media/R2 owns upload and object delivery.

AI-readiness metadata such as readable text, speech text, visual description, textual option representations, math expressions, concepts and required data belongs in the versioned authoring metadata. This lets AI reason from compact structured/text context instead of repeatedly downloading question images, reducing bandwidth while keeping the original image available when visual inspection is actually required.

Learner projections must never expose answer keys or private AI/source/reviewer metadata.
