# Resource Budget Policy

## GitHub Actions
- Path filters.
- cancel-in-progress.
- دفعات متماسكة بدل pushes كثيرة.
- E2E/load ثقيل يدوي أو Release Gate.
- timeouts لكل job.
- لا artifacts كبيرة بلا ضرورة.

## Vercel
- لا Preview لكل commit.
- لا Deploy لتغييرات docs-only.
- Deploy عند milestone واجهة يحتاج browser proof أو approved release.
- routine validation محلي/CI.
- media من CDN/R2 لا من Vercel app.

## Render
- لا نحتاج خدمة أثناء Foundation.
- Staging فقط عندما نحتاج remote integration.
- لا Deploy لكل working commit.

## PostgreSQL / Redis
- Local/CI أولًا.
- Managed services عند بداية Staging.
- pagination/indexes/query budgets من أول Endpoint.
- Redis ليس مصدر الحقيقة.

## R2
- يبدأ مع Media domain.
- presigned direct uploads.
- hashed/versioned assets + CDN cache.
- لا duplicate question images.

## AI
- لا حساب provider مطلوب الآن.
- bounded context + cache + token caps + usage ledger.

أي تكلفة أو trigger دوري جديد يجب توثيقه قبل تفعيله.
