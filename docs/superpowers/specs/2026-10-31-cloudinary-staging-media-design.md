# Cloudinary media option for isolated ALMEAA Go staging

## Intent and constraints

Use the owner's new, free Cloudinary product environment for question-bank media in the **isolated almeaago staging stack**, without changing the legacy almeaacodax deployment, uploading bytes through the Go API, exposing Cloudinary secrets to browsers, or weakening the existing media activation rules.

Keep Cloudflare R2 as a selectable provider for compatibility. Require an explicit `MEDIA_STORAGE_PROVIDER=cloudinary` switch so that setting secrets alone cannot silently change existing deployments. No production deployment or database migration is authorized.

## Approaches

- **Chosen: signed, direct Cloudinary browser POST**. The Go backend signs the fixed media key, expected SHA-256 as Cloudinary context, and short-lived timestamp. Browser submits the file directly to Cloudinary; completion uses authenticated Admin API metadata. This preserves direct-upload architecture and existing PostgreSQL pending/active flow. Cloudinary cannot independently calculate SHA-256 from its metadata; the signed context proves only that metadata was fixed by the backend, matching the R2 contract's signed client-provided SHA-256 metadata (not a byte-level recomputation).
- **Rejected: upload through Go backend**. Simpler but doubles transit and violates the documented no-binary-through-API constraint, adding Render free-tier pressure.
- **Rejected: Cloudinary unsigned upload preset**. Cannot securely bind the teacher's requested question/hash metadata to a specific asset.

## Interfaces and acceptance

`media.UploadTarget` can carry optional HTTP method and signed form fields; existing R2 response retains its PUT/header compatibility. The question-bank browser uploader must handle both PUT and POST. The Cloudinary adapter must reject unsupported keys, build signatures without leaking secrets, use Cloudinary's HTTPS URLs, and retrieve verified size/MIME/signed context via authenticated resource lookup. Image formats jpeg/png/webp and audio mpeg/mp4/webm/ogg remain supported.

Go unit/HTTP contract tests, frontend build and a staging-only Cloudinary tiny-image canary are required before setting the Render `MEDIA_STORAGE_PROVIDER` switch. No production deploy and no legacy writes. If any check fails, leave the switch unset and report a precise checkpoint.
