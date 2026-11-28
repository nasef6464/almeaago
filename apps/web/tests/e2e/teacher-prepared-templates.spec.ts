import { expect, test, type Page, type Route } from '@playwright/test';

const teacher = {
  id: 'teacher-1',
  email: 'teacher@example.com',
  name: 'معلم الرياضيات',
  status: 'active',
  avatarUrl: '',
  emailVerified: true,
  role: 'teacher',
  roles: ['teacher'],
};

const schools = [
  {
    schoolId: 'school-a',
    schoolName: 'مدرسة ألف',
    source: 'membership',
    assignments: [
      {
        assignmentId: 'assign-a',
        classId: 'class-a',
        className: 'الأول ألف',
        subjectId: 'math-a',
        studentCount: 14,
      },
    ],
  },
];

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function setupBaseTeacherRoutes(page: Page) {
  await page.route('**/api/v1/auth/me', (route) => json(route, { user: teacher }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf-teacher' }));
  await page.route('**/api/v1/schools/teacher-workspace', (route) =>
    json(route, {
      personas: { platformTrainer: false, schoolTeacher: true },
      schools,
    }),
  );
  await page.route('**/api/v1/schools/school-a/roster*', (route) =>
    json(route, { members: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 1 } }),
  );
  await page.route('**/api/v1/assessments*', (route) => json(route, { items: [] }));
  await page.route('**/api/v1/classroom/teacher/sessions*', (route) => json(route, { sessions: [] }));
}

test('teacher prepared questions renders honest empty and failed states without hardcoded fallback or tpl-1/tpl-2', async ({ page }) => {
  await setupBaseTeacherRoutes(page);
  let failQuestions = true;
  await page.route('**/api/v1/classroom/questions*', (route) =>
    failQuestions
      ? json(route, { message: 'خدمة بنك أسئلة الفصل غير متاحة' }, 503)
      : json(route, { items: [], page: 1, limit: 40, hasMore: false }),
  );
  await page.route('**/api/v1/questions/classroom-templates?*', (route) =>
    json(route, { templates: [] }),
  );

  await page.goto('/school-teacher-dashboard?schoolId=school-a&tab=prepared-questions');
  await expect(page.getByText('بنك التحضير المسبق وحزم التحدي الصفية')).toBeVisible();
  await expect(page.getByText('حزمة افتتاحية الحصة')).toHaveCount(0);
  await expect(page.getByText('إذا كان س + ص = 8')).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('خدمة بنك أسئلة الفصل غير متاحة');

  failQuestions = false;
  await page.getByRole('button', { name: 'إعادة المحاولة' }).click();
  await expect(page.getByText('لا توجد أسئلة معتمدة متاحة تطابق البحث حالياً.')).toBeVisible();
  await expect(page.getByText('إذا كان س + ص = 8')).toHaveCount(0);
});

test('teacher creates, applies, previews real options, and deletes server-backed prepared templates across reload at 390/820/1440 RTL', async ({ page }) => {
  await setupBaseTeacherRoutes(page);
  const questionId1 = '01950000-0000-7000-8000-000000000101';
  const questionId2 = '01950000-0000-7000-8000-000000000102';
  let templates: Array<{
    id: string;
    schoolId: string;
    teacherId: string;
    title: string;
    questionIds: string[];
    challengeIds: string[];
    createdAt: string;
    updatedAt: string;
  }> = [];

  await page.route('**/api/v1/classroom/questions*', (route) =>
    json(route, {
      items: [
        {
          id: questionId1,
          version: 1,
          questionType: 'mcq',
          text: 'ما ناتج ضرب 12 في 15؟',
          difficulty: 'medium',
        },
        {
          id: questionId2,
          version: 2,
          questionType: 'mcq',
          text: 'إذا كان محيط مربع 36 سم فما طول ضلعه؟',
          difficulty: 'easy',
        },
      ],
      page: 1,
      limit: 40,
      hasMore: false,
    }),
  );

  await page.route(`**/api/v1/questions/${questionId1}/staff`, (route) =>
    json(route, { message: 'Forbidden' }, 403),
  );
  await page.route(`**/api/v1/questions/${questionId1}`, (route) =>
    json(route, {
      question: {
        id: questionId1,
        questionCode: 'Q-REAL-101',
        version: 1,
        pathId: 'path-1',
        subjectId: 'math-a',
        type: 'mcq',
        text: 'ما ناتج ضرب 12 في 15؟',
        imageAssetId: '',
        imageUrl: '',
        imageAlt: '',
        optionsEmbeddedInImage: false,
        videoUrl: '',
        difficulty: 'medium',
        examType: 'qudrat',
        embeddedOptionTexts: [],
        options: [
          { index: 0, text: '150', assetId: '' },
          { index: 1, text: '180', assetId: '' },
          { index: 2, text: '195', assetId: '' },
          { index: 3, text: '210', assetId: '' },
        ],
        skillLinks: [],
      },
    }),
  );

  await page.route(url => /^[/]api[/]v1[/]questions[/]classroom-templates(?:[/][^/]+)?$/.test(url.pathname), async (route) => {
    const req = route.request();
    if (req.method() === 'GET') {
      return json(route, { templates });
    }
    if (req.method() === 'POST') {
      expect(req.headers()['x-csrf-token']).toBe('csrf-teacher');
      const body = req.postDataJSON();
      const created = {
        id: 'tpl-server-1',
        schoolId: body.schoolId,
        teacherId: teacher.id,
        title: body.title,
        questionIds: body.questionIds,
        challengeIds: body.challengeIds,
        createdAt: '2026-11-27T12:00:00Z',
        updatedAt: '2026-11-27T12:00:00Z',
      };
      templates = [created, ...templates];
      return json(route, { template: created }, 201);
    }
    if (req.method() === 'DELETE') {
      expect(req.headers()['x-csrf-token']).toBe('csrf-teacher');
      const id = req.url().split('/').pop() || '';
      templates = templates.filter((t) => t.id !== id);
      return json(route, { deleted: true });
    }
    return route.fallback();
  });

  await page.goto('/school-teacher-dashboard?schoolId=school-a&tab=prepared-questions');
  await expect(page.getByText('ما ناتج ضرب 12 في 15؟')).toBeVisible();

  // Preview real options from API (not hardcoded الخيار الأول / ج) الخيار الصحيح)
  await page.getByRole('button', { name: /معاينة السؤال ما ناتج ضرب 12 في 15/ }).click();
  await expect(page.getByText('أ) 150')).toBeVisible();
  await expect(page.getByText('ب) 180')).toBeVisible();
  await expect(page.getByText('ج) الخيار الصحيح (المعتمد)')).toHaveCount(0);
  await page.getByRole('button', { name: 'إغلاق المعاينة' }).click();

  // Select question & mark as challenge, then save template to server
  await page.getByText('ما ناتج ضرب 12 في 15؟').click();
  await page.getByRole('button', { name: 'تعيين كتحدي' }).click();
  await page.getByRole('button', { name: /حفظ كحزمة تحضير \(1\)/ }).click();
  await page.getByPlaceholder(/حزمة مراجعة المتتابعات/).fill('حزمة الضرب السريع الخادمية');
  await page.getByRole('button', { name: 'حفظ الحزمة' }).click();
  await expect(page.getByText('حزمة الضرب السريع الخادمية', { exact: true })).toBeVisible();

  // Verify persistence across reload and no localStorage copy
  const localKeys = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.includes('teacher:templates')),
  );
  expect(localKeys).toEqual([]);

  await page.reload();
  await expect(page.getByText('حزمة الضرب السريع الخادمية', { exact: true })).toBeVisible();

  // Apply template
  await page.getByRole('button', { name: 'تحديد الأسئلة' }).click();
  await expect(page.getByRole('button', { name: /حفظ كحزمة تحضير \(1\)/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: /إطلاق الحزمة للفصل/ })).toBeDisabled();

  // RTL overflow check across 390, 820, 1440
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }

  // Delete template and confirm persistence across reload
  await page.getByRole('button', { name: 'حذف حزمة حزمة الضرب السريع الخادمية' }).click();
  await expect(page.getByText('حزمة الضرب السريع الخادمية', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('حزمة الضرب السريع الخادمية', { exact: true })).toHaveCount(0);
});
