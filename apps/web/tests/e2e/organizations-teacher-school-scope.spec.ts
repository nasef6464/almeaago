import { expect, test, type Page, type Route } from '@playwright/test';

const teacher = {
  id: 'teacher-1', email: 'teacher@example.com', name: 'معلم الرياضيات',
  status: 'active', avatarUrl: '', emailVerified: true, role: 'teacher', roles: ['teacher'],
};
const schools = [
  { schoolId: 'school-a', schoolName: 'مدرسة ألف', source: 'membership', assignments: [
    { assignmentId: 'assign-a', classId: 'class-a', className: 'الأول ألف', subjectId: 'math-a', studentCount: 11 },
  ] },
  { schoolId: 'school-b', schoolName: 'مدرسة باء', source: 'membership', assignments: [
    { assignmentId: 'assign-b', classId: 'class-b', className: 'الثاني باء', subjectId: 'math-b', studentCount: 23 },
  ] },
];

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}
async function auth(page: Page, user: typeof teacher | null = teacher) {
  await page.route('**/api/v1/auth/me', route => json(route, { user }));
}

test('teacher keeps the selected authorized school and original overview on back/reload at 390, 820, 1440', async ({ page }) => {
  await auth(page);
  await page.route('**/api/v1/schools/teacher-workspace', route => json(route, {
    personas: { platformTrainer: false, schoolTeacher: true }, schools,
  }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/school-teacher-dashboard?schoolId=school-b');
  await expect(page.getByTestId('teacher-workspace')).toBeVisible();
  await expect(page.getByLabel('المدرسة الحالية')).toHaveValue('school-b');
  await expect(page.getByText('الثاني باء')).toBeVisible();
  await expect(page.getByText('الأول ألف')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'تنقل لوحة معلم المدرسة' })).toContainText('التعلم والجاهزية');
  await expect(page.getByRole('navigation', { name: 'تنقل لوحة معلم المدرسة' })).toContainText('اختباراتي وتكليفاتي');
  await expect(page.getByRole('link', { name: 'بدء حصة ذكية لهذا الفصل' })).toHaveAttribute('href', /schoolId=school-b.*assignmentId=assign-b/);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/teacher-school-b-390.png', fullPage: true });

  await page.getByLabel('المدرسة الحالية').selectOption('school-a');
  await expect(page).toHaveURL(/schoolId=school-a/);
  await expect(page.getByText('الأول ألف')).toBeVisible();
  await expect(page.getByText('الثاني باء')).toHaveCount(0);
  await page.setViewportSize({ width: 820, height: 900 });
  await page.reload();
  await expect(page.getByLabel('المدرسة الحالية')).toHaveValue('school-a');
  await expect(page.getByText('الأول ألف')).toBeVisible();
  await page.screenshot({ path: 'test-results/teacher-school-a-820.png', fullPage: true });

  await page.goBack();
  await expect(page.getByLabel('المدرسة الحالية')).toHaveValue('school-b');
  await expect(page.getByText('الثاني باء')).toBeVisible();
  await expect(page.getByText('الأول ألف')).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/teacher-school-b-1440.png', fullPage: true });
});

test('teacher workspace fails closed, retries the same school, and never falls back to an unassigned school', async ({ page }) => {
  await auth(page);
  let unavailable = true;
  await page.route('**/api/v1/schools/teacher-workspace', route =>
    unavailable ? json(route, { message: 'الخدمة غير متاحة' }, 503) : json(route, {
      personas: { platformTrainer: false, schoolTeacher: true }, schools: [schools[0]],
    }));
  await page.goto('/school-teacher-dashboard?schoolId=school-b');
  await expect(page.getByRole('alert')).toContainText('الخدمة غير متاحة');
  await expect(page.getByText('الأول ألف')).toHaveCount(0);
  unavailable = false;
  await page.getByRole('button', { name: 'إعادة المحاولة' }).click();
  await expect(page.getByText('المدرسة المحددة لم تعد ضمن تكليفاتك')).toBeVisible();
  await expect(page.getByText('الأول ألف')).toHaveCount(0);
  await expect(page.getByText('الثاني باء')).toHaveCount(0);
});

test('non-teacher role never requests teacher workspace', async ({ page }) => {
  await auth(page, { ...teacher, role: 'student', roles: ['student'] });
  let reads = 0;
  await page.route('**/api/v1/schools/teacher-workspace', route => {
    reads += 1;
    return json(route, { personas: { platformTrainer: false, schoolTeacher: false }, schools });
  });
  await page.goto('/school-teacher-dashboard?schoolId=school-b');
  await expect(page.getByText('هذه المساحة للمعلم المخول.')).toBeVisible();
  expect(reads).toBe(0);
});

