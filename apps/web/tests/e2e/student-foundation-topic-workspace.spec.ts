import { expect, test, type Page, type Route } from '@playwright/test';

const student = { id: 'student-1', name: 'طالب', email: 'student@example.com', roles: ['student'], role: 'student' };
const taxonomy = {
  paths: [{ id: 'p1', name: 'قدرات' }, { id: 'p2', name: 'تحصيلي' }],
  subjects: [{ id: 's1', pathId: 'p1', name: 'كمي' }, { id: 's2', pathId: 'p2', name: 'رياضيات' }],
};
const topic = { id: 't1', parentTopicId: '', title: 'النسب', description: 'شرح النسب', sortOrder: 1, isLocked: false };
const child = { id: 't1-child', parentTopicId: 't1', title: 'النسب المئوية', description: '', sortOrder: 2, isLocked: false };
const locked = { id: 't2', parentTopicId: '', title: 'التناسب المغلق', description: '', sortOrder: 3, isLocked: true };
const learningSpace = (pathId = 'p1', subjectId = 's1') => ({
  pathId, subjectId,
  courses: { items: [], hasMore: false },
  foundation: { items: pathId === 'p1' ? [topic, child, locked] : [{ ...topic, id: 'other-topic', title: 'مبادئ الجبر' }], hasMore: false },
  library: { items: [], hasMore: false },
});
const topicDetail = (row = topic) => ({
  topic: { ...row, pathId: 'p1', subjectId: 's1', lessons: [{ id: 'lesson-1', title: 'شرح النسب', description: '', type: 'video', durationSeconds: 600, isLocked: false, isPreview: false, commerceLocked: false, sortOrder: 1 }],
    libraryItems: [{ id: 'support-1', title: 'ملف النسب', description: '', type: 'pdf', isLocked: false }] },
});
function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}
async function setup(page: Page) {
  await page.route('**/api/v1/auth/me', (route) => json(route, { user: student }));
  await page.route('**/api/v1/content/homepage-settings', (route) => json(route, { brand: {}, navigation: {}, studentExperience: { visibilityMode: 'all' } }));
  await page.route('**/api/v1/learning/navigation-preferences', (route) => json(route, { user: { id: student.id, enrolledPaths: [], pathStageSelections: [] } }));
  await page.route('**/api/v1/taxonomy/bootstrap?phase=core', (route) => json(route, taxonomy));
  await page.route('**/api/v1/assessment-placements/subject-access-guide?**', route => {
    const query = new URL(route.request().url()).searchParams;
    return json(route, { pathId: query.get('pathId'), subjectId: query.get('subjectId'), categories: [], unavailable: ['courses'], complete: false });
  });
  await page.route('**/api/v1/learning-spaces/p1/subjects/s1?limit=50', (route) => json(route, learningSpace()));
  await page.route('**/api/v1/learning-spaces/p2/subjects/s2?limit=50', (route) => json(route, learningSpace('p2', 's2')));
}
for (const width of [390, 820, 1440]) {
  test(`foundation topic opens original lessons/support workspace at ${width}px without autoplay`, async ({ page }) => {
    await setup(page);
    await page.setViewportSize({ width, height: 900 });
    let detailReads = 0;
    await page.route('**/api/v1/learning-spaces/foundation/t1', (route) => { detailReads += 1; return json(route, topicDetail()); });
    await page.route('**/api/v1/learning-spaces/foundation/t1-child', (route) => json(route, topicDetail(child)));
    await page.goto('/category/p1?subject=s1&tab=skills');
    await expect(page.getByRole('heading', { name: 'النسب', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /النسب/, exact: false }).first().click();
    const dialog = page.getByTestId('foundation-topic-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('شرح النسب')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'الشروحات' })).toBeVisible();
    await dialog.getByRole('button', { name: 'ملف الدعم' }).click();
    await expect(dialog.getByText('ملف النسب')).toBeVisible();
    await expect(page).toHaveURL(/topic=t1.*content=support|content=support.*topic=t1/);
    expect(detailReads).toBeGreaterThan(0);
    await expect(page.locator('video[autoplay], iframe[autoplay]')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/foundation-topic-${width}.png`, fullPage: true });
  });
}

test('topic tab and subtopic selection survive reload and browser back', async ({ page }) => {
  await setup(page);
  await page.route('**/api/v1/learning-spaces/foundation/t1', (route) => json(route, topicDetail()));
  await page.route('**/api/v1/learning-spaces/foundation/t1-child', (route) => json(route, topicDetail(child)));
  await page.goto('/category/p1?subject=s1&tab=skills');
  await page.getByRole('button', { name: /النسب/, exact: false }).first().click();
  const dialog = page.getByTestId('foundation-topic-dialog');
  await dialog.getByRole('button', { name: 'النسب المئوية' }).click();
  await expect(page).toHaveURL(/topic=t1-child/);
  await dialog.getByRole('button', { name: 'ملف الدعم' }).click();
  await page.reload();
  await expect(dialog.getByRole('button', { name: 'ملف الدعم' })).toHaveClass(/border-indigo-600/);
  await expect(dialog.getByText('النسب المئوية')).toBeVisible();
  await page.goBack();
  await expect(dialog.getByRole('button', { name: 'الشروحات' })).toHaveClass(/border-indigo-600/);
  await dialog.getByRole('button', { name: 'إغلاق' }).click();
  await expect(dialog).toHaveCount(0);
});

test('locked topic does not fetch placement details or reveal lesson metadata', async ({ page }) => {
  await setup(page);
  let reads = 0;
  await page.route('**/api/v1/learning-spaces/foundation/t2', (route) => { reads += 1; return json(route, topicDetail(locked)); });
  await page.goto('/category/p1?subject=s1&tab=skills&topic=t2&content=lessons');
  const dialog = page.getByTestId('foundation-topic-dialog');
  await expect(dialog).toContainText('هذا الموضوع ضمن باقة التأسيس');
  await expect(dialog).not.toContainText('شرح النسب');
  expect(reads).toBe(0);
});

test('failed topic detail request offers retry without losing selection', async ({ page }) => {
  await setup(page);
  let attempts = 0;
  let outage = true;
  await page.route('**/api/v1/learning-spaces/foundation/t1', (route) => {
    attempts += 1;
    return outage ? json(route, { message: 'service unavailable' }, 503) : json(route, topicDetail());
  });
  await page.goto('/category/p1?subject=s1&tab=skills&topic=t1&content=lessons');
  const dialog = page.getByTestId('foundation-topic-dialog');
  await expect(dialog).toContainText('service unavailable');
  outage = false;
  await dialog.getByRole('button', { name: 'إعادة المحاولة' }).click();
  await expect(dialog.getByText('شرح النسب')).toBeVisible();
  expect(attempts).toBeGreaterThan(1);
});

test('switching learning scope closes stale topic and does not reuse prior subject', async ({ page }) => {
  await setup(page);
  await page.route('**/api/v1/learning-spaces/foundation/t1', (route) => json(route, topicDetail()));
  await page.goto('/learning?pathId=p1&subjectId=s1&tab=skills&topic=t1');
  await expect(page.getByTestId('foundation-topic-dialog')).toBeVisible();
  await page.getByLabel('المسار').selectOption('p2');
  await expect(page.getByTestId('foundation-topic-dialog')).toHaveCount(0);
  await page.getByLabel('المادة').selectOption('s2');
  await expect(page.getByText('مبادئ الجبر')).toBeVisible();
  await expect(page.getByText('النسب', { exact: true })).toHaveCount(0);
  await expect(page).not.toHaveURL(/topic=t1/);
});

test('foundation free filter reflects configured pricing rather than topic position or entitlement', async ({ page }) => {
  await setup(page);
  await page.route('**/api/v1/learning-spaces/p1/subjects/s1?limit=50', route => json(route, {
    ...learningSpace(), foundation: { items: [
      { ...topic, id: 'paid-open', title: 'موضوع مدفوع مفتوح', isFree: false, isLocked: false },
      { ...topic, id: 'free-second', title: 'موضوع مجاني ثان', sortOrder: 2, isFree: true, isLocked: false },
    ], hasMore: false },
  }));
  await page.goto('/category/p1?subject=s1&tab=skills');
  await expect(page.getByRole('heading', { name: 'موضوع مدفوع مفتوح' })).toBeVisible();
  await page.getByRole('button', { name: /المجاني \(1\)/ }).click();
  await expect(page.getByRole('heading', { name: 'موضوع مجاني ثان' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'موضوع مدفوع مفتوح' })).toHaveCount(0);
  await page.getByRole('button', { name: /ضمن باقة \(1\)/ }).click();
  await expect(page.getByRole('heading', { name: 'موضوع مدفوع مفتوح' })).toBeVisible();
});

test('locked training leads to path packages without starting an attempt', async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/taxonomy/bootstrap?phase=core', route => json(route, { ...taxonomy, subjects: [{ ...taxonomy.subjects[0], color: '#f45b12' }, taxonomy.subjects[1]] }));
  let starts = 0;
  const title = 'تدريب ضمن باقة على المهارات الأساسية والمسائل الطويلة الجزء الأول';
  await page.route('**/api/v1/assessment-placements/available?**', route => json(route, { items: [{ placementId: 'paid-training', assessmentId: 'a1', assessmentVersion: 1, title, slot: 'training', pathId: 'p1', subjectId: 's1', accessType: 'package', baseAccessType: 'free', accessAllowed: false, accessReason: 'package_required', canStart: false, attemptCount: 0, maxAttempts: 3 }], hasMore: false }));
  await page.route('**/api/v1/assessment-placements/subject-progress?**', route => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('pathId')).toBe('p1'); expect(url.searchParams.get('subjectId')).toBe('s1'); expect(url.searchParams.get('slot')).toBe('training');
    return json(route, { total: 75, completed: 2 });
  });
  await page.route('**/api/v1/assessment-placements/paid-training/start', route => { starts++; return json(route, {}, 500); });
  await page.goto('/category/p1?subject=s1&tab=questions');
  const header = page.getByRole('heading', { name: 'كمي', exact: true }).locator('xpath=ancestor::header');
  await expect(header).toHaveCSS('background-color', 'rgb(244, 91, 18)');
  await expect(page.getByLabel('المسار', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('المادة', { exact: true })).toHaveCount(0);
  await expect(page.getByText('بنك الأسئلة والتدريب الذكي')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'التدريب', exact: true })).toHaveCSS('background-color', 'rgb(244, 91, 18)');
  await expect(page.getByRole('progressbar', { name: 'نسبة إكمال تدريبات المادة' })).toHaveAttribute('aria-valuenow', '2');
  await expect(page.getByLabel('تقدم تدريبات المادة')).toContainText('أكملت 2 من 75 تدريبات منشورة');
  const heading = page.getByRole('heading', { name: title });
  await expect(heading).toBeVisible();
  expect(await heading.evaluate(node => node.scrollWidth <= node.clientWidth && getComputedStyle(node).textOverflow !== 'ellipsis')).toBe(true);
  const card = heading.locator('xpath=ancestor::article');
  await page.screenshot({ path: 'test-results/learning-training-paid-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  const cardBox = await card.boundingBox();
  expect(cardBox?.width).toBeGreaterThan(600);
  await page.screenshot({ path: 'test-results/learning-training-paid-desktop.png', fullPage: true });
  await card.getByRole('button', { name: 'فتح الباقة' }).click();
  await expect(page).toHaveURL(/\/category\/p1\?tab=packages/);
  const query = new URL(page.url()).searchParams;
  expect(query.get('subjectId')).toBe('s1'); expect(query.get('contentType')).toBe('banks');
  expect(query.get('returnTo')).toContain('tab=questions');
  expect(starts).toBe(0);
});

test('switching student hides prior foundation details before new access loads', async ({ page }) => {
  await setup(page);
  let second = false;
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/auth/login', route => { second = true; return json(route, { user: { ...student, id: 'student-2' } }); });
  await page.route('**/api/v1/learning-spaces/p1/subjects/s1?limit=50', async route => {
    if (!second) return json(route, learningSpace());
    await gate;
    return json(route, { ...learningSpace(), foundation: { items: [{ ...topic, isLocked: true, isFree: false }], hasMore: false } });
  });
  await page.route('**/api/v1/learning-spaces/foundation/t1', route => json(route, topicDetail()));
  await page.goto('/tests/e2e/fixtures/learning-account-scope.html?pathId=p1&subjectId=s1&tab=skills&topic=t1');
  const dialog = page.getByTestId('foundation-topic-dialog');
  await expect(dialog.getByText('شرح النسب')).toBeVisible();
  const newRequest = page.waitForRequest('**/api/v1/learning-spaces/p1/subjects/s1?limit=50');
  await page.getByRole('button', { name: 'تبديل الطالب' }).click();
  await newRequest;
  await expect(page.getByTestId('foundation-topic-dialog')).toHaveCount(0);
  release();
  await expect(page.getByTestId('foundation-topic-dialog')).toContainText('هذا الموضوع ضمن باقة التأسيس');
  await expect(page.getByTestId('foundation-topic-dialog')).not.toContainText('شرح النسب');
});

test('guest can see free topic and is asked to sign in to open its lesson', async ({ page }) => {
  await setup(page);
  await page.route('**/api/v1/auth/me', route => json(route, { user: null }));
  await page.route('**/api/v1/learning-spaces/foundation/t1', route => json(route, topicDetail()));
  await page.goto('/category/p1?subject=s1&tab=skills&topic=t1&content=lessons');
  const dialog = page.getByTestId('foundation-topic-dialog');
  await dialog.getByRole('button', { name: 'فتح الدرس: شرح النسب' }).click();
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  expect(decodeURIComponent(new URL(page.url()).searchParams.get('returnTo') || '')).toContain('topic=t1');
});

test('subject progress never carries over when switching students', async ({ page }) => {
  await setup(page);
  let second = false;
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/auth/login', route => { second = true; return json(route, { user: { ...student, id: 'student-2' } }); });
  await page.route('**/api/v1/assessment-placements/available?**', route => json(route, { items: [], hasMore: false }));
  await page.route('**/api/v1/assessment-placements/subject-progress?**', async route => {
    if (!second) return json(route, { total: 10, completed: 8 });
    await gate;
    return json(route, { total: 10, completed: 1 });
  });
  await page.goto('/tests/e2e/fixtures/learning-account-scope.html?pathId=p1&subjectId=s1&tab=questions');
  await expect(page.getByLabel('تقدم تدريبات المادة')).toContainText('أكملت 8 من 10');
  const next = page.waitForRequest('**/api/v1/assessment-placements/subject-progress?**');
  await page.getByRole('button', { name: 'تبديل الطالب' }).click();
  await next;
  await expect(page.getByLabel('تقدم تدريبات المادة')).toHaveCount(0);
  release();
  await expect(page.getByLabel('تقدم تدريبات المادة')).toContainText('أكملت 1 من 10');
});

test('subject progress offers retry when its service is unavailable', async ({ page }) => {
  await setup(page);
  let attempts = 0;
  await page.route('**/api/v1/assessment-placements/available?**', route => json(route, { items: [], hasMore: false }));
  await page.route('**/api/v1/assessment-placements/subject-progress?**', route => ++attempts === 1 ? json(route, { message: 'unavailable' }, 503) : json(route, { total: 4, completed: 1 }));
  await page.goto('/tests/e2e/fixtures/learning-account-scope.html?pathId=p1&subjectId=s1&tab=questions');
  const error = page.getByRole('alert').filter({ hasText: 'تعذر تحميل تقدم تدريبات المادة.' });
  await error.getByRole('button', { name: 'إعادة المحاولة' }).click();
  await expect(page.getByLabel('تقدم تدريبات المادة')).toContainText('أكملت 1 من 4');
  expect(attempts).toBe(2);
});

test('subject package catalogue retains exact scope and can show the full path', async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const packageA = { id: 'package-a', productType: 'package', name: 'باقة تدريبات كمي', description: '', priceMinor: 1000, currency: 'SAR', publicMembership: false, contentTypes: ['banks'] };
  const packageB = { ...packageA, id: 'package-b', name: 'باقة مادة أخرى', contentTypes: ['tests'] };
  await page.route('**/api/v1/commerce/catalog/products/package-a', route => json(route, { product: { ...packageA, accessMode: 'paid' } }));
  await page.route('**/api/v1/commerce/catalog/payment-options', route => json(route, { methods: ['transfer'], gatewayMode: 'manual_review' }));
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/commerce/catalog/products?**', async route => {
    const params = new URL(route.request().url()).searchParams;
    expect(params.get('pathId')).toBe('p1');
    if (params.has('contentType')) {
      expect(params.get('subjectId')).toBe('s1'); expect(params.get('contentType')).toBe('banks');
      return json(route, { items: [packageA], page: 1, limit: 100, hasMore: false });
    }
    expect(params.has('subjectId')).toBe(false);
    await gate;
    return json(route, { items: [packageA, packageB], page: 1, limit: 100, hasMore: false });
  });
  await page.goto('/category/p1?tab=packages&subjectId=s1&contentType=banks&returnTo=%2Fcategory%2Fp1%3Fsubject%3Ds1');
  await expect(page.getByText('باقات تغطي المحتوى المحدد')).toBeVisible();
  await expect(page.getByTestId('path-package-card')).toHaveCount(1);
  await expect(page.getByText('باقة مادة أخرى')).toHaveCount(0);
  await page.getByTestId('path-package-card').getByRole('button', { name: 'معاينة الباقة' }).click();
  const preview = page.getByRole('dialog', { name: 'معاينة باقة تدريبات كمي' });
  await expect(preview).toContainText('التدريب');
  await page.screenshot({ path: 'test-results/subject-package-preview-mobile.png', fullPage: true });
  await preview.getByRole('button', { name: 'اشترك الآن' }).click();
  const payment = page.getByTestId('payment-modal-shell');
  await expect(payment.getByTestId('payment-continue-purchase')).toBeEnabled();
  await payment.getByRole('button', { name: 'إغلاق', exact: true }).click();
  await page.getByTestId('path-package-card').getByRole('button', { name: 'معاينة الباقة' }).click();
  await expect(preview).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get('contentType')).toBe('banks');
  const fullPathRequest = page.waitForRequest(request => request.url().includes('/api/v1/commerce/catalog/products?') && !new URL(request.url()).searchParams.has('contentType'));
  await page.getByRole('button', { name: 'عرض كل باقات المسار' }).click();
  await fullPathRequest;
  await expect(page.getByTestId('path-package-card')).toHaveCount(0);
  release();
  await expect(page.getByTestId('path-package-card')).toHaveCount(2);
  await expect(page.getByText('باقة مادة أخرى')).toBeVisible();
  await expect(page.getByRole('button', { name: 'العودة إلى ساحة التعلم' })).toBeVisible();
});

test('unknown package content filter does not silently show unrelated offers', async ({ page }) => {
  await setup(page);
  let reads = 0;
  await page.route('**/api/v1/commerce/catalog/products?**', route => { reads++; return json(route, { items: [], hasMore: false }); });
  await page.goto('/category/p1?tab=packages&subjectId=s1&contentType=unknown');
  await expect(page.getByRole('alert').filter({ hasText: 'تعذر تحديد المادة ونوع المحتوى المطلوبين.' })).toBeVisible();
  expect(reads).toBe(0);
  await expect(page.getByRole('button', { name: 'عرض كل باقات المسار' })).toBeVisible();
});

test('subject access guide separates free, locked and directed content', async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/assessment-placements/subject-access-guide?**', route => json(route, {
    pathId: 'p1', subjectId: 's1', complete: false, unavailable: ['courses'], categories: [
      { type: 'foundation', hasContent: true, hasFree: true, hasOpen: true, hasLocked: false, hasRestricted: false },
      { type: 'banks', hasContent: true, hasFree: false, hasOpen: false, hasLocked: true, hasRestricted: false },
      { type: 'tests', hasContent: true, hasFree: false, hasOpen: false, hasLocked: false, hasRestricted: true },
      { type: 'library', hasContent: false, hasFree: false, hasOpen: false, hasLocked: false, hasRestricted: false },
    ],
  }));
  await page.goto('/category/p1?subject=s1&tab=skills');
  const guide = page.getByRole('region', { name: 'حالة الوصول لهذه المادة' });
  await expect(guide).toContainText('التأسيس'); await expect(guide).toContainText('يوجد مجاني');
  await expect(guide).toContainText('التدريب'); await expect(guide).toContainText('يحتاج باقة');
  await expect(guide).toContainText('الاختبارات'); await expect(guide).toContainText('محتوى موجّه');
  await expect(guide).toContainText('لم تُحسب حالة الدورات بعد.');
  await expect(guide).not.toContainText('كل المحتوى المنشور متاح');
  await guide.screenshot({ path: 'test-results/subject-access-guide-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await guide.screenshot({ path: 'test-results/subject-access-guide-desktop.png' });
  await guide.getByRole('link', { name: 'عرض الباقات' }).click();
  const query = new URL(page.url()).searchParams;
  expect(query.get('subjectId')).toBe('s1'); expect(query.get('contentType')).toBe('banks');
});

test('subject access guide reports failures and retries without false access', async ({ page }) => {
  await setup(page);
  let calls = 0;
  let outage = true;
  await page.route('**/api/v1/assessment-placements/subject-access-guide?**', route => { calls++; return outage ? json(route, { message: 'unavailable' }, 503) : json(route, { pathId: 'p1', subjectId: 's1', categories: [{ type: 'foundation', hasContent: true, hasFree: true, hasOpen: true, hasLocked: false, hasRestricted: false }], unavailable: ['courses'], complete: false }); });
  await page.goto('/category/p1?subject=s1&tab=skills');
  const error = page.getByRole('alert').filter({ hasText: 'تعذر التحقق من حالة الوصول للمادة.' });
  await expect(error).toBeVisible();
  outage = false;
  await error.getByRole('button', { name: 'إعادة المحاولة' }).click();
  await expect(page.getByRole('region', { name: 'حالة الوصول لهذه المادة' })).toContainText('التأسيس');
  expect(calls).toBeGreaterThan(1);
});

test('subject guide does not claim a locked course requires only a package', async ({ page }) => {
  await setup(page);
  await page.route('**/api/v1/assessment-placements/subject-access-guide?**', route => json(route, {
    pathId: 'p1', subjectId: 's1', complete: true, unavailable: [], categories: [
      { type: 'courses', hasContent: true, hasFree: false, hasOpen: false, hasLocked: true, hasRestricted: false },
    ],
  }));
  await page.goto('/category/p1?subject=s1&tab=courses');
  const guide = page.getByRole('region', { name: 'حالة الوصول لهذه المادة' });
  await expect(guide).toContainText('يحتاج شراء أو اشتراك');
  await guide.getByRole('link', { name: 'عرض الباقات' }).click();
  const query = new URL(page.url()).searchParams;
  expect(query.get('tab')).toBe('packages'); expect(query.has('contentType')).toBe(false);
});

test('subject access guide clears the previous student while new access loads', async ({ page }) => {
  await setup(page);
  let second = false;
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/auth/login', route => { second = true; return json(route, { user: { ...student, id: 'student-2' } }); });
  await page.route('**/api/v1/assessment-placements/subject-access-guide?**', async route => {
    if (second) await gate;
    return json(route, { pathId: 'p1', subjectId: 's1', categories: [{ type: 'foundation', hasContent: true, hasFree: false, hasOpen: !second, hasLocked: second, hasRestricted: false }], unavailable: ['courses'], complete: false });
  });
  await page.goto('/tests/e2e/fixtures/subject-guide-account.html');
  const guide = page.getByRole('region', { name: 'حالة الوصول لهذه المادة' });
  await expect(guide).toContainText('مفتوح');
  const next = page.waitForRequest('**/api/v1/assessment-placements/subject-access-guide?**');
  await page.getByRole('button', { name: 'تبديل الطالب' }).click();
  await next;
  await expect(guide).toHaveCount(0);
  release();
  await expect(guide).toContainText('يحتاج باقة');
});

test('foundation loads beyond first 50 with retry and preserves subtopics', async ({ page }) => {
  await setup(page);
  const initial = Array.from({ length: 50 }, (_, index) => ({ ...topic, id: `root-${index}`, title: `موضوع ${index}`, sortOrder: index + 1, isFree: true }));
  await page.route('**/api/v1/learning-spaces/p1/subjects/s1?limit=50', route => json(route, { ...learningSpace(), foundation: { items: initial, hasMore: true } }));
  await page.route('**/api/v1/learning-spaces/foundation/root-0', route => json(route, topicDetail(initial[0])));
  let attempts = 0;
  await page.route('**/api/v1/learning-spaces/p1/subjects/s1/foundation?**', route => {
    const query = new URL(route.request().url()).searchParams;
    expect(query.get('page')).toBe('2'); expect(query.get('limit')).toBe('50');
    attempts++;
    return attempts === 1 ? json(route, { message: 'temporary outage' }, 503) : json(route, { pathId:'p1', subjectId:'s1', page:2, hasMore:false, items:[
      { ...topic, id:'root-50', title:'موضوع بعد الخمسين', sortOrder:51, isFree:true },
      { ...child, id:'late-child', parentTopicId:'root-0', title:'فرع ظهر في الصفحة الثانية', sortOrder:52, isFree:true },
    ] });
  });
  await page.goto('/category/p1?subject=s1&tab=skills');
  await page.getByRole('button', { name:'عرض المزيد من موضوعات التأسيس' }).click();
  await expect(page.getByRole('alert').filter({ hasText:'temporary outage' })).toBeVisible();
  await page.getByRole('button', { name:'إعادة تحميل الموضوعات' }).click();
  await expect(page.getByRole('heading', { name:'موضوع بعد الخمسين', exact:true })).toBeVisible();
  await expect(page.getByRole('button', { name:'عرض المزيد من موضوعات التأسيس' })).toHaveCount(0);
  await page.getByRole('heading', { name:'موضوع 0', exact:true }).locator('xpath=ancestor::button').click();
  await expect(page.getByTestId('foundation-topic-dialog').getByRole('button', { name:'فرع ظهر في الصفحة الثانية' })).toBeVisible();
  expect(attempts).toBe(2);
});

test('late foundation page never appears for a different student', async ({ page }) => {
  await setup(page);
  let second = false;
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/auth/login', route => { second = true; return json(route, { user: { ...student, id:'student-2' } }); });
  await page.route('**/api/v1/learning-spaces/p1/subjects/s1?limit=50', route => json(route, { ...learningSpace(), foundation: { items: [{ ...topic, title: second ? 'محتوى الطالب الثاني' : 'محتوى الطالب الأول' }], hasMore: !second } }));
  await page.route('**/api/v1/learning-spaces/p1/subjects/s1/foundation?**', async route => {
    await gate;
    await json(route, { pathId:'p1', subjectId:'s1', page:2, hasMore:false, items:[{ ...topic, id:'old-page', title:'صفحة الطالب الأول المتأخرة' }] }).catch(() => {});
  });
  await page.goto('/tests/e2e/fixtures/learning-account-scope.html?pathId=p1&subjectId=s1&tab=skills');
  const oldPage = page.waitForRequest('**/api/v1/learning-spaces/p1/subjects/s1/foundation?**');
  await page.getByRole('button', { name:'عرض المزيد من موضوعات التأسيس' }).click();
  await oldPage;
  await page.getByRole('button', { name:'تبديل الطالب' }).click();
  await expect(page.getByRole('heading', { name:'محتوى الطالب الثاني', exact:true })).toBeVisible();
  release();
  await expect(page.getByText('صفحة الطالب الأول المتأخرة')).toHaveCount(0);
});
