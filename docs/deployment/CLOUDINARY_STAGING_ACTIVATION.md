# Cloudinary staging activation for ALMEAA Go

Status: deployment configuration prepared; live provider activation still requires staging-only Cloudinary credentials and a successful canary.

## Scope

This applies only to `nasef6464/almeaago`.
The legacy `nasef6464/almeaacodax` deployment is read-only and must not be changed.

## Deployment contract

The Go API supports both R2 and Cloudinary. The staging Render blueprint now selects:

`MEDIA_STORAGE_PROVIDER=cloudinary`

Required server-only variables:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

The API secret must never be committed, exposed through Vite, returned by an HTTP endpoint, or copied into browser storage.

R2 support remains in code as a fallback/provider option, but the staging blueprint does not activate it while Cloudinary is selected.

## Direct upload flow

1. Authenticated staff requests a bounded media upload target from Go.
2. Go validates purpose, MIME, declared size and SHA-256.
3. PostgreSQL reserves a pending media asset.
4. Go signs a Cloudinary multipart POST with the immutable hash-addressed public ID and signed SHA-256 context.
5. The browser uploads directly to Cloudinary. Binary bytes do not pass through the Go API.
6. The browser asks Go to complete the upload.
7. Go reads Cloudinary resource metadata through the authenticated Admin API and verifies size, format and signed SHA context.
8. The PostgreSQL asset becomes active only after the provider verification succeeds.

## Staging canary

After dedicated staging Cloudinary credentials are configured on the actual `almeaago-api` service, run:

```bash
CLOUDINARY_CLOUD_NAME=... \
CLOUDINARY_API_KEY=... \
CLOUDINARY_API_SECRET=... \
go test -tags=cloudinarylive ./internal/media/provider/cloudinary \
  -run 'TestLiveSignedCloudinary(StagingCanary|AudioCanary)$' \
  -count=1 -v
```

The canary uploads tiny temporary assets, verifies them through the Cloudinary Admin API, and removes the exact canary objects after verification.

## Acceptance before calling Cloudinary active

- Cloudinary image canary passes.
- Cloudinary audio canary passes when ffmpeg is available.
- Go media provider tests pass.
- Frontend question-bank direct upload handles signed POST.
- Database CI, Backend CI, Frontend CI and Frontend E2E are green on the same documentation-inclusive SHA.
- A real staging question image upload survives reload and resolves through the stored media reference.
- No Cloudinary secret appears in frontend bundles, logs, Git history or browser storage.
- The legacy deployment and its R2 objects remain untouched.

## Current external blocker

The connected Render workspace visible to this ChatGPT session does not currently expose the `almeaago-api` service declared by `render.yaml`. Therefore repository configuration can be prepared and verified here, but the three Cloudinary secrets cannot be installed on the actual live service from this connection until that service/workspace is connected or those variables are entered directly in its hosting dashboard.