test('classroom entry consumes the authorized school/assignment and never inherits another school session', async ({ page }) => {
  await auth(page);
  await page.route('**/api/v1/schools/teacher-workspace', route => json(route, {
    personas: { platformTrainer: false, schoolTeacher: true }, schools,
  }));
  await page.route('**/api/v1/taxonomy/bootstrap?phase=core', route => json(route, {
    paths: [{ id: 'path-1', code: 'PATH', name: 'قدرات' }],
    subjects: [{ id: 'math-a', pathId: 'path-1', code: 'MA', name: 'رياضيات أ' }, { id: 'math-b', pathId: 'path-1', code: 'MB', name: 'رياضيات ب' }],
  }));
  await page.route('**/api/v1/classroom/teacher/sessions', route => json(route, { sessions: [{
    id: 'other-school-session', schoolId: 'school-a', classId: 'class-a', subjectId: 'math-a',
    teacherId: 'teacher-1', status: 'draft', day: '', period: null, publishedMode: 'single',
    activeBatchId: '', activeQuestionOrdinal: null, pinExpiresAt: '', revision: 1,
    startedAt: null, endedAt: null, createdAt: '', updatedAt: '',
  }] }));
  const requestedSchools: string[] = [];
  await page.route('**/api/v1/classroom/questions*', route => {
    const url = new URL(route.request().url());
    requestedSchools.push(url.searchParams.get('schoolId') || '');
    return json(route, { items: [], page: 1, limit: 30, hasMore: false });
  });
  await page.route('**/api/v1/schools/*/roster?*', route => json(route, {
    members: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 1 },
  }));
  await page.goto('/school-teacher-dashboard/classroom?schoolId=school-b&assignmentId=assign-b');
  await expect(page.getByRole('heading', { name: 'نطاق التدريس' })).toBeVisible();
  await expect(page.getByRole('button', { name: /مدرسة باء · الثاني باء/ })).toHaveClass(/border-indigo-500/);
  await expect(page.getByText('الحصة الحالية')).toHaveCount(0);
  await expect.poll(() => requestedSchools).toContain('school-b');
  expect(requestedSchools).not.toContain('school-a');

  await page.getByRole('button', { name: /مدرسة ألف · الأول ألف/ }).click();
  await expect(page).toHaveURL(/schoolId=school-a&assignmentId=assign-a/);
  await expect(page.getByRole('button', { name: /مدرسة ألف · الأول ألف/ })).toHaveClass(/border-indigo-500/);
  await expect.poll(() => requestedSchools).toContain('school-a');
  await page.goBack();
  await expect(page.getByRole('button', { name: /مدرسة باء · الثاني باء/ })).toHaveClass(/border-indigo-500/);
  await page.reload();
  await expect(page.getByRole('button', { name: /مدرسة باء · الثاني باء/ })).toHaveClass(/border-indigo-500/);
});

test('classroom rejects a revoked school assignment instead of silently choosing another class', async ({ page }) => {
  await auth(page);
  await page.route('**/api/v1/schools/teacher-workspace', route => json(route, {
    personas: { platformTrainer: false, schoolTeacher: true }, schools: [schools[0]],
  }));
  await page.route('**/api/v1/taxonomy/bootstrap?phase=core', route => json(route, { paths: [], subjects: [] }));
  await page.route('**/api/v1/classroom/teacher/sessions', route => json(route, { sessions: [] }));
  let questionRequests = 0;
  await page.route('**/api/v1/classroom/questions*', route => {
    questionRequests += 1;
    return json(route, { items: [], page: 1, limit: 30, hasMore: false });
  });
  await page.goto('/school-teacher-dashboard/classroom?schoolId=school-b&assignmentId=assign-b');
  await expect(page.getByRole('alert')).toContainText('النطاق المحدد لم يعد ضمن تكليفاتك');
  expect(questionRequests).toBe(0);
  await expect(page.getByText('الحصة الحالية')).toHaveCount(0);
});

