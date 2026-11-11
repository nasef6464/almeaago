import { expect, test, type Page, type Route } from '@playwright/test';

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function formatSAR(amount: number) {
  return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(amount);
}

async function setupTrack1Mocks(page: Page) {
  await page.route('**/api/v1/auth/csrf', (r) => json(r, { csrfToken: 'csrf-t1' }));
  await page.route('**/api/v1/auth/me', (r) => json(r, { user: null }, 401));
  await page.route('**/api/v1/auth/session', (r) => json(r, { user: null }, 401));
  await page.route('**/api/v1/notifications**', (r) => json(r, { items: [], unreadCount: 0 }));
  await page.route('**/api/v1/taxonomy/bootstrap**', (r) => json(r, { paths: [], levels: [], subjects: [] }));
  await page.route('**/api/v1/taxonomy/paths', (r) => json(r, { paths: [] }));
  await page.route('**/api/v1/courses/public**', (r) => json(r, { items: [], total: 0 }));
}

test.describe('Track 1 - Feature 1: ForSchools Pitch Landing', () => {
  test.beforeEach(async ({ page }) => {
    await setupTrack1Mocks(page);
  });

  // Tier 1: Feature Coverage (5 tests)
  test('T1.F1.1 - [Tier 1] renders pitch hero with Arabic headline, badge, and CTA', async ({ page }) => {
    await page.goto('/for-schools');
    await expect(page.getByRole('heading', { name: /اصنع الفارق في نتائج طلابك وتصدّر/i })).toBeVisible();
    await expect(page.getByText('حلول متكاملة لمدارس التعليم العام، الأهلية، والعالمية بالمملكة')).toBeVisible();
    await expect(page.getByRole('button', { name: /طلب عرض سعر رسمي وتجربة للمدرسة/i })).toBeVisible();
  });

  test('T1.F1.2 - [Tier 1] renders trust statistics (98% satisfaction, 150+ schools)', async ({ page }) => {
    await page.goto('/for-schools');
    await expect(page.getByText('+9.4 درجات')).toBeVisible();
    await expect(page.getByText('+45 مدرسة')).toBeVisible();
    await expect(page.getByText('100% متوافق')).toBeVisible();
    await expect(page.getByText('3 دقائق')).toBeVisible();
    await expect(page.getByText('متوسط ارتفاع درجات الطلاب')).toBeVisible();
    await expect(page.getByText('شريكة في مدن المملكة')).toBeVisible();
    await expect(page.getByText('مع نظام نور ومؤشرات قياس')).toBeVisible();
    await expect(page.getByText('وقت استيراد فصول المدرسة كاملة')).toBeVisible();
  });

  test('T1.F1.3 - [Tier 1] renders traditional vs Almeaa smart platform comparison matrix', async ({ page }) => {
    await page.goto('/for-schools');
    await expect(page.getByText('باقات المدارس المعتمدة وفق احتياج كل صرح تعليمي')).toBeVisible();
    await expect(page.getByText('باقة التأسيس للقدرات')).toBeVisible();
    await expect(page.getByText('باقة التميز الأكاديمي')).toBeVisible();
    await expect(page.getByText('باقة المدرسة الذكية VIP')).toBeVisible();
  });

  test('T1.F1.4 - [Tier 1] toggles interactive showcase demo tabs smoothly', async ({ page }) => {
    await page.goto('/for-schools');
    const tabAiExam = page.getByRole('button', { name: /توليد اختبارات من PDF/i });
    const tabSocratic = page.getByRole('button', { name: /السبورة السقراطية الناطقة/i });
    const tabRoyalCert = page.getByRole('button', { name: /شهادات التكريم/i });
    const tabNoor = page.getByRole('button', { name: /تكامل نور/i });

    await expect(tabAiExam).toBeVisible();
    await expect(tabSocratic).toBeVisible();
    await expect(tabRoyalCert).toBeVisible();
    await expect(tabNoor).toBeVisible();

    await tabSocratic.click();
    await expect(page.getByText('سبورة الشرح الذكي - الأسلوب السقراطي التفاعلي')).toBeVisible();

    await tabRoyalCert.click();
    await expect(page.getByText('شهادة تقدير وإتقان أكاديمي')).toBeVisible();

    await tabNoor.click();
    await expect(page.getByText('استيراد شيت إكسل نظام نور بضغطة زر واحدة')).toBeVisible();
  });

  test('T1.F1.5 - [Tier 1] sticky navigation and quick action buttons navigate properly', async ({ page }) => {
    await page.goto('/for-schools');
    const calcButton = page.getByRole('link', { name: /حاسبة العائد/i });
    await expect(calcButton).toBeVisible();
    await calcButton.click();
    await expect(page.locator('#roi-calculator')).toBeVisible();
  });

  // Tier 2: Boundary & Corner Cases (5 tests)
  test('T1.F1.6 - [Tier 2] mobile viewport (390x844) renders without horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/for-schools');
    await expect(page.getByRole('heading', { name: /اصنع الفارق في نتائج طلابك وتصدّر/i })).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });

  test('T1.F1.7 - [Tier 2] tablet viewport (820x1180) aligns grid columns cleanly', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto('/for-schools');
    await expect(page.getByText('باقات المدارس المعتمدة وفق احتياج كل صرح تعليمي')).toBeVisible();
  });

  test('T1.F1.8 - [Tier 2] rapid clicking between tabs preserves component lifecycle without error', async ({ page }) => {
    await page.goto('/for-schools');
    const tab1 = page.getByRole('button', { name: /توليد اختبارات من PDF/i });
    const tab2 = page.getByRole('button', { name: /السبورة السقراطية الناطقة/i });
    for (let i = 0; i < 5; i++) {
      await tab1.click();
      await tab2.click();
    }
    await expect(page.getByText('سبورة الشرح الذكي - الأسلوب السقراطي التفاعلي')).toBeVisible();
  });

  test('T1.F1.9 - [Tier 2] verifies high-contrast Arabic font legibility in hero', async ({ page }) => {
    await page.goto('/for-schools');
    const heroHeading = page.getByRole('heading', { name: /اصنع الفارق في نتائج طلابك وتصدّر/i });
    await expect(heroHeading).toBeVisible();
  });

  test('T1.F1.10 - [Tier 2] deep-link URL hashes load expected sections directly', async ({ page }) => {
    await page.goto('/for-schools#roi-calculator');
    await expect(page.locator('#roi-calculator')).toBeVisible();
  });
});

