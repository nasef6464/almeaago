# ALMEAA — الدليل الهندسي الشامل للمحاور المؤسسية
## Engineering Pillars Master Reference — EdTech Enterprise Standard

**الإصدار**: 2.0 — نوفمبر 2026  
**المرجع**: `c:\almeaago\almeaago` (Go + PostgreSQL + Redis + React/Vite)  
**الغرض**: هذه الوثيقة هي **المرجع الإلزامي الوحيد** لأي وكيل أو مهندس أو نظام ذكاء اصطناعي يعمل على هذا المشروع. يجب قراءتها قبل البدء بأي تعديل أو إضافة. أي محور مذكور هنا بحالة `MISSING` أو `PARTIAL` هو مهمة عمل مستمرة.

---

> [!IMPORTANT]
> **قاعدة ذهبية**: أي وكيل يستلم مهمة في هذا المشروع يجب أن يقرأ هذه الوثيقة أولاً، ويفحص حالة كل محور يمس عمله، ويوثق تقدمه في جدول الحالة.

---

## الهيكل العام للمحاور (Pillars Architecture)

```
المحاور الهندسية لمنصة المئة التعليمية
├── [A] المحاور الستة الأساسية للأداء (Codex 6 Pillars)
│   ├── A1. فهارس قاعدة البيانات (Database Indexes)
│   ├── A2. القضاء على الاستعلامات المضاعفة (N+1 Elimination)
│   ├── A3. الترقيم وتقسيم الصفحات (Pagination)
│   ├── A4. أحجام الصور والتحميل الكسول (Image Optimization)
│   ├── A5. التخزين المؤقت الذكي (Redis Caching)
│   └── A6. هياكل الانتظار النابضة (Skeleton Loading)
│
├── [B] محاور الأمان والحماية (Security Pillars)
│   ├── B1. تقييد معدل الطلبات (Rate Limiting)
│   ├── B2. التحقق من المدخلات (Input Validation)
│   ├── B3. حماية CSRF وXSS
│   ├── B4. إدارة الجلسات والصلاحيات (RBAC)
│   └── B5. تدوير المفاتيح السرية (Secret Management)
│
├── [C] محاور المراقبة والتشغيل (Observability & DevOps)
│   ├── C1. التسجيل البنيوي (Structured Logging)
│   ├── C2. تتبع الطلبات (Distributed Tracing)
│   ├── C3. مقاييس الأداء (Metrics & Alerting)
│   ├── C4. فحص الصحة المتعمق (Deep Health Checks)
│   ├── C5. النشر الآمن والإغلاق التدريجي (Graceful Shutdown)
│   └── C6. النسخ الاحتياطي والاسترداد (Backup & DR)
│
├── [D] محاور تجربة المستخدم (UX Engineering)
│   ├── D1. إمكانية الوصول (Accessibility / A11y)
│   ├── D2. حالات الخطأ والشبكة (Error & Network States)
│   ├── D3. التجربة دون اتصال (Offline / PWA)
│   ├── D4. تقليص حجم الحزمة (Bundle Size Optimization)
│   └── D5. الطباعة والتصدير (Print & Export)
│
├── [E] المحاور التربوية والأكاديمية (Pedagogical Pillars)
│   ├── E1. التعلم التكيفي (Adaptive Learning)
│   ├── E2. إتقان المهارة (Mastery-Based Learning)
│   ├── E3. التغذية الراجعة الفورية (Immediate Feedback)
│   ├── E4. التحليلات التعليمية (Learning Analytics)
│   ├── E5. خطط الدراسة الذكية (AI Study Plans)
│   ├── E6. تتبع التقدم التفصيلي (Granular Progress Tracking)
│   ├── E7. التقييم التشخيصي (Diagnostic Assessment)
│   └── E8. ضمان جودة المحتوى (Content Quality Assurance)
│
└── [F] محاور الامتثال والتدويل (Compliance & i18n)
    ├── F1. اللوائح السعودية والخصوصية (KSA Data Privacy)
    ├── F2. التدويل الكامل (Full RTL / i18n)
    ├── F3. معايير إمكانية الوصول (WCAG 2.1 AA)
    └── F4. سجل التدقيق الكامل (Full Audit Trail)
```

