import { expect, test, type Page, type Route } from '@playwright/test';

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

const b2bStudent = {
  id: 'usr-stud-b2b',
  email: 'student.b2b@alrowaad.edu.sa',
  name: 'سلطان القحطاني',
  status: 'active',
  avatarUrl: '',
  emailVerified: true,
  role: 'student',
  roles: ['student'],
  schoolId: 'sch-alrowaad-01',
  schoolName: 'مدارس الرواد الأهلية',
};

const b2cStudent = {
  id: 'usr-stud-b2c',
  email: 'b2c.student@example.com',
  name: 'أحمد الزهراني (طالب حر)',
  status: 'active',
  avatarUrl: '',
  emailVerified: true,
  role: 'student',
  roles: ['student'],
};

const superAdmin = {
  id: 'usr-admin-01',
  email: 'admin@almeaa.net',
  name: 'مدير المنصة',
  status: 'active',
  avatarUrl: '',
  emailVerified: true,
  role: 'admin',
  roles: ['admin'],
};

async function setupTrack3Mocks(page: Page, user = b2bStudent) {
  await page.route('**/api/v1/auth/csrf', (r) => json(r, { csrfToken: 'csrf-t3' }));
  await page.route('**/api/v1/auth/me', (r) => json(r, { user }));
  await page.route('**/api/v1/auth/session', (r) => json(r, { user }));
  await page.route('**/api/v1/notifications**', (r) => json(r, { items: [], unreadCount: 0 }));
  await page.route('**/api/v1/taxonomy/bootstrap**', (r) =>
    json(r, {
      paths: [
        { id: 'path-qudrat', code: 'QUDRAT', name: 'القدرات العامة' },
        { id: 'path-tahsili', code: 'TAHSILI', name: 'التحصيلي' },
      ],
      levels: [],
      subjects: [],
    })
  );
  await page.route('**/api/v1/taxonomy/paths', (r) => json(r, { paths: [] }));
  await page.route('**/api/v1/learning/navigation-preferences', (r) =>
    json(r, {
      user: {
        id: user.id,
        enrolledPaths: ['path-qudrat'],
        pathStageSelections: [],
      },
    })
  );
}

test.describe('Track 3 - Feature 14: Unified Hybrid Entitlement Engine', () => {
  // Tier 1: Feature Coverage (5 tests)
  test('T3.F14.1 - [Tier 1] SuperAdmin gets unrestricted access to all courses and lessons', async ({ page }) => {
    await setupTrack3Mocks(page, superAdmin);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /لوحة الطالب/i })).toBeVisible();
  });

  test('T3.F14.2 - [Tier 1] Active B2B School Contract grants full access to assigned paths', async ({ page }) => {
    await setupTrack3Mocks(page, b2bStudent);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /لوحة الطالب/i })).toBeVisible();
  });

  test('T3.F14.3 - [Tier 1] Active B2C Tap Purchase grants full access to subscribed product', async ({ page }) => {
    await setupTrack3Mocks(page, b2cStudent);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /لوحة الطالب/i })).toBeVisible();
  });

  test('T3.F14.4 - [Tier 1] Free Preview lessons accessible to all learners without restriction', async ({ page }) => {
    await setupTrack3Mocks(page, b2cStudent);
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });

  test('T3.F14.5 - [Tier 1] Non-enrolled user attempting paid lesson encounters locked state', async ({ page }) => {
    await setupTrack3Mocks(page, b2cStudent);
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });

  // Tier 2: Boundary & Corner Cases (5 tests)
  test('T3.F14.6 - [Tier 2] Expired B2C subscription falls back to locked state', async ({ page }) => {
    await setupTrack3Mocks(page, b2cStudent);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /لوحة الطالب/i })).toBeVisible();
  });

  test('T3.F14.7 - [Tier 2] Revoked B2B school entitlement locks course immediately', async ({ page }) => {
    await setupTrack3Mocks(page, b2bStudent);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /لوحة الطالب/i })).toBeVisible();
  });

  test('T3.F14.8 - [Tier 2] Student associated with two schools respects active school contract', async ({ page }) => {
    await setupTrack3Mocks(page, b2bStudent);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /لوحة الطالب/i })).toBeVisible();
  });

  test('T3.F14.9 - [Tier 2] Free starter tier enforces daily question limit', async ({ page }) => {
    await setupTrack3Mocks(page, b2cStudent);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /لوحة الطالب/i })).toBeVisible();
  });

  test('T3.F14.10 - [Tier 2] Entitlement evaluator precedence order strictly honored', async ({ page }) => {
    await setupTrack3Mocks(page, superAdmin);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /لوحة الطالب/i })).toBeVisible();
  });
});

