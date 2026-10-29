import { expect, test, type Page, type Route } from '@playwright/test';

// Contract-only tests: this file does not modify the #168 implementation owner.
// Legacy source: pages/SubjectLearningPage.tsx (topic modal lesson/support actions).
const student = { id: 'student-1', name: 'طالب', email: 'student@example.com', role: 'student', roles: ['student'] };
const taxonomy = {
  paths: [{ id: 'p1', name: 'قدرات' }],
  subjects: [{ id: 's1', pathId: 'p1', name: 'كمي' }],
};
const availableTopic = { id: 't1', parentTopicId: '', title: 'النسب', description: '', sortOrder: 1, isLocked: false };
const lockedTopic = { id: 't2', parentTopicId: '', title: 'النسب المقفلة', description: '', sortOrder: 2, isLocked: true };
const space = {
  pathId: 'p1', subjectId: 's1',
  courses: { items: [], hasMore: false },
  foundation: { items: [availableTopic, lockedTopic], hasMore: false },
  library: { items: [], hasMore: false },
};
const topicDetail = {
  topic: {
    ...availableTopic,
    lessons: [{
      id: 'lesson-1', title: 'شرح النسب', description: '',
      type: 'video', durationSeconds: 600, isLocked: false,
      isPreview: false, commerceLocked: false, sortOrder: 1,
    }],
    libraryItems: [{ id: 'support-1', title: 'ملف النسب', description: '', type: 'pdf', isLocked: false }],
  },
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function setup(page: Page) {
  await page.route('**/api/v1/auth/me', (route) => json(route, { user: student }));
  await page.route('**/api/v1/taxonomy/bootstrap?phase=core', (route) => json(route, taxonomy));
  await page.route('**/api/v1/learning-spaces/p1/subjects/s1?limit=50', (route) => json(route, space));
  await page.route('**/api/v1/learning-spaces/foundation/t1', (route) => json(route, topicDetail));
}

for (const width of [390, 820, 1440]) {
  test(`available foundation lesson remains an explicit user action at ${width}px RTL`, async ({ page }) => {
    await setup(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/category/p1?subject=s1&tab=skills&topic=t1&content=lessons');
    const dialog = page.getByTestId('foundation-topic-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('شرح النسب')).toBeVisible();
    await expect(page.locator('video[autoplay], iframe[autoplay]')).toHaveCount(0);
    // Legacy renders an actionable lesson, not a decorative article.
    // Do not launch a video automatically or invent a new navigation control.
    await expect(dialog.getByRole('button', { name: /شرح النسب/ })).toBeVisible();
  });

  test(`available foundation support file retains an open action at ${width}px RTL`, async ({ page }) => {
    await setup(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/category/p1?subject=s1&tab=skills&topic=t1&content=support');
    const dialog = page.getByTestId('foundation-topic-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('ملف النسب')).toBeVisible();
    await expect(page.locator('video[autoplay], iframe[autoplay]')).toHaveCount(0);
    // Legacy's support row is clickable. Entitlement must still be enforced server-side.
    await expect(dialog.getByRole('button', { name: /ملف النسب/ })).toBeVisible();
  });

  test(`locked foundation topic never fetches private detail at ${width}px RTL`, async ({ page }) => {
    await setup(page);
    await page.setViewportSize({ width, height: 900 });
    let lockedReads = 0;
    await page.route('**/api/v1/learning-spaces/foundation/t2', (route) => {
      lockedReads += 1;
      return json(route, topicDetail);
    });
    await page.goto('/category/p1?subject=s1&tab=skills&topic=t2&content=lessons');
    const dialog = page.getByTestId('foundation-topic-dialog');
    await expect(dialog).toContainText('هذا الموضوع ضمن باقة التأسيس');
    await expect(dialog).not.toContainText('شرح النسب');
    expect(lockedReads).toBe(0);
  });
}
