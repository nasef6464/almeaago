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
