# ADR-0003: Object Storage for Media
Status: Accepted.

Question images, audio and large files live in Cloudflare R2/object storage. The DB keeps metadata/references. Direct presigned upload minimizes API bandwidth.
