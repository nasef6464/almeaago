import { expect, test, type Page } from '@playwright/test';

const student = { id: 'foundation-student', name: 'طالب', email: 'foundation@example.invalid', role: 'student', roles: ['student'], status: 'active' };
const topics = [
  { id: 'topic-main', parentTopicId: '', title: 'النسب', description: '', sortOrder: 1, isLocked: false },
  { id: 'topic-child', parentTopicId: 'topic-main', title: 'النسب المئوية', description: '', sortOrder: 2, isLocked: false },
  { id: 'topic-locked', parentTopicId: '', title: 'التناسب المقفل', description: '', sortOrder: 3, isLocked: true },
];
const placement = (id = 'placement-1', topicId = 'topic-main', extra = {}) => ({ placementId: id, assessmentId: `assessment-${id}`, assessmentVersion: 1, assessmentKind: 'normal', title: `تدريب ${id}`, slot: 'foundation', pathId: 'path-1', subjectId: 'subject-1', courseId: '', lessonId: '', topicId, sortOrder: 1, attemptCount: 0, maxAttempts: 3, accessType: 'free', baseAccessType: 'free', accessAllowed: true, accessReason: 'free', canStart: true, ...extra });
async function setup(page: Page) {
  await page.route(url => url.origin !== 'http://127.0.0.1:4173', route => route.abort('blockedbyclient'));
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/v1/auth/me') return route.fulfill({ json: { user: student } });
    if (pathname === '/api/v1/auth/csrf') return route.fulfill({ json: { csrfToken: 'foundation-csrf' } });
    if (pathname === '/api/v1/content/homepage-settings') return route.fulfill({ json: { studentExperience: { visibilityMode: 'all' } } });
    if (pathname === '/api/v1/content/platform-font-settings') return route.fulfill({ json: {} });
    if (pathname === '/api/v1/learning/navigation-preferences') return route.fulfill({ json: { user: { id: student.id, enrolledPaths: [], pathStageSelections: [] } } });
    if (pathname === '/api/v1/taxonomy/bootstrap') return route.fulfill({ json: { paths: [{ id: 'path-1', name: 'قدرات', sortOrder: 1 }], levels: [], subjects: [{ id: 'subject-1', pathId: 'path-1', name: 'كمي', sortOrder: 1 }] } });
    if (pathname === '/api/v1/learning-spaces/path-1/subjects/subject-1') return route.fulfill({ json: { pathId: 'path-1', subjectId: 'subject-1', courses: { items: [], hasMore: false }, foundation: { items: topics, hasMore: false }, library: { items: [], hasMore: false } } });
    if (pathname.startsWith('/api/v1/learning-spaces/foundation/')) {
      const topic = topics.find(row => pathname.endsWith('/' + row.id));
      return route.fulfill({ json: { topic: { ...topic, lessons: [], libraryItems: [] } } });
    }
    if (route.request().method() !== 'GET') return route.fulfill({ status: 403, json: { message: 'Unexpected synthetic mutation' } });
    return route.fulfill({ json: { items: [], ads: [], announcements: [], unreadCount: 0, hasMore: false } });
  });
}
const open = (page: Page, topicId = 'topic-main') => page.goto(`/category/path-1?subject=subject-1&tab=skills&topic=${topicId}&content=quizzes`);