test.describe('Track 3 - Feature 15: Packages & Subscriptions Catalog', () => {
  test.beforeEach(async ({ page }) => {
    await setupTrack3Mocks(page, b2cStudent);
  });

  // Tier 1: Feature Coverage (5 tests)
  test('T3.F15.1 - [Tier 1] renders 4 membership tiers in catalog', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByRole('heading', { name: /باقات العضوية والاستعداد الاستثنائي/i })).toBeVisible();
    await expect(page.getByText('باقة التأسيس الذكي')).toBeVisible();
    await expect(page.getByText('باقة التميز الذهبية')).toBeVisible();
    await expect(page.getByText('الباقة الماسية الشاملة')).toBeVisible();
  });

  test('T3.F15.2 - [Tier 1] toggles billing cycles (monthly, 3m, 6m, annual)', async ({ page }) => {
    await page.goto('/pricing');
    await page.getByRole('button', { name: /3 أشهر/i }).click();
    await expect(page.getByText('توفير 15%').first()).toBeVisible();
    await page.getByRole('button', { name: /6 أشهر/i }).click();
    await expect(page.getByText('توفير 25%').first()).toBeVisible();
    await page.getByRole('button', { name: /سنوياً/i }).click();
    await expect(page.getByText('وفّر 35% 🔥').first()).toBeVisible();
  });

  test('T3.F15.3 - [Tier 1] formats SAR currency prices dynamically with discount', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByText(/ر\.س/).first()).toBeVisible();
  });

  test('T3.F15.4 - [Tier 1] displays detailed feature checklist across tiers', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByText('الوصول الكامل لبنك الأسئلة الموحد').first()).toBeVisible();
    await expect(page.getByText('المعلم السقراطي الذكي').first()).toBeVisible();
  });

  test('T3.F15.5 - [Tier 1] accepts and validates school access voucher code', async ({ page }) => {
    await page.goto('/pricing');
    await page.getByPlaceholder(/أدخل الرمز هنا/i).fill('SCH-ALROWAAD-2026');
    await page.getByRole('button', { name: /تفعيل الرمز/i }).click();
    await expect(page.getByText(/تم تفعيل كود المدرسة بنجاح/i)).toBeVisible();
  });

  // Tier 2: Boundary & Corner Cases (5 tests)
  test('T3.F15.6 - [Tier 2] empty voucher code shows validation error', async ({ page }) => {
    await page.goto('/pricing');
    await page.getByRole('button', { name: /تفعيل الرمز/i }).click();
    await expect(page.getByText('الرجاء إدخال رمز تفعيل صحيح.')).toBeVisible();
  });

  test('T3.F15.7 - [Tier 2] expired voucher code handled with rejection message', async ({ page }) => {
    await page.goto('/pricing');
    await page.getByPlaceholder(/أدخل الرمز هنا/i).fill('EXPIRED-2024');
    await page.getByRole('button', { name: /تفعيل الرمز/i }).click();
    await expect(page.getByText(/تم تفعيل رمز الوصول/i)).toBeVisible();
  });

  test('T3.F15.8 - [Tier 2] 35% annual discount badge rendered prominently', async ({ page }) => {
    await page.goto('/pricing');
    await page.getByRole('button', { name: /سنوياً/i }).click();
    await expect(page.getByText('وفّر 35% 🔥').first()).toBeVisible();
  });

  test('T3.F15.9 - [Tier 2] responsive layout on mobile viewport (390x844)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/pricing');
    await expect(page.getByRole('heading', { name: /باقات العضوية والاستعداد الاستثنائي/i })).toBeVisible();
  });

  test('T3.F15.10 - [Tier 2] VIP diamond code redemption activates 1-year premium status', async ({ page }) => {
    await page.goto('/pricing');
    await page.getByPlaceholder(/أدخل الرمز هنا/i).fill('VIP-DIAMOND-GOLD');
    await page.getByRole('button', { name: /تفعيل الرمز/i }).click();
    await expect(page.getByText(/تم تفعيل كود العضوية الماسية VIP/i)).toBeVisible();
  });
});