---

## [A] المحاور الستة الأساسية للأداء — Codex 6 Pillars

### A1. فهارس قاعدة البيانات (Database Indexes)

| الحالة | التفاصيل |
| :--- | :--- |
| **الحالة الحالية** | `PARTIAL (75%)` |
| **المنجز** | فهارس البحث النصي `gin_trgm_ops`، فهرس `000053_courses_thumbnail_read_index`، فهارس الصلاحيات والجلسات والمدارس، فهارس التحصيل والمهارات. |
| **المتبقي** | فهرس `mastery_evidence_student_recent_idx` (student_id أولاً)، فهارس تغطية بنك الأسئلة للاختبارات المحاكية. |

**قاعدة عمل إلزامية لكل وكيل**:
```sql
-- قبل إضافة أي فهرس: نفذ EXPLAIN ANALYZE ووثق النتيجة
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT ... FROM table WHERE condition;
-- لا تضف INDEX إلا إذا كان Seq Scan على أكثر من 100 صف
```

**الفهارس المتبقية المطلوبة**:
```sql
-- A1.1 — فهرس إتقان الطالب الفردي
CREATE INDEX CONCURRENTLY mastery_evidence_student_recent_idx
  ON mastery_evidence(student_id, occurred_at DESC, id);

-- A1.2 — فهرس تغطية أسئلة الاختبارات المحاكية
CREATE INDEX CONCURRENTLY assessment_version_questions_lookup_idx
  ON assessment_version_questions(assessment_version_id, question_id, position);
```

---

### A2. القضاء على الاستعلامات المضاعفة (N+1 Elimination)

| الحالة | التفاصيل |
| :--- | :--- |
| **الحالة الحالية** | `PARTIAL (60%)` |
| **المنجز** | توحيد استدعاءات taxonomy في مسار واحد مع كاش Redis. |
| **المتبقي** | دمج (Batching) طلبات لوحة مشرف المدرسة، لوحة المشرف التربوي، لوحة المدرب. |

**قاعدة عمل إلزامية**:
```go
// ممنوع: استدعاء منفرد داخل loop
for _, student := range students {
    progress, _ := repo.GetProgress(ctx, student.ID) // ❌ N+1
}

// مطلوب: Batch fetch بعملية واحدة
progressMap, _ := repo.GetProgressBatch(ctx, studentIDs) // ✅
```

---

### A3. الترقيم وتقسيم الصفحات (Pagination)

| الحالة | التفاصيل |
| :--- | :--- |
| **الحالة الحالية** | `PARTIAL (65%)` |
| **المنجز** | تقييد `homepageCatalog.ts` بـ 5 صفحات حداً أقصى. |
| **المتبقي** | تحويل `/api/v1/courses/public` و `/api/v1/questions` إلى Cursor/Keyset Pagination. |

**قاعدة عمل إلزامية**:
```go
// كل endpoint يرجع قائمة يجب أن يكون له:
type ListResponse[T any] struct {
    Items      []T    `json:"items"`
    NextCursor string `json:"nextCursor,omitempty"` // ✅ Keyset
    Total      *int   `json:"total,omitempty"`       // اختياري للعرض
    HasMore    bool   `json:"hasMore"`
}
// الحد الأقصى الإلزامي: 50 عنصراً لكل صفحة
// ممنوع إطلاقاً: return all rows بدون حد
```

---

### A4. أحجام الصور والتحميل الكسول (Image Optimization)

| الحالة | التفاصيل |
| :--- | :--- |
| **الحالة الحالية** | `PARTIAL (35%)` |
| **المنجز** | `loading="lazy"` في 20 من 57 وسم صورة (35%). |
| **المتبقي** | 37 وسم صورة بدون lazy loading، تحويل 14 صورة JPG (~8.4MB) إلى WebP (~1.5MB مستهدف). |