test('foundation lesson is opened only when selected and rejects an incorrect lesson response', async ({ page }) => {
  await setup(page);
  let reads = 0;
  let wrong = true;
  await page.route('**/api/v1/learning-spaces/foundation/topic-main', route => route.fulfill({ json: { topic: { ...topics[0], pathId: 'path-1', subjectId: 'subject-1', lessons: [{ id: 'lesson-1', title: 'درس أول', description: '', type: 'video', isLocked: false }, { id: 'lesson-2', title: 'درس ثان', description: '', type: 'video', isLocked: false }], libraryItems: [] } } }));
  await page.route('**/api/v1/learning-spaces/foundation/topic-main/lessons/lesson-1', route => {
    reads++;
    return route.fulfill({ json: { lesson: { id: wrong ? 'other' : 'lesson-1', title: 'درس أول', type: 'video', videoUrl: 'https://youtu.be/dQw4w9WgXcQ' } } });
  });
  await page.route('**/api/v1/learning-progress/lessons/lesson-1?**', route => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('contextType')).toBe('foundation');
    expect(url.searchParams.get('topicId')).toBe('topic-main');
    return route.fulfill({ json: { progress: { lessonId: 'lesson-1', contextType: 'foundation', topicId: 'topic-main', courseId: '', positionSeconds: 12, status: 'in_progress' } } });
  });
  await page.route('**/api/v1/learning-spaces/foundation/topic-main/lessons/lesson-2', route => {
    reads++;
    return route.fulfill({ json: { lesson: { id: 'lesson-2', title: 'درس ثان', type: 'video', videoUrl: 'https://youtu.be/dQw4w9WgXcQ' } } });
  });
  await page.route('**/api/v1/learning-progress/lessons/lesson-2?**', route => route.fulfill({ json: { progress: { lessonId: 'lesson-2', contextType: 'foundation', topicId: 'topic-main', courseId: '', positionSeconds: 0, status: 'not_started' } } }));
  await page.goto('/category/path-1?subject=subject-1&tab=skills&topic=topic-main&content=lessons');
  const dialog = page.getByTestId('foundation-topic-dialog');
  await expect(dialog.getByText('درس أول', { exact: true })).toBeVisible();
  expect(reads).toBe(0);
  await dialog.getByRole('button', { name: 'فتح الدرس: درس أول' }).click();
  await expect(dialog.getByRole('alert')).toContainText('تعذر التحقق من الدرس');
  expect(reads).toBe(1);
  wrong = false;
  await dialog.getByRole('button', { name: 'إعادة المحاولة', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await expect(dialog.getByRole('dialog', { name: 'الدرس المحدد' }).getByRole('heading', { name: 'درس أول' })).toBeVisible();
  await expect(dialog.locator('video[autoplay], iframe[src*="autoplay=1"]')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'إغلاق مشغل الفيديو' }).click();
  await expect(dialog.getByLabel('الدرس المحدد')).toHaveCount(0);
  await expect(dialog.getByText('درس ثان', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'فتح الدرس: درس ثان' }).click();
  await expect(dialog.getByRole('heading', { name: 'درس ثان' })).toBeVisible();
  expect(reads).toBe(3);
});

