import { expect, test, type Page, type Route } from '@playwright/test';

const schoolAdmin = {
  id: 'director-1',
  email: 'director@example.com',
  name: 'مدير المدرسة',
  status: 'active',
  avatarUrl: '',
  emailVerified: true,
  role: 'school_admin',
  roles: ['school_admin'],
};
const supervisor = {
  id: 'supervisor-1',
  email: 'supervisor@example.com',
  name: 'المشرف',
  status: 'active',
  avatarUrl: '',
  emailVerified: true,
  role: 'supervisor',
  roles: ['supervisor'],
};
const student = {
  id: 'student-1',
  email: 'student@example.com',
  name: 'الطالب',
  status: 'active',
  avatarUrl: '',
  emailVerified: true,
  role: 'student',
  roles: ['student'],
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function auth(page: Page, user: typeof schoolAdmin | typeof supervisor | typeof student) {
  await page.route('**/api/v1/auth/me', (route) => json(route, { user }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf-intervention' }));
}

const taxonomy = {
  paths: [{ id: 'path-1', code: 'QDR', name: 'القدرات', description: '', sortOrder: 1 }],
  subjects: [{ id: 'subject-1', pathId: 'path-1', code: 'QNT', name: 'الكمي', sortOrder: 1 }],
  skills: [{ id: 'skill-1', subjectId: 'subject-1', parentSkillId: '', code: 'RATIO', name: 'النسبة', description: '', kind: 'main', sortOrder: 1 }],
};

const baseIntervention = {
  id: 'intervention-1',
  schoolId: 'school-1',
  classId: 'class-1',
  studentId: 'student-1',
  pathId: 'path-1',
  subjectId: 'subject-1',
  skillId: 'skill-1',
  actionType: 'study_plan',
  studyPlanId: 'plan-school-1',
  status: 'active',
  assignedBy: 'director-1',
  followUpAt: null,
  remediationThreshold: 65,
  minimumEvidence: 3,
  baseline: { evidenceCount: 5, correct: 2, accuracy: 40, measuredAt: '2026-09-26T09:00:00Z' },
  outcome: null,
  createdAt: '2026-09-26T09:00:00Z',
  updatedAt: '2026-09-26T09:00:00Z',
};

async function staffFoundation(page: Page, user: typeof schoolAdmin | typeof supervisor) {
  await auth(page, user);
  await page.route('**/api/v1/taxonomy/bootstrap?phase=full', (route) => json(route, taxonomy));
  await page.route('**/api/v1/schools/context', (route) =>
    json(route, {
      contexts: [{
        schoolId: 'school-1',
        schoolName: 'مدرسة المئة',
        role: user.role,
        permissions: user.role === 'school_admin'
          ? ['SCHOOL_INTERVENTIONS_VIEW', 'SCHOOL_INTERVENTIONS_MANAGE']
          : [],
        source: 'membership',
      }],
    }),
  );
  await page.route('**/api/v1/schools/school-1/classes?**', (route) =>
    json(route, {
      classes: [{ id: 'class-1', schoolId: 'school-1', code: '1A', name: 'الأول أ', status: 'active' }],
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    }),
  );
  await page.route('**/api/v1/schools/school-1/roster?**', (route) =>
    json(route, {
      members: [{
        userId: 'student-1',
        name: 'طالب مستهدف',
        email: 'student@example.com',
        status: 'active',
        roles: ['student'],
        classIds: ['class-1'],
      }],
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    }),
  );
}

test('school director creates intervention, measures outcome and completes it', async ({ page }) => {
  await staffFoundation(page, schoolAdmin);
  let rows: any[] = [];
  let createCalls = 0;
  let measureCalls = 0;
  let patchCalls = 0;

  await page.route('**/api/v1/interventions/staff/intervention-1/measure', async (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().headers()['x-csrf-token']).toBe('csrf-intervention');
    expect(JSON.parse(route.request().postData() || '{}').expectedUpdatedAt).toBe('2026-09-26T09:00:00Z');
    measureCalls += 1;
    const measured = {
      ...rows[0],
      outcome: { evidenceCount: 4, correct: 3, accuracy: 75, measuredAt: '2026-09-28T09:00:00Z' },
      updatedAt: '2026-09-28T09:00:00Z',
    };
    rows = [measured];
    return json(route, {
      outcome: { intervention: measured, confidence: 'measured', delta: 35, thresholdMet: true },
    });
  });

  await page.route('**/api/v1/interventions/staff/intervention-1', async (route) => {
    expect(route.request().method()).toBe('PATCH');
    const body = JSON.parse(route.request().postData() || '{}');
    expect(body.status).toBe('completed');
    expect(body.expectedUpdatedAt).toBe('2026-09-28T09:00:00Z');
    patchCalls += 1;
    rows = [{ ...rows[0], status: 'completed', updatedAt: '2026-09-28T10:00:00Z' }];
    return json(route, { intervention: rows[0] });
  });

  await page.route('**/api/v1/interventions/staff**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname !== '/api/v1/interventions/staff') {
      return route.fallback();
    }
    if (request.method() === 'GET') {
      const url = new URL(request.url());
      expect(url.searchParams.get('schoolId')).toBe('school-1');
      expect(url.searchParams.get('classId')).toBe('class-1');
      expect(url.searchParams.get('limit')).toBe('50');
      return json(route, { items: rows, page: 1, limit: 50, hasMore: false });
    }
    expect(request.method()).toBe('POST');
    expect(request.headers()['x-csrf-token']).toBe('csrf-intervention');
    const body = JSON.parse(request.postData() || '{}');
    expect(body).toMatchObject({
      schoolId: 'school-1',
      classId: 'class-1',
      studentId: 'student-1',
      pathId: 'path-1',
      subjectId: 'subject-1',
      skillId: 'skill-1',
      remediationThreshold: 65,
      minimumEvidence: 3,
    });
    createCalls += 1;
    rows = [baseIntervention];
    return json(route, { intervention: baseIntervention }, 201);
  });

  await page.goto('/school-director-dashboard/interventions');
  await expect(page.getByRole('heading', { name: 'التدخلات والخطط العلاجية' })).toBeVisible();
  await page.getByLabel('مادة التدخل').selectOption('subject-1');
  await page.getByLabel('مهارة التدخل').selectOption('skill-1');
  await page.getByRole('button', { name: 'إنشاء خطة علاج' }).click();
  await expect.poll(() => createCalls).toBe(1);
  await expect(page.getByText('Baseline: 40.0% (5 أدلة)')).toBeVisible();

  await page.getByRole('button', { name: 'قياس النتيجة' }).click();
  await expect.poll(() => measureCalls).toBe(1);
  await expect(page.getByText(/التحسن 35.0 نقطة/)).toBeVisible();

  await page.getByRole('button', { name: 'إكمال' }).click();
  await expect.poll(() => patchCalls).toBe(1);
});