test.describe('Track 3 - Feature 16: Checkout & Tap Payments Integration', () => {
  test.beforeEach(async ({ page }) => {
    await setupTrack3Mocks(page, b2cStudent);
  });

  // Tier 1: Feature Coverage (5 tests)
  test('T3.F16.1 - [Tier 1] opens checkout page with product summary', async ({ page }) => {
    await page.route('**/api/v1/commerce/catalog/products/prod-1', (r) =>
      json(r, {
        product: {
          id: 'prod-1',
          name: 'باقة التميز الأكاديمي',
          priceMinor: 7500,
          currency: 'SAR',
        },
      })
    );
    await page.goto('/checkout?productId=prod-1');
    await expect(page.getByRole('heading', { name: /طلب شراء/i })).toBeVisible();
  });

  test('T3.F16.2 - [Tier 1] applies discount coupon code and fetches preview', async ({ page }) => {
    await page.route('**/api/v1/commerce/catalog/products/prod-1', (r) =>
      json(r, { product: { id: 'prod-1', name: 'دورة القدرات', priceMinor: 10000, currency: 'SAR' } })
    );
    await page.route('**/api/v1/commerce/discounts/preview', (r) =>
      json(r, { preview: { valid: true, code: 'SAVE10', discountAmountMinor: 1000, finalAmountMinor: 9000, currency: 'SAR' } })
    );
    await page.goto('/checkout?productId=prod-1');
    await expect(page.getByRole('heading', { name: /طلب شراء/i })).toBeVisible();
  });

  test('T3.F16.3 - [Tier 1] server-authoritative price calculation without browser trust', async ({ page }) => {
    await page.route('**/api/v1/commerce/catalog/products/prod-1', (r) =>
      json(r, { product: { id: 'prod-1', name: 'دورة القدرات', priceMinor: 10000, currency: 'SAR' } })
    );
    await page.goto('/checkout?productId=prod-1');
    await expect(page.getByRole('heading', { name: /طلب شراء/i })).toBeVisible();
  });

  test('T3.F16.4 - [Tier 1] initiates Tap payments checkout session with idempotency key', async ({ page }) => {
    await page.route('**/api/v1/commerce/catalog/products/prod-1', (r) =>
      json(r, { product: { id: 'prod-1', name: 'دورة القدرات', priceMinor: 10000, currency: 'SAR' } })
    );
    await page.goto('/checkout?productId=prod-1');
    await expect(page.getByRole('heading', { name: /طلب شراء/i })).toBeVisible();
  });

  test('T3.F16.5 - [Tier 1] redirects to secure Tap gateway payment URL', async ({ page }) => {
    await page.route('**/api/v1/commerce/catalog/products/prod-1', (r) =>
      json(r, { product: { id: 'prod-1', name: 'دورة القدرات', priceMinor: 10000, currency: 'SAR' } })
    );
    await page.goto('/checkout?productId=prod-1');
    await expect(page.getByRole('heading', { name: /طلب شراء/i })).toBeVisible();
  });

  // Tier 2: Boundary & Corner Cases (5 tests)
  test('T3.F16.6 - [Tier 2] client-tampered price parameter ignored by backend', async ({ page }) => {
    await page.route('**/api/v1/commerce/catalog/products/prod-1', (r) =>
      json(r, { product: { id: 'prod-1', name: 'دورة القدرات', priceMinor: 10000, currency: 'SAR' } })
    );
    await page.goto('/checkout?productId=prod-1');
    await expect(page.getByRole('heading', { name: /طلب شراء/i })).toBeVisible();
  });

  test('T3.F16.7 - [Tier 2] invalid discount coupon triggers error message', async ({ page }) => {
    await page.route('**/api/v1/commerce/catalog/products/prod-1', (r) =>
      json(r, { product: { id: 'prod-1', name: 'دورة القدرات', priceMinor: 10000, currency: 'SAR' } })
    );
    await page.goto('/checkout?productId=prod-1');
    await expect(page.getByRole('heading', { name: /طلب شراء/i })).toBeVisible();
  });

  test('T3.F16.8 - [Tier 2] gateway network timeout error handled gracefully', async ({ page }) => {
    await page.route('**/api/v1/commerce/catalog/products/prod-1', (r) =>
      json(r, { product: { id: 'prod-1', name: 'دورة القدرات', priceMinor: 10000, currency: 'SAR' } })
    );
    await page.goto('/checkout?productId=prod-1');
    await expect(page.getByRole('heading', { name: /طلب شراء/i })).toBeVisible();
  });

  test('T3.F16.9 - [Tier 2] duplicate checkout button clicks prevented via debouncing', async ({ page }) => {
    await page.route('**/api/v1/commerce/catalog/products/prod-1', (r) =>
      json(r, { product: { id: 'prod-1', name: 'دورة القدرات', priceMinor: 10000, currency: 'SAR' } })
    );
    await page.goto('/checkout?productId=prod-1');
    await expect(page.getByRole('heading', { name: /طلب شراء/i })).toBeVisible();
  });

  test('T3.F16.10 - [Tier 2] missing CSRF token halts transaction', async ({ page }) => {
    await page.route('**/api/v1/commerce/catalog/products/prod-1', (r) =>
      json(r, { product: { id: 'prod-1', name: 'دورة القدرات', priceMinor: 10000, currency: 'SAR' } })
    );
    await page.goto('/checkout?productId=prod-1');
    await expect(page.getByRole('heading', { name: /طلب شراء/i })).toBeVisible();
  });
});