for (const width of [390, 820, 1440]) {
  test(`topic training queries exact scope, paginates and restores back without autoplay at ${width}px`, async ({ page }) => {
    await setup(page);
    await page.setViewportSize({ width, height: 1000 });
    const reads: string[] = [];
    await page.route('**/api/v1/assessment-placements/available?**', route => {
      const url = new URL(route.request().url()); reads.push(url.search);
      expect(url.searchParams.get('slot')).toBe('foundation');
      expect(url.searchParams.get('pathId')).toBe('path-1');
      expect(url.searchParams.get('subjectId')).toBe('subject-1');
      expect(url.searchParams.get('topicId')).toBe('topic-main');
      const current = Number(url.searchParams.get('page'));
      return route.fulfill({ json: { items: [placement(`page-${current}`)], page: current, limit: 30, hasMore: current === 1 } });
    });
    await open(page);
    const dialog = page.getByTestId('foundation-topic-dialog');
    await expect(dialog.getByRole('heading', { name: 'تدريب page-1', exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'التالي', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'تدريب page-2', exact: true })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'تدريب page-1', exact: true })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'السابق', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'تدريب page-1', exact: true })).toBeVisible();
    await expect(page.locator('video[autoplay],iframe[autoplay]')).toHaveCount(0);
    expect(reads.length).toBeGreaterThanOrEqual(3);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('topic placement read failure retains selection and retries; foreign topic response is rejected', async ({ page }) => {
  await setup(page);
  let mode = 'failed';
  await page.route('**/api/v1/assessment-placements/available?**', route => mode === 'failed'
    ? route.fulfill({ status: 503, json: { message: 'فشل تحميل التدريب التجريبي' } })
    : route.fulfill({ json: { items: [placement('correct', mode === 'foreign' ? 'other-topic' : 'topic-main')], page: 1, limit: 30, hasMore: false } }));
  await open(page);
  const dialog = page.getByTestId('foundation-topic-dialog');
  await expect(dialog.getByRole('alert')).toContainText('فشل تحميل التدريب التجريبي');
  await expect(page).toHaveURL(/topic=topic-main/);
  mode = 'foreign'; await dialog.getByRole('button', { name: 'إعادة المحاولة', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('تعذر تحميل تدريبات الموضوع');
  await expect(dialog.getByText('تدريب correct', { exact: true })).toHaveCount(0);
  mode = 'ok'; await dialog.getByRole('button', { name: 'إعادة المحاولة', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'تدريب correct', exact: true })).toBeVisible();
});

test('training access comes from placement policy even when foundation topic is locked', async ({ page }) => {
  await setup(page);
  let starts = 0;
  await page.route('**/api/v1/assessment-placements/available?**', route => route.fulfill({ json: { items: [placement('allowed', 'topic-locked'), placement('denied', 'topic-locked', { accessAllowed: false, canStart: false, accessReason: 'purchase_required' }), placement('exhausted', 'topic-locked', { canStart: false, attemptCount: 3 })], page: 1, limit: 30, hasMore: false } }));
  await page.route('**/api/v1/assessment-placements/*/start', route => { starts++; return route.fulfill({ status: 403, json: { message: 'ليس مصرحا' } }); });
  await open(page, 'topic-locked');
  const dialog = page.getByTestId('foundation-topic-dialog');
  await expect(dialog.getByRole('heading', { name: 'تدريب allowed', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'بدء التدريب: تدريب allowed', exact: true })).toBeEnabled();
  await expect(dialog.getByRole('button', { name: 'بدء التدريب: تدريب denied', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'بدء التدريب: تدريب exhausted', exact: true })).toBeDisabled();
  expect(starts).toBe(0);
});

test('failed training start retries the same idempotency key and sends CSRF before navigating', async ({ page }) => {
  await setup(page);
  await page.route('**/api/v1/assessment-placements/available?**', route => route.fulfill({ json: { items: [placement()], page: 1, limit: 30, hasMore: false } }));
  const starts: Array<{ key: string; csrf: string }> = [];
  await page.route('**/api/v1/assessment-placements/placement-1/start', route => {
    starts.push({ key: route.request().postDataJSON().startKey, csrf: route.request().headers()['x-csrf-token'] });
    return starts.length === 1 ? route.fulfill({ status: 503, json: { message: 'فشل بدء تجريبي' } }) : route.fulfill({ json: { attempt: { id: 'attempt-topic-1' } } });
  });
  await open(page);
  const dialog = page.getByTestId('foundation-topic-dialog');
  const start = dialog.getByRole('button', { name: 'بدء التدريب: تدريب placement-1', exact: true });
  await start.click(); await expect(dialog.getByRole('alert')).toContainText('فشل بدء تجريبي');
  await start.click(); await expect(page).toHaveURL(/\/assessment-attempts\/attempt-topic-1\?returnTo=/);
  expect(new URL(page.url()).searchParams.get('returnTo')).toContain('topic=topic-main');
  expect(starts).toHaveLength(2); expect(starts[0].key).toBeTruthy(); expect(starts[1]).toEqual(starts[0]); expect(starts[0].csrf).toBe('foundation-csrf');
});

test('late start response cannot navigate after learner selects a different topic', async ({ page }) => {
  await setup(page);
  await page.route('**/api/v1/assessment-placements/available?**', route => { const id = new URL(route.request().url()).searchParams.get('topicId')!; return route.fulfill({ json: { items: [placement(id, id)], page: 1, limit: 30, hasMore: false } }); });
  let release: (() => void) | undefined;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/assessment-placements/topic-main/start', async route => { await held; await route.fulfill({ json: { attempt: { id: 'stale-attempt' } } }); });
  await open(page);
  const dialog = page.getByTestId('foundation-topic-dialog');
  const started = page.waitForRequest('**/api/v1/assessment-placements/topic-main/start');
  await dialog.getByRole('button', { name: 'بدء التدريب: تدريب topic-main', exact: true }).click(); await started;
  await dialog.getByRole('button', { name: 'النسب المئوية', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'تدريب topic-child', exact: true })).toBeVisible();
  const completed = page.waitForResponse('**/api/v1/assessment-placements/topic-main/start');
  release?.(); await completed;
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page).toHaveURL(/topic=topic-child/);
  await expect(dialog.getByRole('heading', { name: 'تدريب topic-child', exact: true })).toBeVisible();
});

test('a late topic list cannot replace the newly selected topic', async ({ page }) => {
  await setup(page);
  let release: (() => void) | undefined;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/assessment-placements/available?**', async route => {
    const topicId = new URL(route.request().url()).searchParams.get('topicId')!;
    if (topicId === 'topic-main') await held;
    await route.fulfill({ json: { items: [placement(topicId, topicId)], page: 1, limit: 30, hasMore: false } });
  });
  const requested = page.waitForRequest(request => request.url().includes('/assessment-placements/available?') && new URL(request.url()).searchParams.get('topicId') === 'topic-main');
  await open(page); await requested;
  const dialog = page.getByTestId('foundation-topic-dialog');
  await dialog.getByRole('button', { name: 'النسب المئوية', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'تدريب topic-child', exact: true })).toBeVisible();
  release?.();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(dialog.getByRole('heading', { name: 'تدريب topic-main', exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/topic=topic-child/);
});