test('class scoped supervisor sends only exact class intervention reads', async ({ page }) => {
  await staffFoundation(page, supervisor);
  let reads = 0;
  await page.route('**/api/v1/interventions/staff?**', (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('schoolId')).toBe('school-1');
    expect(url.searchParams.get('classId')).toBe('class-1');
    reads += 1;
    return json(route, { items: [baseIntervention], page: 1, limit: 50, hasMore: false });
  });

  await page.goto('/supervisor-dashboard/interventions');
  await expect(page.getByRole('heading', { name: 'التدخلات والخطط العلاجية' })).toBeVisible();
  await expect.poll(() => reads).toBeGreaterThan(0);
  await expect(page.getByText('مهارة skill-1')).toBeVisible();
});

test('mobile student sees school intervention linked to generated study plan', async ({ page }) => {
  await auth(page, student);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/taxonomy/bootstrap?phase=core', (route) =>
    json(route, { paths: taxonomy.paths, subjects: taxonomy.subjects }),
  );
  await page.route('**/api/v1/interventions/mine?**', (route) =>
    json(route, { items: [baseIntervention], page: 1, limit: 20, hasMore: false }),
  );

  const plan = {
    id: 'plan-school-1',
    studentId: 'student-1',
    name: 'خطة علاج مهارة skill-1',
    pathId: 'path-1',
    subjectIds: ['subject-1'],
    courseIds: [],
    startDate: '2026-09-26',
    endDate: '2026-10-09',
    skipCompletedQuizzes: true,
    offDays: [],
    dailyMinutes: 30,
    preferredStartTime: '17:00',
    status: 'active',
    itemCount: 0,
    createdAt: '2026-09-26T09:00:00Z',
    updatedAt: '2026-09-26T09:00:00Z',
    items: [],
  };
  await page.route('**/api/v1/study-plans/plan-school-1', (route) => json(route, { plan }));
  await page.route('**/api/v1/study-plans/?**', (route) =>
    json(route, {
      items: [{
        id: plan.id,
        studentId: plan.studentId,
        name: plan.name,
        pathId: plan.pathId,
        startDate: plan.startDate,
        endDate: plan.endDate,
        skipCompletedQuizzes: plan.skipCompletedQuizzes,
        dailyMinutes: plan.dailyMinutes,
        preferredStartTime: plan.preferredStartTime,
        status: plan.status,
        itemCount: 0,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
      }],
      page: 1,
      limit: 20,
      hasMore: false,
    }),
  );

  await page.goto('/plan');
  await expect(page.getByRole('heading', { name: 'خطتي الدراسية' })).toBeVisible();
  await expect(page.getByText('خطط علاج المدرسة')).toBeVisible();
  await expect(page.getByText('Baseline: 40.0%')).toBeVisible();
  await expect(page.getByText(/خطة الدراسة: plan-school-1/)).toBeVisible();
  await page.screenshot({ path: 'test-results/learning-school-intervention-mobile.png', fullPage: true });
});