test('teacher overview counts each class roster once across multiple subject assignments', async ({ page }) => {
  await auth(page);
  await page.route('**/api/v1/schools/teacher-workspace', route => json(route, {
    personas: { platformTrainer: false, schoolTeacher: true },
    schools: [{
      schoolId: 'school-a', schoolName: 'مدرسة ألف', source: 'membership',
      assignments: [
        { assignmentId: 'math-a', classId: 'class-a', className: 'الأول ألف', subjectId: 'math', studentCount: 11 },
        { assignmentId: 'science-a', classId: 'class-a', className: 'الأول ألف', subjectId: 'science', studentCount: 11 },
        { assignmentId: 'math-b', classId: 'class-b', className: 'الثاني ألف', subjectId: 'math', studentCount: 23 },
      ],
    }],
  }));
  await page.goto('/school-teacher-dashboard?schoolId=school-a');
  await expect(page.getByTestId('teacher-workspace')).toBeVisible();
  const rosterCard = page.getByText('طلاب فصولي',{exact:true}).locator('xpath=../..');
  await expect(rosterCard).toContainText('34');
  await expect(rosterCard).not.toContainText('45');
});

test('teacher class total is stable when two subject assignments have stale roster snapshots', async ({ page }) => {
  await auth(page);
  await page.route('**/api/v1/schools/teacher-workspace', route => json(route, {
    personas: { platformTrainer: false, schoolTeacher: true },
    schools: [{
      schoolId: 'school-a', schoolName: 'مدرسة ألف', source: 'membership',
      assignments: [
        { assignmentId: 'math-a', classId: 'class-a', className: 'الأول ألف', subjectId: 'math', studentCount: 11 },
        { assignmentId: 'science-a', classId: 'class-a', className: 'الأول ألف', subjectId: 'science', studentCount: 9 },
        { assignmentId: 'math-b', classId: 'class-b', className: 'الثاني ألف', subjectId: 'math', studentCount: 23 },
      ],
    }],
  }));
  await page.goto('/school-teacher-dashboard?schoolId=school-a');
  await expect(page.getByTestId('teacher-workspace')).toBeVisible();
  const rosterCard = page.getByText('طلاب فصولي',{exact:true}).locator('xpath=../..');
  await expect(rosterCard).toContainText('34');
  await expect(rosterCard).not.toContainText('32');
});

test('teacher overview isolates roster totals when schools share a class identifier', async ({ page }) => {
  await auth(page);
  await page.route('**/api/v1/schools/teacher-workspace', route => json(route, {
    personas: { platformTrainer: false, schoolTeacher: true },
    schools: [
      { schoolId: 'school-a', schoolName: 'مدرسة ألف', source: 'membership', assignments: [
        { assignmentId: 'a-math', classId: 'shared-class', className: 'فصل ألف', subjectId: 'math', studentCount: 11 },
        { assignmentId: 'a-science', classId: 'shared-class', className: 'فصل ألف', subjectId: 'science', studentCount: 9 },
      ] },
      { schoolId: 'school-b', schoolName: 'مدرسة باء', source: 'membership', assignments: [
        { assignmentId: 'b-math', classId: 'shared-class', className: 'فصل باء', subjectId: 'math', studentCount: 23 },
      ] },
    ],
  }));
  await page.goto('/school-teacher-dashboard?schoolId=school-a');
  const rosterCard = page.getByText('طلاب فصولي',{exact:true}).locator('xpath=../..');
  await expect(rosterCard).toContainText('11');
  await expect(rosterCard).not.toContainText('34');
  await page.getByLabel('المدرسة الحالية').selectOption('school-b');
  await expect(rosterCard).toContainText('23');
  await expect(page.getByText('فصل ألف')).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('المدرسة الحالية')).toHaveValue('school-b');
  await expect(rosterCard).toContainText('23');
  await expect(page.getByText('فصل ألف')).toHaveCount(0);
});

test('empty teacher class shows zero real students', async ({page}) => {
 await auth(page);
 await page.route('**/api/v1/schools/teacher-workspace', route => json(route,{personas:{platformTrainer:false,schoolTeacher:true},schools:[{schoolId:'school-a',schoolName:'مدرسة ألف',source:'membership',assignments:[{assignmentId:'a',classId:'c',className:'فصل أ',subjectId:'math',studentCount:0}]}]}));
 await page.goto('/school-teacher-dashboard?schoolId=school-a');
 await expect(page.getByText('طلاب فصولي',{exact:true}).locator('xpath=../..')).toContainText('0');
 await expect(page.getByText('0 طلاب مسجلين')).toBeVisible();
});

