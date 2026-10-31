# media

Asset metadata, signed direct uploads, storage-provider lifecycle and deduplication.

## Cloudinary staging option

Set `MEDIA_STORAGE_PROVIDER=cloudinary` explicitly, together with server-only
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.
Without that switch, the original R2 behavior stays active. Never expose the
Cloudinary API secret in the frontend or commit it to GitHub.

The Go server signs a multipart **POST** for Cloudinary's upload API, binding
the hash-addressed public ID and declared SHA-256 as signed contextual metadata.
The authenticated teacher's browser uploads bytes directly to Cloudinary.
On completion, Go fetches resource size, format, and signed hash metadata via
Cloudinary Admin API and applies the existing PostgreSQL activation checks.
As with R2's signed `x-amz-meta-sha256`, the stored hash is metadata supplied
by the browser, not an independently recomputed digest of remote bytes.
The signed request constrains the accepted extension via `allowed_formats`;
audio verification additionally requires an audio track and rejects video
tracks. Existing pending uploads reserved under a different provider must be
restarted, never completed against the new provider.

Images use Cloudinary's `image` delivery resource and explanation audio uses
`video`; image/public URL paths remain immutable and hash-addressed. This
path does not require Cloudflare R2 activation or a payment method.

**Free-tier safeguards:** Go's completion window is 15 minutes, but a signed
Cloudinary upload timestamp can remain acceptable to Cloudinary for about an
hour. Signed browser uploads have no enforceable per-file byte limit at the
Cloudinary upload endpoint, so orphan uploads could consume free-tier quota.
Use staging-scoped credentials, monitor quota, and rotate exposed credentials.

Business logic belongs in this domain. Cross-domain access must use explicit contracts, not arbitrary table access.


## Direct upload contract

1. Authenticated staff asks Media for a short-lived upload target.
2. Media validates MIME, declared size, SHA-256 and purpose.
3. A `pending_upload` asset is reserved in PostgreSQL.
4. The browser uploads bytes directly to R2 (PUT) or Cloudinary (signed multipart POST); bytes never pass through the Go API.
5. The client calls completion.
6. Media performs an authenticated provider metadata check and verifies size, MIME and signed SHA-256 context.
7. Only then does the asset become `active` and usable by Question Bank.

Hash-addressed question images use:
`questions/v2/{QUESTION_CODE}/{SHA256}.{ext}`

Verified live hashes are deduplicated. Hashed immutable objects receive long CDN cache metadata. Provider secrets never leave the backend.
