# media

Asset metadata, presigned uploads, R2 lifecycle and deduplication.

Business logic belongs in this domain. Cross-domain access must use explicit contracts, not arbitrary table access.


## Direct upload contract

1. Authenticated staff asks Media for a short-lived presigned PUT.
2. Media validates MIME, declared size, SHA-256 and purpose.
3. A `pending_upload` asset is reserved in PostgreSQL.
4. The browser uploads bytes directly to R2; image/audio bytes never pass through the Go API.
5. The client calls completion.
6. Media performs an authenticated R2 HEAD and verifies size, MIME and the signed `x-amz-meta-sha256`.
7. Only then does the asset become `active` and usable by Question Bank.

Hash-addressed question images use:
`questions/v2/{QUESTION_CODE}/{SHA256}.{ext}`

Verified live hashes are deduplicated. Hashed immutable objects receive long CDN cache metadata. R2 credentials never leave the backend.