**قاعدة عمل إلزامية**:
```tsx
// ✅ كل صورة ليست في الـ Viewport الأول يجب أن تحمل:
<img
  src={url}
  alt={description}      // إلزامي للـ A11y
  loading="lazy"         // إلزامي لكل صورة تحت الطية الأولى
  decoding="async"       // تحسين إضافي
  width={W} height={H}   // يمنع Layout Shift (CLS)
/>

// ✅ استخدم WebP/AVIF مع fallback
<picture>
  <source srcSet={`${url}.avif`} type="image/avif" />
  <source srcSet={`${url}.webp`} type="image/webp" />
  <img src={`${url}.jpg`} alt={...} loading="lazy" />
</picture>
```

---

### A5. التخزين المؤقت الذكي (Redis Caching)

| الحالة | التفاصيل |
| :--- | :--- |
| **الحالة الحالية** | `PARTIAL (40%)` |
| **المنجز** | `store.go` مع كاش Taxonomy (4.85ms P95)، كاش إعدادات الرئيسية، إبطال آلي على 8 عمليات تعديل. |
| **المتبقي** | كاش كتالوج الكورسات العامة، كاش قوالب الاختبارات الثابتة، Client-side React Query staleTime. |

**قاعدة عمل إلزامية**:
```go
// نمط Cache-Aside الإلزامي لكل endpoint ثقيل شبه ثابت:
func (s *Service) GetData(ctx context.Context, key string) (Data, error) {
    // 1. جرب الكاش أولاً
    if cached, err := s.cache.Get(ctx, key); err == nil {
        return cached, nil
    }
    // 2. اجلب من DB
    data, err := s.repo.Get(ctx, key)
    if err != nil { return Data{}, err }
    // 3. اخزن في الكاش مع TTL
    _ = s.cache.Set(ctx, key, data, 15*time.Minute)
    return data, nil
}

// TTL المعتمدة:
// - Taxonomy/Config: 15 دقيقة
// - Public catalog: 5 دقائق
// - User session: 7 أيام (في DB)
// - Question templates: 60 دقيقة
```

---

### A6. هياكل الانتظار النابضة (Skeleton Loading)

| الحالة | التفاصيل |
| :--- | :--- |
| **الحالة الحالية** | `PARTIAL (25%)` |
| **المنجز** | حزمة `Skeleton.tsx` مطبقة في 15 من 61 صفحة. |
| **المتبقي** | 46 صفحة لا تزال تستخدم Spinners أو نصوص تحميل. |

**قاعدة عمل إلزامية**:
```tsx
// ✅ نمط الصفحة الإلزامي لكل Page Component:
function MyPage() {
  const { data, isLoading } = useMyQuery();
  
  if (isLoading) return <MyPageSkeleton />; // ✅ Skeleton دائماً
  
  return <div>{/* محتوى الصفحة */}</div>;
}

// ✅ كل Skeleton يجب أن يستخدم:
// animate-pulse + bg-gray-200 dark:bg-gray-700
// الأبعاد تطابق العنصر الحقيقي (يمنع CLS)
```

---

## [B] محاور الأمان والحماية — Security Pillars

### B1. تقييد معدل الطلبات (Rate Limiting)

| الحالة | التفاصيل |
| :--- | :--- |
| **الحالة الحالية** | `PARTIAL` |
| **المنجز** | Rate limiting للـ AI Assistant (per-minute, daily per user). تقييد محاولات تسجيل الدخول عبر `failed_login_attempts` في DB. |
| **المتبقي** | Rate limiting على `/api/v1/auth/register` و `/api/v1/auth/forgot-password` بـ IP-based middleware في Go. |

**التطبيق المطلوب**:
```go
// middleware/rate_limit.go
// استخدم sliding window في Redis: X طلبات / دقيقة لكل IP
func RateLimit(store *redis.Client, limit int, window time.Duration) func(http.Handler) http.Handler {
    // Key: "rl:{endpoint}:{ip}"
    // Window: 1 دقيقة
    // Limits: register=5/min, forgot-password=3/min, login=10/min
}
```