test('unknown school link never substitutes a different school', async ({page}) => {
 await auth(page);
 await page.route('**/api/v1/schools/teacher-workspace',route=>json(route,{personas:{platformTrainer:false,schoolTeacher:true},schools}));
 await page.goto('/school-teacher-dashboard?schoolId=unknown');
 await expect(page.getByRole('alert')).toContainText('المدرسة المطلوبة غير متاحة لحسابك');
 await expect(page.getByText('مدرسة ألف')).toHaveCount(0);
 await expect(page.getByText('مدرسة باء')).toHaveCount(0);
});

test('teacher assessments load from server and learning evidence supports 5-status and source switching', async ({ page }) => {
  await auth(page);
  await page.route('**/api/v1/schools/teacher-workspace', route => json(route, {
    personas: { platformTrainer: false, schoolTeacher: true }, schools,
  }));
  await page.route('**/api/v1/schools/school-a/roster*', route => json(route, {
    members: [
      { userId: 'real-student-1', name: 'خالد عبدالله', role: 'student', classIds: ['class-a'] },
      { userId: 'real-student-2', name: 'عمر القحطاني', role: 'student', classIds: ['class-a'] },
    ],
    pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
  }));
  await page.route('**/api/v1/assessments?limit=100', route => json(route, {
    items: [
      { id: 'srv-1', code: 'TCH-1', title: 'اختبار خادمي موجه', kind: 'normal', workflowStatus: 'draft', isPublished: false, totalQuestions: 10 },
    ],
  }));

  const evidenceRequests: string[] = [];
  await page.route('**/api/v1/learning/evidence*', route => {
    const url = route.request().url();
    evidenceRequests.push(url);
    const source = new URL(url).searchParams.get('source') || 'school_assessment';
    return json(route, {
      source,
      subjectId: '',
      days: 30,
      policy: { minimumAnswers: 5, supportBelow: 60, readyFrom: 80 },
      coverage: 'school_scoped_students',
      total: 2,
      filteredTotal: 2,
      page: 1,
      limit: 50,
      summary: { unmeasured: 0, insufficient: 1, support: 0, developing: 0, ready: 1 },
      students: [
        {
          id: 'real-student-1',
          name: source === 'platform_self_study' ? 'خالد عبدالله (ذاتي)' : 'خالد عبدالله',
          status: 'ready',
          skillCount: 1,
          skills: [{ id: 'sk-1', name: 'التناسب', accuracy: 88, questions: 8, correct: 7, tests: 1, status: 'ready' }],
        },
        {
          id: 'real-student-2',
          name: 'عمر القحطاني',
          status: 'insufficient',
          skillCount: 1,
          skills: [{ id: 'sk-2', name: 'الكسور', accuracy: 50, questions: 2, correct: 1, tests: 1, status: 'insufficient' }],
        },
      ],
    });
  });

  await page.goto('/school-teacher-dashboard?schoolId=school-a');
  await expect(page.getByTestId('teacher-workspace')).toBeVisible();

  // Overview KPI reflects server assessments count (1)
  const countCard = page.getByText('اختبارات المدرسة').locator('xpath=../..');
  await expect(countCard).toContainText('1');

  // Navigate to learning-evidence tab and verify real evidence + source toggle
  await page.getByRole('navigation', { name: 'تنقل لوحة معلم المدرسة' }).getByText('التعلم والجاهزية').click();
  await expect(page).toHaveURL(/tab=learning-evidence/);
  await expect(page.getByTestId('teacher-learning-evidence')).toBeVisible();
  await expect(page.getByText('سياسة القياس: الحد الأدنى 5 إجابات')).toBeVisible();
  await expect(page.getByText('خالد عبدالله')).toBeVisible();
  await expect(page.getByTestId('teacher-learning-evidence').locator('span', { hasText: 'شواهد غير كافية' }).first()).toBeVisible();

  // Switch source to platform_self_study
  await page.getByRole('button', { name: 'الدراسة الذاتية' }).click();
  await expect(page.getByText('خالد عبدالله (ذاتي)')).toBeVisible();
  expect(evidenceRequests.some(u => u.includes('source=platform_self_study'))).toBe(true);

  // Navigate to assessments tab and verify server item renders without localStorage draft box
  await page.getByRole('navigation', { name: 'تنقل لوحة معلم المدرسة' }).getByText('اختباراتي وتكليفاتي').click();
  await expect(page).toHaveURL(/tab=assessments/);
  await expect(page.getByText('اختبار خادمي موجه')).toBeVisible();
  await expect(page.getByText('المسودات والتكليفات المحفوظة محلياً')).toHaveCount(0);
});
