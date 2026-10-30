import { expect, test, type Route } from '@playwright/test';

const admin = {
  id: 'admin-skills-1', email: 'admin@example.com', name: 'مدير المنصة',
  role: 'admin', roles: ['admin'], status: 'active', emailVerified: true,
};
const taxonomy = {
  paths: [{ id: 'p1', code: 'QDR', name: 'القدرات', sortOrder: 0, status: 'active', description: '' }],
  levels: [],
  subjects: [{ id: 's1', pathId: 'p1', code: 'MATH', name: 'الكمي', sortOrder: 0, status: 'active' }],
  skills: [
    { id: 'm1', subjectId: 's1', code: 'ALG', name: 'الجبر', kind: 'main', sortOrder: 0, status: 'active', description: '' },
    { id: 'sub1', subjectId: 's1', parentSkillId: 'm1', code: 'LIN', name: 'المعادلات', kind: 'sub', sortOrder: 1, status: 'active', description: '' },
  ],
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

test('admin Skills Center is independent from paths and preserves failed subskill drafts', async ({ page }) => {
  await page.route('**/api/v1/auth/me', (route) => json(route, { user: admin }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'test-csrf' }));
  let currentSkills = [...taxonomy.skills];
  await page.route('**/api/v1/taxonomy/admin/bootstrap', (route) => json(route, { ...taxonomy, skills: currentSkills }));
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto('/admin-dashboard');
  await expect(page.getByRole('link', { name: /مركز المهارات/ }).first()).toHaveAttribute('href', '/admin-dashboard?tab=skills');
  await page.getByRole('link', { name: /مركز المهارات/ }).first().click();
  await expect(page.getByTestId('admin-skills-center')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'مركز المهارات' })).toBeVisible();
  await expect(page.getByTestId('skills-counter-main')).toContainText('1');
  await expect(page.getByTestId('skills-counter-sub')).toContainText('1');
  await page.getByRole('button', { name: 'فتح المهارة الرئيسة الجبر' }).click();
  await expect(page.getByText('المعادلات', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'إضافة مهارة فرعية' }).click();
  const dialog = page.getByRole('dialog', { name: 'إضافة مهارة فرعية' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox', { name: 'كود المهارة' }).fill('EQ2');
  await dialog.getByRole('textbox', { name: 'اسم المهارة' }).fill('حل المعادلات');
  let attempts = 0;
  await page.route('**/api/v1/taxonomy/admin/skills', async (route) => {
    const submitted = route.request().postDataJSON();
    expect(submitted).toMatchObject({ subjectId: 's1', parentSkillId: 'm1', kind: 'sub', code: 'EQ2', name: 'حل المعادلات' });
    attempts++;
    if (attempts === 1) return json(route, { message: 'تعارض مؤقت' }, 409);
    currentSkills = [...currentSkills, { id: 'sub2', subjectId: 's1', parentSkillId: 'm1', code: 'EQ2', name: 'حل المعادلات', kind: 'sub', sortOrder: 2, status: 'active', description: '' }];
    return json(route, { id: 'sub2' }, 201);
  });

  await dialog.getByRole('button', { name: 'حفظ المهارة' }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'اسم المهارة' })).toHaveValue('حل المعادلات');
  await expect(dialog.getByRole('alert')).toContainText('تعارض مؤقت');
  await dialog.getByRole('button', { name: 'حفظ المهارة' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId('skills-counter-sub')).toContainText('2');

  await page.goto('/admin-dashboard/taxonomy');
  await expect(page.getByRole('heading', { name: 'إدارة المسارات' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'إضافة المهارة' })).toHaveCount(0);
  await expect(page.getByText('شجرة المهارات')).toHaveCount(0);
});