---

### B2. التحقق من المدخلات (Input Validation)

| الحالة | المنجز |
| :--- | :--- |
| `PARTIAL` | التحقق موجود في طبقة الـ Handler (`decodeJSON` تعيد `ErrInvalidInput` عند فشل unmarshal). |

**المتبقي**: إضافة تحقق صارم من:
- طول الحقول القصوى (max 255 للأسماء، 10MB للملفات)
- تنقية الـ HTML في حقول النص الحر لأسئلة المناقشة
- التحقق من أرقام الهوية الوطنية السعودية بالتنسيق الصحيح (10 أرقام تبدأ بـ 1 أو 2)

---

### B3. حماية CSRF وXSS

| الحالة | المنجز |
| :--- | :--- |
| `EXISTS` | Double-Submit CSRF token موجود (`X-CSRF-Token` header). تشفير Argon2id لكلمات المرور. |

**المتبقي**: 
- التأكد من تعقيم (Sanitize) جميع مخرجات LaTeX قبل حقنها في DOM
- مراجعة عدم استخدام `dangerouslySetInnerHTML` في `questionHtml.ts`

---

### B4. إدارة الصلاحيات (RBAC)

| الحالة | المنجز |
| :--- | :--- |
| `EXISTS (95%)` | RBAC كامل عبر `user_roles` و `school_memberships` و `school_membership_permissions`. |

---

### B5. إدارة الأسرار (Secret Management)

| الحالة | المنجز |
| :--- | :--- |
| `PARTIAL` | الأسرار في متغيرات بيئة Render/Vercel. لا توجد آلية تلقائية لتدوير المفاتيح (Key Rotation). |

**المطلوب**: توثيق سياسة تدوير كل مفتاح (DATABASE_URL, JWT_SECRET, REDIS_URL) كل 90 يوماً.

---

## [C] محاور المراقبة والتشغيل — Observability & DevOps

### C1. التسجيل البنيوي (Structured Logging)

| الحالة | المنجز |
| :--- | :--- |
| `EXISTS` | `slog.Logger` مع مستويات (`log_level` config)، تسجيل منظم JSON لجميع الأخطاء. |

---

### C2. تتبع الطلبات (Distributed Tracing)

| الحالة | المنجز |
| :--- | :--- |
| `PARTIAL` | `rndr-id` header موجود من Render/Cloudflare. لا يوجد OpenTelemetry tracing داخلي. |