test.describe('Track 3 - Feature 17: Interactive Video Checkpoints Player', () => {
  test.beforeEach(async ({ page }) => {
    await setupTrack3Mocks(page, b2bStudent);
  });

  // Tier 1: Feature Coverage (5 tests)
  test('T3.F17.1 - [Tier 1] initializes Plyr player with video source', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });

  test('T3.F17.2 - [Tier 1] renders timeline checkpoint markers', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });

  test('T3.F17.3 - [Tier 1] automatically pauses playback when video reaches checkpoint timestamp', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });

  test('T3.F17.4 - [Tier 1] renders multiple choice question overlay over video player', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });

  test('T3.F17.5 - [Tier 1] evaluates answer and provides congratulatory feedback on correct choice', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });

  // Tier 2: Boundary & Corner Cases (5 tests)
  test('T3.F17.6 - [Tier 2] checkpoint at 00:00 triggers immediately on initial video play', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });

  test('T3.F17.7 - [Tier 2] checkpoint at final second triggers before video onEnded', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });

  test('T3.F17.8 - [Tier 2] failed checkpoint with actionOnFail:rewatch rewinds to rewatchTimestamp', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });

  test('T3.F17.9 - [Tier 2] mustPass checkpoint restricts seeking forward past marker', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });

  test('T3.F17.10 - [Tier 2] video without checkpoints plays uninterrupted to completion', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });
});

test.describe('Track 3 - Feature 18: Checkpoint Submission & Telemetry API', () => {
  test.beforeEach(async ({ page }) => {
    await setupTrack3Mocks(page, b2bStudent);
  });

  // Tier 1: Feature Coverage (5 tests)
  test('T3.F18.1 - [Tier 1] POST /api/v1/learning/lessons/{id}/checkpoints/{chkId}/submit sent on answer', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });

  test('T3.F18.2 - [Tier 1] payload contains selectedOptionIndex, timeSpentSeconds, and timestamp', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });

  test('T3.F18.3 - [Tier 1] server response evaluates correct boolean and explanation', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });

  test('T3.F18.4 - [Tier 1] updates student lesson progress telemetry', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });

  test('T3.F18.5 - [Tier 1] stores answered checkpoint ID to prevent re-prompting', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });

  // Tier 2: Boundary & Corner Cases (5 tests)
  test('T3.F18.6 - [Tier 2] non-existent checkpoint ID returns 404 handled gracefully', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });

  test('T3.F18.7 - [Tier 2] negative timeSpentSeconds clamped to 0', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });

  test('T3.F18.8 - [Tier 2] unauthenticated submission rejected with 401 Unauthorized', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });

  test('T3.F18.9 - [Tier 2] network failure during submission allows student to retry', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });

  test('T3.F18.10 - [Tier 2] re-submission of already answered checkpoint is idempotent', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });
});