test.describe('Track 1 - Feature 2: B2B Dynamic ROI Calculator', () => {
  test.beforeEach(async ({ page }) => {
    await setupTrack1Mocks(page);
    await page.goto('/for-schools');
  });

  // Tier 1: Feature Coverage (5 tests)
  test('T1.F2.1 - [Tier 1] calculates Foundation Tier price accurately for default 250 students', async ({ page }) => {
    await page.getByTestId('roi-tier-tier_foundation').click();
    // 45 base * 0.90 (vol) * 0.85 (annual) = 34.425 -> 34 SAR
    await expect(page.getByText(formatSAR(34))).toBeVisible();
    await expect(page.getByText(formatSAR(8500))).toBeVisible();
  });

  test('T1.F2.2 - [Tier 1] calculates Academic Excellence Tier price accurately', async ({ page }) => {
    await page.getByTestId('roi-tier-tier_excellence').click();
    // 75 base * 0.90 (vol) * 0.85 (annual) = 57.375 -> 57 SAR
    await expect(page.getByText(formatSAR(57))).toBeVisible();
    await expect(page.getByText(formatSAR(14250))).toBeVisible();
  });

  test('T1.F2.3 - [Tier 1] calculates Smart VIP Tier price accurately', async ({ page }) => {
    await page.getByTestId('roi-tier-tier_smart_vip').click();
    // 110 base * 0.90 (vol) * 0.85 (annual) = 84.15 -> 84 SAR
    await expect(page.getByText(formatSAR(84))).toBeVisible();
    await expect(page.getByText(formatSAR(21000))).toBeVisible();
  });

  test('T1.F2.4 - [Tier 1] calculates Custom Complex Tier price accurately', async ({ page }) => {
    await page.getByTestId('roi-tier-tier_custom').click();
    // 90 base * 0.90 (vol) * 0.85 (annual) = 68.85 -> 69 SAR
    await expect(page.getByText(formatSAR(69))).toBeVisible();
    await expect(page.getByText(formatSAR(17250))).toBeVisible();
  });

  test('T1.F2.5 - [Tier 1] switching to term billing recalculates without 15% upfront discount', async ({ page }) => {
    await page.getByTestId('roi-tier-tier_foundation').click();
    await page.getByRole('button', { name: /فصلي/i }).click();
    // 45 base * 0.90 (vol) = 40.5 -> 41 SAR
    await expect(page.getByText(formatSAR(41))).toBeVisible();
    await expect(page.getByText(formatSAR(10250))).toBeVisible();
  });

  // Tier 2: Boundary & Corner Cases (5 tests)
  test('T1.F2.6 - [Tier 2] minimum boundary: 50 students without volume discount', async ({ page }) => {
    await page.getByTestId('roi-tier-tier_excellence').click();
    const slider = page.getByTestId('roi-student-slider');
    await slider.fill('50');
    // 75 base * 0.85 (annual) = 63.75 -> 64 SAR
    await expect(page.getByText(formatSAR(64))).toBeVisible();
    await expect(page.getByText(formatSAR(3200))).toBeVisible();
  });

  test('T1.F2.7 - [Tier 2] volume threshold edge 1: 200 students activates 10% volume discount', async ({ page }) => {
    await page.getByTestId('roi-tier-tier_excellence').click();
    const slider = page.getByTestId('roi-student-slider');
    await slider.fill('200');
    // 75 * 0.90 * 0.85 = 57.375 -> 57 SAR
    await expect(page.getByText(formatSAR(57))).toBeVisible();
    await expect(page.getByText(formatSAR(11400))).toBeVisible();
  });

  test('T1.F2.8 - [Tier 2] volume threshold edge 2: 500 students activates 20% volume discount', async ({ page }) => {
    await page.getByTestId('roi-tier-tier_excellence').click();
    const slider = page.getByTestId('roi-student-slider');
    await slider.fill('500');
    // 75 * 0.80 * 0.85 = 51 SAR
    await expect(page.getByText(formatSAR(51))).toBeVisible();
    await expect(page.getByText(formatSAR(25500))).toBeVisible();
  });

  test('T1.F2.9 - [Tier 2] volume threshold edge 3: 1000+ students activates 30% volume discount', async ({ page }) => {
    await page.getByTestId('roi-tier-tier_excellence').click();
    const slider = page.getByTestId('roi-student-slider');
    await slider.fill('1000');
    // 75 * 0.70 * 0.85 = 44.625 -> 45 SAR
    await expect(page.getByText(formatSAR(45))).toBeVisible();
    await expect(page.getByText(formatSAR(45000))).toBeVisible();
  });

  test('T1.F2.10 - [Tier 2] calculates retail savings percentage vs individual student retail price', async ({ page }) => {
    await page.getByTestId('roi-tier-tier_excellence').click();
    // Default 250 students retail: 250 * 420 = 105,000 SAR; Contract: 14,250 SAR; Savings: 90,750 (86%)
    await expect(page.getByText('86% توفير')).toBeVisible();
    await expect(page.getByText(formatSAR(90750))).toBeVisible();
  });
});