test('subskill questions open the canonical question bank scoped to that exact subskill and can return to all questions', async ({ page }) => {
  await page.route('**/api/v1/auth/me', (route) => json(route, { user: admin }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'csrf' }));
  await page.route('**/api/v1/taxonomy/admin/bootstrap', (route) => json(route, taxonomy));
  await page.route('**/api/v1/taxonomy/bootstrap?phase=full', (route) => json(route, taxonomy));
  const requestedSkillIds: string[] = [];
  const makeQuestion = (code: string, skillId: string) => ({
    id: code, questionCode: code, currentVersion: 1, workflowStatus: 'approved',
    ownerType: 'platform', ownerId: '', pathId: 'p1', subjectId: 's1', assignedTeacherId: '',
    type: 'mcq', difficulty: 'medium', examType: '', source: 'manual', year: null,
    hasImage: false, hasVideo: false, hasExplanation: true, mainSkillId: 'm1',
    skillIds: ['m1', skillId], updatedAt: '2026-10-29T00:00:00Z',
  });
  await page.route('**/api/v1/questions?**', (route) => {
    const requestUrl = new URL(route.request().url());
    const skillId = requestUrl.searchParams.get('skillId') || '';
    requestedSkillIds.push(skillId);
    const items = skillId ? [makeQuestion('Q-LINKED', 'sub1')] : [makeQuestion('Q-LINKED', 'sub1'), makeQuestion('Q-OTHER', 'sub-other')];
    return json(route, { items, page: 1, limit: Number(requestUrl.searchParams.get('limit')), hasMore: false });
  });
  await page.route('**/api/v1/questions/coverage?**', (route) => {
    const skillId = new URL(route.request().url()).searchParams.get('skillId') || '';
    requestedSkillIds.push(skillId);
    return json(route, { questionsTotal: skillId ? 1 : 2, approved: skillId ? 1 : 2, pendingReview: 0, unlinked: 0, mainSkillCoverage: 1, subSkillCoverage: 1, skills: [], skillPage: 1, skillLimit: 50, skillsHasMore: false });
  });

  await page.goto('/admin-dashboard?tab=skills');
  await page.getByRole('button', { name: 'فتح المهارة الرئيسة الجبر' }).click();
  await page.getByRole('button', { name: 'فتح المهارة الفرعية المعادلات' }).click();
  await expect(page.getByRole('region', { name: 'تفاصيل مهارة المعادلات' })).toBeVisible();
  await expect(page.getByTestId('subskill-question-count-sub1')).toContainText('1 سؤال');
  await expect(page.getByRole('region', { name: 'تفاصيل مهارة المعادلات' }).getByText('Q-LINKED')).toBeVisible();
  await page.getByRole('link', { name: 'فتح بنك الأسئلة لهذه المهارة' }).click();
  await expect(page).toHaveURL(/\/admin-dashboard\/questions\?skillId=sub1$/);
  await expect(page.getByRole('region', { name: 'نطاق المهارة المحددة' })).toContainText('المعادلات');
  await expect(page.getByTestId('question-bank-admin').getByText('Q-LINKED')).toBeVisible();
  await expect(page.getByTestId('question-bank-admin').getByText('Q-OTHER')).toHaveCount(0);
  expect(requestedSkillIds).toContain('sub1');

  await page.getByRole('link', { name: 'عرض جميع الأسئلة' }).click();
  await expect(page).toHaveURL(/\/admin-dashboard\/questions$/);
  await expect(page.getByTestId('question-bank-admin').getByText('Q-OTHER')).toBeVisible();
  expect(requestedSkillIds).toContain('');
});