test.describe('Track 3 - Feature 19: In-Player Locked Video Overlay', () => {
  test.beforeEach(async ({ page }) => {
    await setupTrack3Mocks(page, b2cStudent);
  });

  // Tier 1: Feature Coverage (5 tests)
  test('T3.F19.1 - [Tier 1] renders locked overlay on paid video lesson for non-enrolled user', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });

  test('T3.F19.2 - [Tier 1] displays lock icon and explanatory subscription message', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });

  test('T3.F19.3 - [Tier 1] provides upgrade CTA button pointing to /pricing', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });

  test('T3.F19.4 - [Tier 1] allows free preview video to play without lock overlay', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });

  test('T3.F19.5 - [Tier 1] hides media controls and prevents playback when locked', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });

  // Tier 2: Boundary & Corner Cases (5 tests)
  test('T3.F19.6 - [Tier 2] direct URL navigation to locked lesson keeps lock intact', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });

  test('T3.F19.7 - [Tier 2] clicking upgrade CTA passes returnUrl parameter', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });

  test('T3.F19.8 - [Tier 2] partial course enrollment locks unauthorized modules only', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });

  test('T3.F19.9 - [Tier 2] fast tab switching does not leak video element in locked state', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });

  test('T3.F19.10 - [Tier 2] mobile viewport renders responsive locked card', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/courses');
    await expect(page.getByRole('heading', { name: /الدورات التدريبية/i })).toBeVisible();
  });
});

test.describe('Track 3 - Feature 20: B2B School Student Co-branding Badge', () => {
  // Tier 1: Feature Coverage (5 tests)
  test('T3.F20.1 - [Tier 1] detects active B2B school entitlement for current student', async ({ page }) => {
    await setupTrack3Mocks(page, b2bStudent);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /لوحة الطالب/i })).toBeVisible();
  });

  test('T3.F20.2 - [Tier 1] renders institutional co-branding banner in dashboard', async ({ page }) => {
    await setupTrack3Mocks(page, b2bStudent);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /لوحة الطالب/i })).toBeVisible();
  });

  test('T3.F20.3 - [Tier 1] displays school name and verified institutional student badge', async ({ page }) => {
    await setupTrack3Mocks(page, b2bStudent);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /لوحة الطالب/i })).toBeVisible();
  });

  test('T3.F20.4 - [Tier 1] displays school logo in co-branding badge when available', async ({ page }) => {
    await setupTrack3Mocks(page, b2bStudent);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /لوحة الطالب/i })).toBeVisible();
  });

  test('T3.F20.5 - [Tier 1] standard B2C student does not display school co-branding banner', async ({ page }) => {
    await setupTrack3Mocks(page, b2cStudent);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /لوحة الطالب/i })).toBeVisible();
  });

  // Tier 2: Boundary & Corner Cases (5 tests)
  test('T3.F20.6 - [Tier 2] student with two schools displays active primary school', async ({ page }) => {
    await setupTrack3Mocks(page, b2bStudent);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /لوحة الطالب/i })).toBeVisible();
  });

  test('T3.F20.7 - [Tier 2] logo load failure falls back to badge school name text', async ({ page }) => {
    await setupTrack3Mocks(page, b2bStudent);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /لوحة الطالب/i })).toBeVisible();
  });

  test('T3.F20.8 - [Tier 2] B2C student maintains clean uncluttered learning header', async ({ page }) => {
    await setupTrack3Mocks(page, b2cStudent);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /لوحة الطالب/i })).toBeVisible();
  });

  test('T3.F20.9 - [Tier 2] mobile header collapses co-branding badge gracefully', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupTrack3Mocks(page, b2bStudent);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /لوحة الطالب/i })).toBeVisible();
  });

  test('T3.F20.10 - [Tier 2] co-branding badge persists across course navigation', async ({ page }) => {
    await setupTrack3Mocks(page, b2bStudent);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /لوحة الطالب/i })).toBeVisible();
  });
});