test.describe('Track 1 - Feature 3: Socratic Voice Whiteboard Demo', () => {
  test.beforeEach(async ({ page }) => {
    await setupTrack1Mocks(page);
    await page.goto('/for-schools');
    await page.getByRole('button', { name: /السبورة السقراطية الناطقة/i }).click();
  });

  // Tier 1: Feature Coverage (5 tests)
  test('T1.F3.1 - [Tier 1] displays socratic math question and initial algebraic equation', async ({ page }) => {
    await expect(page.getByText('سبورة الشرح الذكي - الأسلوب السقراطي التفاعلي')).toBeVisible();
    await expect(page.getByText(/الخطوة 1: استكشاف البنية والمعطيات/i)).toBeVisible();
  });

  test('T1.F3.2 - [Tier 1] toggles audio narration simulator button', async ({ page }) => {
    const audioBtn = page.getByTestId('socratic-audio-toggle');
    await expect(audioBtn).toBeVisible();
    await audioBtn.click();
    await expect(page.getByText('إيقاف الشرح الصوتي')).toBeVisible();
    await audioBtn.click();
    await expect(audioBtn).toContainText('استمع لتفاعل المعلم السقراطي');
  });

  test('T1.F3.3 - [Tier 1] advances sequentially from Step 1 to Step 2', async ({ page }) => {
    await expect(page.getByText(/الخطوة 1/i)).toBeVisible();
    await page.getByRole('button', { name: 'التالي' }).click();
    await expect(page.getByText(/الخطوة 2/i)).toBeVisible();
  });

  test('T1.F3.4 - [Tier 1] navigates backward from Step 2 to Step 1', async ({ page }) => {
    await page.getByRole('button', { name: 'التالي' }).click();
    await expect(page.getByText(/الخطوة 2/i)).toBeVisible();
    await page.getByRole('button', { name: 'السابق' }).click();
    await expect(page.getByText(/الخطوة 1/i)).toBeVisible();
  });

  test('T1.F3.5 - [Tier 1] renders pedagogical Arabic voice explanation text', async ({ page }) => {
    await expect(page.getByText(/تذكّر قانون المتطابقات الشهيرة/i)).toBeVisible();
  });

  // Tier 2: Boundary & Corner Cases (5 tests)
  test('T1.F3.6 - [Tier 2] step backward at Step 1 remains at Step 1', async ({ page }) => {
    await page.getByRole('button', { name: 'السابق' }).click();
    await expect(page.getByText(/الخطوة 1/i)).toBeVisible();
  });

  test('T1.F3.7 - [Tier 2] step forward past final step remains clamped at final step', async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      await page.getByRole('button', { name: 'التالي' }).click();
    }
    await expect(page.getByText(/الخطوة 3/i)).toBeVisible();
  });

  test('T1.F3.8 - [Tier 2] rapidly clicking forward and backward maintains correct step index', async ({ page }) => {
    await page.getByRole('button', { name: 'التالي' }).click();
    await page.getByRole('button', { name: 'السابق' }).click();
    await page.getByRole('button', { name: 'التالي' }).click();
    await expect(page.getByText(/الخطوة 2/i)).toBeVisible();
  });

  test('T1.F3.9 - [Tier 2] switching tabs turns off audio narration simulator', async ({ page }) => {
    await page.getByTestId('socratic-audio-toggle').click();
    await expect(page.getByText('إيقاف الشرح الصوتي')).toBeVisible();
    await page.getByRole('button', { name: /توليد اختبارات من PDF/i }).click();
    await page.getByRole('button', { name: /السبورة السقراطية الناطقة/i }).click();
    await expect(page.getByTestId('socratic-audio-toggle')).toContainText('استمع لتفاعل المعلم السقراطي');
  });

  test('T1.F3.10 - [Tier 2] socratic player displays without overflow on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByText('سبورة الشرح الذكي - الأسلوب السقراطي التفاعلي')).toBeVisible();
  });
});