test('admin links and detaches a draft lesson from a subskill without deleting the lesson or losing other links', async ({ page }) => {
  await page.route('**/api/v1/auth/me', (route) => json(route, { user: admin }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'lesson-csrf' }));
  await page.route('**/api/v1/taxonomy/admin/bootstrap', (route) => json(route, taxonomy));
  await page.route('**/api/v1/questions?**', (route) => json(route, { items: [], page: 1, limit: 6, hasMore: false }));
  await page.route('**/api/v1/questions/coverage?**', (route) => json(route, { questionsTotal: 0, approved: 0, pendingReview: 0, unlinked: 0, mainSkillCoverage: 0, subSkillCoverage: 0, skills: [], skillPage: 1, skillLimit: 50, skillsHasMore: false }));

  let skillLinks = ['m1'];
  let revision = 3;
  const writes: Array<Record<string, unknown>> = [];
  const lessonSummary = () => ({
    id: 'lesson-42', pathId: 'p1', subjectId: 's1', title: 'شرح المعادلات', type: 'video', durationSeconds: 600,
    ownerType: 'platform', ownerUserId: '', ownerSchoolId: '', assignedTeacherId: '', workflowStatus: 'draft',
    isVisible: true, isLocked: false, revision, updatedAt: '2026-10-29T00:00:00Z',
  });
  const lessonDetail = () => ({
    ...lessonSummary(), description: 'درس محفوظ', contentText: 'نص الدرس', videoUrl: 'https://youtu.be/example',
    videoSource: 'youtube', meetingUrl: '', meetingAt: null, recordingUrl: '', joinInstructions: '', showRecording: false,
    createdBy: 'admin-skills-1', approvedBy: '', approvedAt: null, reviewerNotes: '', revenueSharePercentage: null,
    skillIds: [...skillLinks], assetIds: ['asset-original'], createdAt: '2026-10-29T00:00:00Z',
  });
  await page.route('**/api/v1/lessons?**', (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('subjectId')).toBe('s1');
    const skillId = url.searchParams.get('skillId');
    return json(route, { items: !skillId || skillLinks.includes(skillId) ? [lessonSummary()] : [], page: 1, limit: 50, hasMore: false });
  });
  await page.route('**/api/v1/lessons/lesson-42', async (route) => {
    if (route.request().method() === 'GET') return json(route, { lesson: lessonDetail() });
    expect(route.request().method()).toBe('PUT');
    expect(route.request().headers()['x-csrf-token']).toBe('lesson-csrf');
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    writes.push(payload);
    expect(payload.expectedRevision).toBe(revision);
    expect(payload.videoUrl).toBe('https://youtu.be/example');
    expect(payload.assetIds).toEqual(['asset-original']);
    skillLinks = payload.skillIds as string[];
    revision++;
    return json(route, { lesson: lessonDetail() });
  });

  await page.goto('/admin-dashboard?tab=skills');
  await page.getByRole('button', { name: 'فتح المهارة الرئيسة الجبر' }).click();
  await page.getByRole('button', { name: 'فتح المهارة الفرعية المعادلات' }).click();
  const detail = page.getByRole('region', { name: 'تفاصيل مهارة المعادلات' });
  await expect(detail.getByText('لا توجد دروس مرتبطة بهذه المهارة.')).toBeVisible();
  await detail.getByRole('button', { name: 'ربط درس موجود' }).click();
  const dialog = page.getByRole('dialog', { name: 'ربط درس موجود' });
  await expect(dialog.getByRole('option', { name: 'شرح المعادلات' })).toHaveCount(1);
  await expect(dialog.getByRole('combobox', { name: 'اختر الدرس' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'ربط', exact: true })).toBeDisabled();
  await dialog.getByRole('combobox', { name: 'اختر الدرس' }).selectOption('lesson-42');
  await dialog.getByRole('button', { name: 'ربط', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(detail.getByText('شرح المعادلات')).toBeVisible();
  expect(skillLinks).toEqual(['m1', 'sub1']);

  await detail.getByRole('button', { name: 'فصل الدرس شرح المعادلات عن المهارة' }).click();
  await expect(detail.getByText('لا توجد دروس مرتبطة بهذه المهارة.')).toBeVisible();
  await expect(detail.getByText('تم فصل الدرس عن المهارة دون حذف محتواه.')).toBeVisible();
  expect(skillLinks).toEqual(['m1']);
  expect(writes).toHaveLength(2);
});

