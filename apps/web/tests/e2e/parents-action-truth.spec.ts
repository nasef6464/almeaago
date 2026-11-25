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
    await page.route('**/api/v1/parents/approvals', (route) => json(route, { items: [] }));
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

test('parent sends weekly report, approves pending payment request, and unlinks student via real APIs', async ({ page }) => {
  let sendReportCalls = 0;
  let approveCalls = 0;
  let unlinkCalls = 0;
  let approvalsList = [
    {
      id: 'req-parent-1',
      studentId: 'student-1',
      studentName: 'سارة',
      productId: 'prod-1',
      productName: 'دورة التأسيس الشاملة',
      productType: 'course',
      finalAmountMinor: 15000,
      currency: 'SAR',
      status: 'pending',
      parentApprovalStatus: 'pending',
      revision: 1,
      createdAt: '2026-11-25T09:00:00Z',
    },
  ];

  await page.route('**/api/v1/auth/me', (route) => json(route, { user: parent }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf-parent-1' }));
  await page.route('**/api/v1/parents/dashboard?**', (route) => json(route, dashboard));
  await page.route('**/api/v1/notifications/me/preferences', (route) =>
    json(route, {
      preferences: {
        userId: parent.id,
        parentWhatsAppDigestEnabled: false,
        revision: 1,
        updatedAt: '2026-11-25T09:00:00Z',
      },
    }),
  );
  await page.route('**/api/v1/parents/weekly-report?**', (route) =>
    json(route, {
      periodStart: '2026-11-18T00:00:00Z',
      periodEnd: '2026-11-25T00:00:00Z',
      children: [
        {
          studentId: 'student-1',
          name: 'سارة',
          avatarUrl: '',
          schoolIds: ['school-1'],
          assessmentCount: 2,
          averageScore: 71.5,
          studyMinutes: 24,
          weakSkills: [],
          nextAction: 'استمر في المتابعة الهادئة.',
        },
      ],
      page: 1,
      limit: 20,
      hasMore: false,
    }),
  );
  await page.route('**/api/v1/parents/weekly-report/send', (route) => {
    sendReportCalls += 1;
    expect(route.request().headers()['x-csrf-token']).toBe('csrf-parent-1');
    return json(route, {
      ok: true,
      campaignId: 'camp-1',
      recipients: 1,
      created: 1,
      studentsReported: 1,
      message: 'تم إرسال التقرير الأسبوعي إلى صندوق الإشعارات بنجاح.',
    });
  });
  await page.route('**/api/v1/parents/approvals', (route) => json(route, { items: approvalsList }));
  await page.route('**/api/v1/parents/approvals/req-parent-1/approve', (route) => {
    approveCalls += 1;
    expect(route.request().headers()['x-csrf-token']).toBe('csrf-parent-1');
    expect(route.request().postDataJSON()).toEqual({ expectedRevision: 1 });
    approvalsList = [];
    return json(route, {
      approval: { id: 'req-parent-1', parentApprovalStatus: 'approved', revision: 2 },
      message: 'تم اعتماد طلب ولي الأمر بنجاح.',
    });
  });
  await page.route('**/api/v1/parents/linked-students/student-1', (route) => {
    unlinkCalls += 1;
    expect(route.request().method()).toBe('DELETE');
    expect(route.request().headers()['x-csrf-token']).toBe('csrf-parent-1');
    return json(route, { studentId: 'student-1', message: 'تم إلغاء ربط الطالب' });
  });

  await page.goto('/parent-dashboard');
  await page.getByRole('button', { name: 'طلب التقرير' }).click();
  await expect.poll(() => sendReportCalls).toBe(1);
  await expect(page.getByText('التقرير الأسبوعي المبسط')).toBeVisible();

  await page.getByRole('button', { name: /الموافقات/ }).click();
  await expect(page.getByText('دورة التأسيس الشاملة')).toBeVisible();
  await page.getByRole('button', { name: 'موافقة' }).click();
  await expect.poll(() => approveCalls).toBe(1);
  await expect(page.getByText('لا توجد طلبات موافقات أو تراخيص مسجلة حالياً')).toBeVisible();

  await page.getByRole('button', { name: 'ربط ابن جديد' }).click();
  await page.getByRole('button', { name: 'إلغاء الربط' }).click();
  await expect.poll(() => unlinkCalls).toBe(1);
});

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