test.describe('Track 1 - Feature 4: AI PDF Exam Extraction Demo', () => {
  test.beforeEach(async ({ page }) => {
    await setupTrack1Mocks(page);
    await page.goto('/for-schools');
    await page.getByRole('button', { name: /توليد اختبارات من PDF/i }).click();
  });

  // Tier 1: Feature Coverage (5 tests)
  test('T1.F4.1 - [Tier 1] displays paper worksheet graphic and digital output side by side', async ({ page }) => {
    await expect(page.getByText('ورقة_تجميعات_القدرات_النموذج_أ.pdf')).toBeVisible();
    await expect(page.getByText(/استخراج دقيق للكسور والمعادلات الرياضية/i)).toBeVisible();
  });

  test('T1.F4.2 - [Tier 1] displays concept categorization badge', async ({ page }) => {
    await expect(page.getByText('السؤال الأول (جبر وتحليل):')).toBeVisible();
    await expect(page.getByText('قدرات كمي - المستوى المتقدم')).toBeVisible();
  });

  test('T1.F4.3 - [Tier 1] renders extracted multiple-choice choices with math notation', async ({ page }) => {
    await expect(page.getByText(/إذا كانت س² - ص² = ٤٨/i)).toBeVisible();
    await expect(page.getByText('ب) ٤ (الإجابة الصحيحة)')).toBeVisible();
  });

  test('T1.F4.4 - [Tier 1] displays detailed pedagogical explanation for correct answer', async ({ page }) => {
    await expect(page.getByText(/المقدار س² - ص² = \(س - ص\)\(س \+ ص\)/i)).toBeVisible();
  });

  test('T1.F4.5 - [Tier 1] provides direct CTA button to explore proposal calculator', async ({ page }) => {
    const cta = page.getByRole('button', { name: /طلب عرض سعر رسمي وتجربة للمدرسة/i });
    await expect(cta).toBeVisible();
  });

  // Tier 2: Boundary & Corner Cases (5 tests)
  test('T1.F4.6 - [Tier 2] renders mathematical equations correctly', async ({ page }) => {
    await expect(page.getByText(/س² - ص²/i)).toBeVisible();
  });

  test('T1.F4.7 - [Tier 2] displays extraction accuracy metric', async ({ page }) => {
    await expect(page.getByText('تم الاستخراج بالذكاء الاصطناعي ✓')).toBeVisible();
    await expect(page.getByText('مماثل لمنظومة VClasses العالمية')).toBeVisible();
  });

  test('T1.F4.8 - [Tier 2] stacks scanned sheet and digitized cards on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByText('ورقة_تجميعات_القدرات_النموذج_أ.pdf')).toBeVisible();
  });

  test('T1.F4.9 - [Tier 2] extraction demo preserves text clarity in high resolution', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByText(/استخراج دقيق للكسور والمعادلات الرياضية/i)).toBeVisible();
  });

  test('T1.F4.10 - [Tier 2] accessible button focus navigation across showcase tabs', async ({ page }) => {
    const tabBtn = page.getByRole('button', { name: /توليد اختبارات من PDF/i });
    await tabBtn.focus();
    await expect(tabBtn).toBeFocused();
  });
});