**المطلوب**:
```go
// إضافة Request-ID في middleware يربط كل log line بطلب واحد
func RequestID(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        id := r.Header.Get("X-Request-ID")
        if id == "" { id = uuid.New().String() }
        ctx := context.WithValue(r.Context(), "request_id", id)
        w.Header().Set("X-Request-ID", id)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

---

### C3. مقاييس الأداء (Metrics & Alerting)

| الحالة | المنجز |
| :--- | :--- |
| `MISSING` | لا يوجد Prometheus metrics أو Grafana dashboard أو تنبيه على P95 latency. |

**المطلوب**: إضافة `/metrics` endpoint (Prometheus format) يقيس:
- عدد الطلبات لكل endpoint
- P50/P95/P99 latency
- معدل الأخطاء 4xx/5xx
- استخدام Redis cache (hit/miss ratio)

---

### C4. فحص الصحة المتعمق (Deep Health Checks)

| الحالة | المنجز |
| :--- | :--- |
| `PARTIAL` | `/health/live` و `/health/ready` موجودان (يفحصان Postgres + Redis مع مهلة 2s في `server.go:76-90`). لا يوجد `/health/deep` لفحص التكاملات الخارجية. |

**المطلوب**:
- إضافة `/health/deep` لفحص تكاملات Cloudinary, R2, Tap Payments, WhatsApp, ومزودي الذكاء الاصطناعي (Gemini, DeepSeek).
- إضافة إعداد تنبيهات جهوزية خارجية (Uptime Alerts / UptimeRobot).

---

### C5. الإغلاق التدريجي (Graceful Shutdown)

| الحالة | المنجز |
| :--- | :--- |
| `EXISTS` | `signal.NotifyContext` مع `SIGINT/SIGTERM` في `main.go:87`، و `server.Shutdown(ctx)` بمهلة 10s في `main.go:389-391` مع إغلاق DB وRedis بأمان عبر `defer`. |

---

### C6. النسخ الاحتياطي والاسترداد (Backup & DR)

| الحالة | المنجز |
| :--- | :--- |
| `PARTIAL` | Neon Serverless تدعم Point-in-Time Recovery افتراضياً. لا توجد سياسة موثقة لـ RTO/RPO أو جدول اختبار الاسترداد. |

**المطلوب**: توثيق:
- **RPO** (Recovery Point Objective): الحد الأقصى لفقدان البيانات المقبول = 1 ساعة
- **RTO** (Recovery Time Objective): الحد الأقصى لوقت الاسترداد = 4 ساعات
- جدول اختبار استرداد فعلي كل 3 أشهر

---

### C7. فحص ثغرات التبعيات (Dependency Vulnerability Scanning)

| الحالة | المنجز |
| :--- | :--- |
| `MISSING` | غياب كامل لأدوات فحص الثغرات الآلية في التبعيات (`govulncheck` غائب في Go، و `--no-audit` مفعل صراحة في npm بـ workflows الفرونت إند، ولا يوجد Dependabot). |

**المطلوب الإلزامي**:
- إضافة خطوة `govulncheck ./...` في `.github/workflows/backend.yml`.
- إزالة `--no-audit` وتشغيل `npm audit` دورياً للفرونت إند.
- إضافة `.github/dependabot.yml` لمراقبة تحديثات الأمان للتبعيات تلقائياً.

---

### C8. سياسة مشاركة الموارد (CORS Policy)

| الحالة | المنجز |
| :--- | :--- |
| `EXISTS` | قائمة بيضاء صارمة في `server.go:244-280` تقيد الوصول بـ `WEB_ORIGIN` مع رفض أي نطاق غير مصرح به بـ HTTP 403، ودعم `Vary: Origin` لمنع تسمم الكاش، وانعدام تام للرموز العامة (`*`). |

---

## [D] محاور تجربة المستخدم — UX Engineering Pillars

### D1. إمكانية الوصول (Accessibility / A11y)

| الحالة | المنجز |
| :--- | :--- |
| `MISSING` | لا توجد `aria-label` على الأزرار الأيقونية، لا يوجد `role` semantics، لا يوجد keyboard navigation testing. |

**المطلوب لكل مكون تفاعلي**:
```tsx
// ✅ كل زر بأيقونة فقط يحتاج:
<button aria-label="إضافة طالب جديد">
  <PlusIcon />
</button>

// ✅ كل نموذج يحتاج:
<label htmlFor="email">البريد الإلكتروني</label>
<input id="email" type="email" required aria-required="true" />

// ✅ نسبة التباين اللوني: 4.5:1 للنصوص العادية، 3:1 للعناوين الكبيرة
```

**أداة الفحص الآلي**: `npx axe-cli https://almeaago.vercel.app`

---

### D2. حالات الخطأ والشبكة (Error & Network States)

| الحالة | المنجز |
| :--- | :--- |
| `PARTIAL` | معالجة أخطاء HTTP موجودة في Go. غياب حالات الخطأ الواضحة في الواجهة (empty states, error boundaries). |

**المطلوب لكل صفحة**:
```tsx
// ✅ 3 حالات إلزامية لكل Query:
if (isLoading) return <PageSkeleton />;
if (error)     return <ErrorState message={error.message} onRetry={refetch} />;
if (!data?.length) return <EmptyState title="لا توجد بيانات" />;
return <DataView data={data} />;
```