test('admin creates and edits a subskill lesson with its canonical editor, anchored scope and retryable failure', async ({ page }) => {
  await page.route('**/api/v1/auth/me', (route) => json(route, { user: admin }));
  await page.route('**/api/v1/auth/csrf', (route) => json(route, { csrfToken: 'editor-csrf' }));
  await page.route('**/api/v1/taxonomy/admin/bootstrap', (route) => json(route, taxonomy));
  await page.route('**/api/v1/taxonomy/bootstrap?phase=full', (route) => json(route, taxonomy));
  await page.route('**/api/v1/questions?**', (route) => json(route, { items: [], page: 1, limit: 6, hasMore: false }));
  await page.route('**/api/v1/questions/coverage?**', (route) => json(route, { questionsTotal: 0, approved: 0, pendingReview: 0, unlinked: 0, mainSkillCoverage: 0, subSkillCoverage: 0, skills: [], skillPage: 1, skillLimit: 50, skillsHasMore: false }));

  let lessonExists = false;
  let lessonTitle = 'درس جديد للمعادلات';
  let revision = 1;
  let createAttempts = 0;
  let editWrites = 0;
  const summary = () => ({ id: 'new-lesson', pathId: 'p1', subjectId: 's1', title: lessonTitle,
    type: 'video', durationSeconds: 600, workflowStatus: 'draft', ownerType: 'platform',
    ownerUserId: '', ownerSchoolId: '', assignedTeacherId: '', isVisible: false, isLocked: false,
    revision, updatedAt: '2026-10-29T00:00:00Z' });
  const detail = () => ({ ...summary(), description: '', contentText: '', videoUrl: 'https://youtu.be/lesson',
    videoSource: 'youtube', meetingUrl: '', meetingAt: null, recordingUrl: '', joinInstructions: '', showRecording: false,
    createdBy: admin.id, approvedBy: '', approvedAt: null, reviewerNotes: '', revenueSharePercentage: null,
    skillIds: ['sub1'], assetIds: [], createdAt: '2026-10-29T00:00:00Z' });
  await page.route('**/api/v1/lessons?**', (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('subjectId')).toBe('s1');
    return json(route, { items: lessonExists ? [summary()] : [], page: 1, limit: 50, hasMore: false });
  });
  await page.route('**/api/v1/lessons', (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().headers()['x-csrf-token']).toBe('editor-csrf');
    const input = route.request().postDataJSON() as Record<string, unknown>;
    expect(input).toMatchObject({ pathId: 'p1', subjectId: 's1', skillIds: ['sub1'], title: lessonTitle, type: 'video' });
    createAttempts++;
    if (createAttempts === 1) return json(route, { message: 'تعذر الحفظ مؤقتًا' }, 409);
    lessonExists = true;
    return json(route, { lesson: detail() }, 201);
  });
  await page.route('**/api/v1/lessons/new-lesson', (route) => {
    if (route.request().method() === 'GET') return json(route, { lesson: detail() });
    expect(route.request().method()).toBe('PUT');
    expect(route.request().headers()['x-csrf-token']).toBe('editor-csrf');
    const input = route.request().postDataJSON() as Record<string, unknown>;
    expect(input).toMatchObject({ pathId: 'p1', subjectId: 's1', skillIds: ['sub1'], expectedRevision: revision, title: 'درس المعادلات المعدل' });
    editWrites++;
    lessonTitle = String(input.title);
    revision++;
    return json(route, { lesson: detail() });
  });

  await page.goto('/admin-dashboard?tab=skills');
  await page.getByRole('button', { name: 'فتح المهارة الرئيسة الجبر' }).click();
  await page.getByRole('button', { name: 'فتح المهارة الفرعية المعادلات' }).click();
  const detailRegion = page.getByRole('region', { name: 'تفاصيل مهارة المعادلات' });
  await detailRegion.getByRole('button', { name: 'إضافة درس جديد' }).click();
  const editor = page.getByRole('heading', { name: 'إضافة درس جديد' }).locator('xpath=ancestor::form');
  await expect(editor.getByRole('combobox', { name: 'المسار *' })).toHaveValue('p1');
  await expect(editor.getByRole('combobox', { name: 'المادة *' })).toHaveValue('s1');
  await expect(editor.getByRole('checkbox', { name: 'المعادلات' })).toBeChecked();
  await expect(editor.getByRole('checkbox', { name: 'المعادلات' })).toBeDisabled();
  await editor.getByRole('textbox', { name: 'عنوان الدرس *' }).fill(lessonTitle);
  await editor.getByRole('textbox', { name: 'رابط الفيديو' }).fill('https://youtu.be/lesson');
  await editor.getByRole('button', { name: 'حفظ كمسودة' }).click();
  await expect(editor.getByText('تعذر الحفظ مؤقتًا')).toBeVisible();
  await expect(editor.getByRole('textbox', { name: 'عنوان الدرس *' })).toHaveValue(lessonTitle);
  await editor.getByRole('button', { name: 'حفظ كمسودة' }).click();
  await expect(editor).toHaveCount(0);
  await expect(detailRegion.getByText(lessonTitle)).toBeVisible();
  await detailRegion.getByRole('button', { name: `تعديل الدرس ${lessonTitle}` }).click();
  const editEditor = page.getByRole('heading', { name: 'تعديل الدرس' }).locator('xpath=ancestor::form');
  await expect(editEditor.getByRole('checkbox', { name: 'المعادلات' })).toBeChecked();
  await editEditor.getByRole('textbox', { name: 'عنوان الدرس *' }).fill('درس المعادلات المعدل');
  await editEditor.getByRole('button', { name: 'حفظ الدرس' }).click();
  await expect(editEditor).toHaveCount(0);
  await expect(detailRegion.getByText('درس المعادلات المعدل')).toBeVisible();
  expect(createAttempts).toBe(2);
  expect(editWrites).toBe(1);
});