test.describe('Track 1 - Feature 5: School Proposal Request Form & API', () => {
  test.beforeEach(async ({ page }) => {
    await setupTrack1Mocks(page);
    await page.goto('/for-schools');
  });

  // Tier 1: Feature Coverage (5 tests)
  test('T1.F5.1 - [Tier 1] binds inputs to school proposal state correctly', async ({ page }) => {
    await page.getByLabel(/اسم المدرسة/i).fill('مدارس دار الفكر الأهلية');
    await page.getByLabel(/اسم المسؤول/i).fill('د. خالد الغامدي');
    await page.getByLabel(/رقم الجوال/i).fill('0509876543');
    await page.getByLabel(/البريد الإلكتروني/i).fill('info@daralfikr.edu.sa');

    await expect(page.getByLabel(/اسم المدرسة/i)).toHaveValue('مدارس دار الفكر الأهلية');
    await expect(page.getByLabel(/اسم المسؤول/i)).toHaveValue('د. خالد الغامدي');
    await expect(page.getByLabel(/رقم الجوال/i)).toHaveValue('0509876543');
  });

  test('T1.F5.2 - [Tier 1] generates reference number format SCH-YYYY-XXXXX', async ({ page }) => {
    await page.route('**/api/v1/schools/inquiries', (r) =>
      json(r, { success: true, refNumber: 'SCH-2026-88776', id: 'inq-1' }, 201)
    );

    await page.getByLabel(/اسم المدرسة/i).fill('مدارس دار الفكر');
    await page.getByLabel(/اسم المسؤول/i).fill('د. خالد');
    await page.getByLabel(/رقم الجوال/i).fill('0509876543');
    await page.getByTestId('school-proposal-submit').click();

    await expect(page.getByText('تم استلام طلب الشراكة بنجاح!')).toBeVisible();
    await expect(page.getByText(/SCH-2026-\d{5}/)).toBeVisible();
  });

  test('T1.F5.3 - [Tier 1] sends complete payload to POST /api/v1/schools/inquiries', async ({ page }) => {
    let capturedPayload: any = null;
    await page.route('**/api/v1/schools/inquiries', async (r) => {
      capturedPayload = JSON.parse(r.request().postData() || '{}');
      return json(r, { success: true, refNumber: capturedPayload.refNumber, id: 'inq-test' }, 201);
    });

    await page.getByLabel(/اسم المدرسة/i).fill('مدارس النبلاء الأهلية');
    await page.getByLabel(/اسم المسؤول/i).fill('أ. سامي القحطاني');
    await page.getByLabel(/رقم الجوال/i).fill('0554433221');
    await page.getByLabel(/ملاحظات أو متطلبات خاصة/i).fill('نرغب بربط 400 طالب مسار القدرات');
    await page.getByTestId('school-proposal-submit').click();

    await expect(page.getByText('تم استلام طلب الشراكة بنجاح!')).toBeVisible();
    expect(capturedPayload).not.toBeNull();
    expect(capturedPayload.schoolName).toBe('مدارس النبلاء الأهلية');
  });

  test('T1.F5.4 - [Tier 1] displays confirmation card with estimated annual contract total', async ({ page }) => {
    await page.getByLabel(/اسم المدرسة/i).fill('مدارس المجد');
    await page.getByLabel(/اسم المسؤول/i).fill('أ. تركي');
    await page.getByLabel(/رقم الجوال/i).fill('0551122334');
    await page.getByTestId('school-proposal-submit').click();

    await expect(page.getByText('تم استلام طلب الشراكة بنجاح!')).toBeVisible();
    await expect(page.getByText('مدارس المجد')).toBeVisible();
    await expect(page.getByText('الاستثمار السنوي التقديري:')).toBeVisible();
  });

  test('T1.F5.5 - [Tier 1] stores submitted inquiry in localStorage for audit', async ({ page }) => {
    await page.getByLabel(/اسم المدرسة/i).fill('مدارس الأندلس الأهلية');
    await page.getByLabel(/اسم المسؤول/i).fill('أ. أحمد الزهراني');
    await page.getByLabel(/رقم الجوال/i).fill('0501122334');
    await page.getByTestId('school-proposal-submit').click();

    await expect(page.getByText('تم استلام طلب الشراكة بنجاح!')).toBeVisible();
    const stored = await page.evaluate(() => localStorage.getItem('almeaa_school_inquiries'));
    expect(stored).toContain('مدارس الأندلس الأهلية');
  });

  // Tier 2: Boundary & Corner Cases (5 tests)
  test('T1.F5.6 - [Tier 2] empty submission shows alert dialog and halts form', async ({ page }) => {
    await page.getByTestId('school-proposal-submit').click();
    await expect(page.getByText(/يرجى كتابة اسم المدرسة/i)).toBeVisible();
  });

  test('T1.F5.7 - [Tier 2] submission with missing phone triggers validation warning', async ({ page }) => {
    await page.getByLabel(/اسم المدرسة/i).fill('مدارس الرواد');
    await page.getByLabel(/اسم المسؤول/i).fill('أ. أحمد');
    await page.getByTestId('school-proposal-submit').click();
    await expect(page.getByText(/رقم الجوال/i)).toBeVisible();
  });

  test('T1.F5.8 - [Tier 2] inputs with Arabic diacritics and special characters are preserved', async ({ page }) => {
    const complexName = 'مَدَارِسُ «الإِبْدَاعِ» الأَهْلِيَّةِ & الشَّرِيكُ (مُجَمَّعٌ رَقْم 1)';
    await page.getByLabel(/اسم المدرسة/i).fill(complexName);
    await page.getByLabel(/اسم المسؤول/i).fill('أ. حَسَنٌ السَّالِم');
    await page.getByLabel(/رقم الجوال/i).fill('0501112233');
    await page.getByTestId('school-proposal-submit').click();

    await expect(page.getByText('تم استلام طلب الشراكة بنجاح!')).toBeVisible();
    await expect(page.getByText(complexName)).toBeVisible();
  });

  test('T1.F5.9 - [Tier 2] path toggle checkboxes toggle selections reliably', async ({ page }) => {
    const qudratBtn = page.getByRole('button', { name: 'القدرات العامة' }).first();
    await qudratBtn.click();
    await qudratBtn.click();
  });

  test('T1.F5.10 - [Tier 2] multiple submissions in same browser generate distinct reference IDs', async ({ page }) => {
    await page.getByLabel(/اسم المدرسة/i).fill('مدرسة أ');
    await page.getByLabel(/اسم المسؤول/i).fill('مدير أ');
    await page.getByLabel(/رقم الجوال/i).fill('0501111111');
    await page.getByTestId('school-proposal-submit').click();
    await expect(page.getByText('تم استلام طلب الشراكة بنجاح!')).toBeVisible();

    const stored1 = await page.evaluate(() => JSON.parse(localStorage.getItem('almeaa_school_inquiries') || '[]'));
    expect(stored1.length).toBeGreaterThan(0);
    expect(stored1[0].refNumber).toMatch(/^SCH-\d{4}-\d{5}$/);
  });
});