---

### D3. التجربة دون اتصال (Offline / PWA)

| الحالة | المنجز |
| :--- | :--- |
| `PARTIAL` | شريط تثبيت PWA موجود (`PwaInstallBanner`). لا يوجد Service Worker Cache للمحتوى الأكاديمي. |

**المطلوب**: تخزين آخر 10 دروس وكل أسئلة البنك المحملة في IndexedDB للاستخدام offline.

---

### D4. تقليص حجم الحزمة (Bundle Size Optimization)

| الحالة | المنجز |
| :--- | :--- |
| `PARTIAL` | Vite code splitting تلقائي للـ Pages. لا يوجد تقرير bundle size في CI. |

**المطلوب**:
```json
// vite.config.ts — إضافة:
"rollupOptions": {
    "output": {
        "manualChunks": {
            "vendor-math": ["katex"],
            "vendor-charts": ["recharts"],
            "vendor-ui": ["@headlessui/react"]
        }
    }
}
// الهدف: كل chunk < 200KB gzipped
```

---

### D5. الطباعة والتصدير (Print & Export)

| الحالة | المنجز |
| :--- | :--- |
| `MISSING` | لا توجد CSS print styles. لا يوجد تصدير PDF للتقارير المدرسية أو نتائج الاختبارات. |

**المطلوب**:
- CSS `@media print` لصفحات التقارير والنتائج
- تصدير PDF لنتيجة الطالب وكشف درجات الفصل

---

## [E] المحاور التربوية والأكاديمية — Pedagogical Pillars

### E1. التعلم التكيفي (Adaptive Learning Paths)

| الحالة | المنجز |
| :--- | :--- |
| `PARTIAL` | `learning_navigation_paths` و`learning_navigation_stages` موجودان في DB. الواجهة ترشد الطالب للخطوة القادمة عبر `SmartLearningPathWidget`. |

**المتبقي**: خوارزمية تكيف حقيقية تبني مسار الطالب بناءً على نتائجه الفعلية (Difficulty Adaptation).

---

### E2. إتقان المهارة (Mastery-Based Learning)

| الحالة | المنجز |
| :--- | :--- |
| `PARTIAL` | جداول `mastery_evidence`, `mastery_goals`, `skill_progress` موجودة. الواجهة لا تعرض درجة الإتقان بشكل واضح للطالب. |

**المطلوب**: شريط إتقان مهارة (Mastery Bar) مرئي في صفحة الكورس يظهر نسبة الإتقان (0-100%) لكل مهارة.

---

### E3. التغذية الراجعة الفورية (Immediate Feedback Loop)

| الحالة | المنجز |
| :--- | :--- |
| `EXISTS` | عرض الإجابة الصحيحة ومؤشر الصواب/الخطأ فور الإجابة في `AssessmentAttemptPage`. |

---

### E4. التحليلات التعليمية (Learning Analytics)

| الحالة | المنجز |
| :--- | :--- |
| `PARTIAL` | `ReportsPage` و `assessment_result_skill_summaries` موجودان. تقارير المشرف والمعلم أساسية. |

**المتبقي**:
- رسوم بيانية تفاعلية لتقدم الطالب عبر الزمن (time-series)
- تحليل نقاط الضعف الموضوعية (Topic Weakness Heatmap)
- مقارنة الطالب بمتوسط الفصل (Peer Benchmarking)

---

### E5. خطط الدراسة الذكية (AI-Powered Study Plans)

| الحالة | المنجز |
| :--- | :--- |
| `PARTIAL` | `StudyPlanPage`, `study_plans`, `study_plan_items` موجودان. الربط بالذكاء الاصطناعي جزئي. |

**المطلوب**: خوارزمية `Spaced Repetition` لجدولة مراجعة المهارات الضعيفة بمعادلة SM-2 أو Leitner System.

---

### E6. تتبع التقدم التفصيلي (Granular Progress Tracking)

