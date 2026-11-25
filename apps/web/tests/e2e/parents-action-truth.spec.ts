import { expect, test, type Route } from '@playwright/test';

const parent = {
  id: 'parent-truth-1',
  email: 'parent-truth@example.com',
  name: 'ولي أمر',
  status: 'active',
  avatarUrl: '',
  emailVerified: true,
  role: 'parent',
  roles: ['parent'],
};

const dashboard = {
  children: [
    {
      studentId: 'student-1',
      name: 'سارة',
      avatarUrl: '',
      schoolIds: ['school-1'],
      weeklyStudyMinutes: 24,
      weeklyAssessmentCount: 2,
      weeklyAverageScore: 71.5,
      recentResults: [],
      weakSkills: [],
      nextAction: 'استمر في المتابعة الهادئة.',
    },
  ],
  summary: {
    totalChildren: 1,
    visibleChildren: 1,
    weeklyAssessmentCount: 2,
    weeklyAverageScore: 71.5,
    weakSkills: 0,
  },
  page: 1,
  limit: 20,
  hasMore: false,
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

for (const width of [390, 820, 1440]) {
  test(`parent WhatsApp digest preference persists across reload and rejects fake approvals at ${width}px RTL`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let digestEnabled = false;
    let revision = 1;
    let patchCalls = 0;

    await page.route('**/api/v1/auth/me', (route) => json(route, { user: parent }));
    await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf-parent-1' }));
    await page.route('**/api/v1/parents/dashboard?**', (route) => json(route, dashboard));
    await page.route('**/api/v1/notifications/me/preferences', async (route) => {
      if (route.request().method() === 'GET') {
        return json(route, {
          preferences: {
            userId: parent.id,
            parentWhatsAppDigestEnabled: digestEnabled,
            revision,
            updatedAt: '2026-11-25T09:00:00Z',
          },
        });
      }
      if (route.request().method() === 'PATCH') {
        patchCalls += 1;
        const headers = route.request().headers();
        expect(headers['x-csrf-token']).toBe('csrf-parent-1');
        const payload = route.request().postDataJSON() as { parentWhatsAppDigestEnabled: boolean; expectedRevision: number };
        expect(payload.expectedRevision).toBe(revision);
        digestEnabled = payload.parentWhatsAppDigestEnabled;
        revision += 1;
        return json(route, {
          preferences: {
            userId: parent.id,
            parentWhatsAppDigestEnabled: digestEnabled,
            revision,
            updatedAt: '2026-11-25T09:05:00Z',
          },
        });
      }
      return route.continue();
    });

    await page.goto('/parent-dashboard');
    const toggle = page.getByLabel('ملخصات واتساب الأسبوعية');
    await expect(toggle).toBeEnabled();
    await expect(toggle).not.toBeChecked();

    await toggle.click();
    await expect.poll(() => patchCalls).toBe(1);
    await expect(toggle).toBeChecked();

    await page.reload();
    await expect(page.getByLabel('ملخصات واتساب الأسبوعية')).toBeChecked();

    await page.getByRole('button', { name: /الموافقات/ }).click();
    await expect(page.getByText('فيصل بن سعد')).toHaveCount(0);
    await expect(page.getByText('لا توجد طلبات موافقات أو تراخيص مسجلة حالياً')).toBeVisible();

    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('parent WhatsApp digest toggle stays honest and shows error when PATCH fails', async ({ page }) => {
  await page.route('**/api/v1/auth/me', (route) => json(route, { user: parent }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf-parent-1' }));
  await page.route('**/api/v1/parents/dashboard?**', (route) => json(route, dashboard));
  await page.route('**/api/v1/notifications/me/preferences', (route) => {
    if (route.request().method() === 'GET') {
      return json(route, {
        preferences: {
          userId: parent.id,
          parentWhatsAppDigestEnabled: false,
          revision: 1,
          updatedAt: '2026-11-25T09:00:00Z',
        },
      });
    }
    return json(route, { message: 'تعذر حفظ التفضيل على الخادم' }, 500);
  });

  await page.goto('/parent-dashboard');
  const toggle = page.getByLabel('ملخصات واتساب الأسبوعية');
  await expect(toggle).toBeEnabled();
  await expect(toggle).not.toBeChecked();

  await toggle.click();
  await expect(page.getByRole('alert')).toContainText('تعذر حفظ التفضيل على الخادم');
  await expect(toggle).not.toBeChecked();
});