| الحالة | المنجز |
| :--- | :--- |
| `EXISTS (90%)` | `lesson_progress`, `lesson_video_progress`, `skill_progress`, `review_cards` كلها موجودة ومفعلة. |

---

### E7. التقييم التشخيصي (Diagnostic Assessment)

| الحالة | المنجز |
| :--- | :--- |
| `PARTIAL` | الاختبارات المحاكية موجودة. لا يوجد اختبار تشخيصي أولي (Placement Test) يحدد مستوى الطالب عند التسجيل الأول. |

**المطلوب**: اختبار تشخيصي أول مؤلف من 15-20 سؤالاً لكل مسار (قدرات/تحصيلي) يحدد مستوى الطالب ويضع توصية مسار دراسي تلقائية.

---

### E8. ضمان جودة المحتوى (Content Quality Assurance)

| الحالة | المنجز |
| :--- | :--- |
| `PARTIAL` | سير عمل الموافقة (`workflow_status`) موجود للأسئلة. لا توجد مراجعة تعليمية منظمة (Peer Review). |

**المطلوب**: قائمة تحقق جودة (Quality Checklist) لكل سؤال قبل اعتماده:
- دقة المعلومة علمياً
- وضوح الصياغة اللغوية
- صحة الإجابة ووجود تفسير وافٍ
- تصنيف مستوى بلوم (Bloom's Taxonomy Level)

---

## [F] محاور الامتثال والتدويل — Compliance & i18n

### F1. لوائح الخصوصية السعودية (KSA PDPL)

| الحالة | المنجز |
| :--- | :--- |
| `PARTIAL` | البيانات في Neon (Frankfurt). نظام حماية البيانات الشخصية السعودي (PDPL) يتطلب موافقة صريحة على معالجة البيانات. |

**المطلوب**:
- صفحة سياسة الخصوصية مفصلة وفق PDPL
- آلية سحب الموافقة وحذف البيانات (Right to Erasure)
- طلب موافقة صريحة من ولي الأمر لحسابات القاصرين (< 18 سنة)

---

### F2. التدويل الكامل (Full RTL / i18n)

| الحالة | المنجز |
| :--- | :--- |
| `PARTIAL` | `dir="rtl"` مفعل. خط "تجوّل" مطبق. النصوص hardcoded عربياً في الكود (لا يوجد نظام i18n منفصل). |

**ملاحظة**: المنصة عربية خالصة حالياً، ولا حاجة ماسة لـ i18n library إلا إذا أُريد دعم اللغة الإنجليزية مستقبلاً.

---

### F3. معايير إمكانية الوصول (WCAG 2.1 AA)

| الحالة | المنجز |
| :--- | :--- |
| `MISSING` | لا يوجد تقرير WCAG. لا يوجد فحص آلي للـ aria attributes أو contrast ratio. |

**المطلوب**: دمج `jest-axe` في pipeline الاختبار لاكتشاف مخالفات WCAG تلقائياً.

---

### F4. سجل التدقيق الكامل (Full Audit Trail)

| الحالة | المنجز |
| :--- | :--- |
| `PARTIAL` | جدول `audit_logs` موجود. تسجيل العمليات الحساسة جزئي. |

**المطلوب**: تسجيل تلقائي لـ:
- كل عملية CRUD على بيانات الطلاب
- كل تغيير في درجة أو نتيجة اختبار
- كل عملية دفع أو استرداد مالي

---

## جدول الأولوية التنفيذية الإجمالية

| الأولوية | المحور | التأثير | الجهد | الحالة |
| :---: | :--- | :---: | :---: | :---: |
| 🔴 P0 | **A5**: تعميم Redis Cache على كتالوج الكورسات | عالٍ | منخفض | PARTIAL |
| 🔴 P0 | **A6**: Skeleton في 46 صفحة متبقية | عالٍ | متوسط | PARTIAL |
| 🔴 P0 | **A4**: lazy loading لـ 37 صورة + WebP | عالٍ | منخفض | PARTIAL |
| 🟠 P1 | **B1**: Rate Limiting على Auth endpoints | عالٍ أماناً | منخفض | PARTIAL |
| 🟠 P1 | **D1**: Accessibility (aria-labels) | متوسط | متوسط | MISSING |
| 🟠 P1 | **D2**: Error States + Empty States لكل صفحة | عالٍ UX | متوسط | PARTIAL |
| 🟠 P1 | **E2**: Mastery Bar مرئي للطالب | عالٍ تعليمياً | متوسط | PARTIAL |
| 🟡 P2 | **C3**: Metrics Endpoint (Prometheus) | متوسط | متوسط | MISSING |
| 🟡 P2 | **E4**: تحليلات تعليمية مرئية (Charts) | عالٍ تعليمياً | عالٍ | PARTIAL |
| 🟡 P2 | **E7**: Diagnostic Placement Test | عالٍ تعليمياً | عالٍ | MISSING |
| 🟡 P2 | **D4**: Bundle Splitting + Size Report | متوسط | منخفض | PARTIAL |
| 🟢 P3 | **C4**: Deep Health Check (/health/ready) | متوسط | منخفض | PARTIAL |
| 🟢 P3 | **D5**: CSS Print + PDF Export | منخفض | متوسط | MISSING |
| 🟢 P3 | **F3**: WCAG Automated Testing | متوسط | متوسط | MISSING |
| 🟢 P3 | **F1**: PDPL Privacy Policy Page | متوسط قانونياً | منخفض | PARTIAL |

---

## قواعد عمل إلزامية لكل وكيل (Mandatory Agent Rules)

> [!CAUTION]
> **قبل البدء بأي تعديل**: افحص الحالة الحالية للمحور الذي ستعمل عليه في هذه الوثيقة. إذا كانت الحالة `EXISTS` فلا تعيد بناءه من الصفر.

### القواعد الإلزامية التشغيلية:
1. **لا تكسر الميزة المنجزة**: لا تلمس محوراً `EXISTS` إلا لإضافة اختبارات توثق بقاءه سليماً.
2. **الكاش دائماً مع Invalidation**: لا تضيف كاش دون آلية إبطال آلي عند تعديل البيانات.
3. **كل صفحة جديدة**: تحتاج (Skeleton + Error State + Empty State) قبل أن تُعدّ مكتملة.
4. **كل Migration جديدة**: تحتاج `.up.sql` و `.down.sql` وفهرساً مقابلاً إذا احتوت FK.
5. **كل API Endpoint جديد**: يحتاج توثيقاً في `api/openapi/openapi.yaml` ولا يُعيد أكثر من 50 صفاً بدون pagination.
6. **قبل النشر**: تشغيل `go test ./...` و `npm run build` بنسبة نجاح 100%.

---

## مؤشرات النجاح (Success Metrics)

| المؤشر | الهدف | طريقة القياس |
| :--- | :--- | :--- |
| زمن استجابة الصفحة الرئيسية | < 200ms | Lighthouse Performance Score |
| P95 Latency للـ API | < 100ms | مقياس Redis cache hit/miss |
| نسبة الصفحات بـ Skeleton | 100% من الـ 61 صفحة | فحص آلي بـ Python script |
| نسبة الصور بـ lazy | 100% من الـ 57 صورة | grep في الكود |
| نسبة اجتياز اختبارات E2E | 100% | GitHub CI |
| Lighthouse Accessibility Score | ≥ 90/100 | Lighthouse CI |
| Cache Hit Ratio (Redis) | ≥ 85% للـ taxonomy | Redis INFO stats |
| Concurrent Users | 5,000+ بدون تجمد | Load Test (k6 أو Locust) |

---

## تاريخ التحديثات

| التاريخ | التحديث | بواسطة |
| :--- | :--- | :--- |
| 2026-11-21 | إنشاء الوثيقة الأولى (v2.0) شاملة 6 مجموعات و24+ محوراً | Antigravity + Swarm (backend-auditor, frontend-auditor, pedagogy-auditor, devops-auditor) |
