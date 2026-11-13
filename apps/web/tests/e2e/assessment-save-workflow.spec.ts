import { expect, test } from '@playwright/test';

test('يحفظ المسؤول مرة واحدة ويستعيد التقدم عند تعثر الاعتماد أو النشر', async ({ page }) => {
  test.setTimeout(300_000);
  let current: Record<string, any> | undefined;
  let creates = 0, updates = 0, publications = 0;
  const transitions: string[] = [];
  const reply = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/v1/assessments**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/v1/assessments' && request.method() === 'POST') {
      creates++;
      const input = request.postDataJSON();
      current = { id: 'new-id', code: input.code, title: input.version.title, pathId: input.version.pathId, subjectId: input.version.subjectId, kind: input.version.kind, ownerType: 'platform', ownerUserId: '', ownerSchoolId: '', assignedTeacherId: '', reviewerNotes: '', workflowStatus: 'draft', revision: 1, currentVersion: 1, isPublished: false, isVisible: input.isVisible, version: input.version, sections: input.sections, questions: input.questions };
      return route.fulfill(reply({ assessment: current }, 201));
    }
    if (path === '/api/v1/assessments/new-id' && request.method() === 'GET') return route.fulfill(reply({ assessment: current }));
    if (path === '/api/v1/assessments/new-id' && request.method() === 'PATCH') { updates++; return route.fulfill(reply({ assessment: current })); }
    if (path.endsWith('/workflow')) {
      const input = request.postDataJSON();
      expect(input.expectedRevision).toBe(current!.revision);
      transitions.push(input.status);
      current = { ...current, workflowStatus: input.status, revision: current!.revision + 1 };
      if (input.status === 'pending_review') return route.abort('failed'); // response lost after commit
      return route.fulfill(reply({ assessment: current }));
    }
    if (path.endsWith('/publication')) {
      publications++;
      expect(request.postDataJSON().expectedRevision).toBe(current!.revision);
      if (publications === 1) return route.fulfill(reply({ message: 'تعذر النشر' }, 409));
      current = { ...current, isPublished: true, revision: current!.revision + 1 };
      return route.fulfill(reply({ assessment: current }));
    }
    return route.fulfill(reply({ message: 'unexpected request' }, 500));
  });
  await page.goto('/tests/e2e/fixtures/assessment-save-workflow.html', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.getByPlaceholder('مثال: EXAM-TAH-PHYS-01 أو MOCK-QUD-01').fill('TEST-001');
  await page.getByPlaceholder('مثال: الاختبار المحاكي الشامل للقدرات العامة — النموذج التجريبي 1').fill('اختبار تجريبي');
  await page.getByRole('navigation', { name: 'أقسام منشئ الاختبارات' }).getByRole('button', { name: 'الإعدادات', exact: true }).click();
  await page.getByRole('button', { name: 'حفظ ونشر الاختبار الآن' }).click();
  await expect(page.getByText(/حُفظ الاختبار، لكن لم تكتمل العملية/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'تعديل الاختبار' })).toBeVisible();
  await page.getByRole('button', { name: 'حفظ ونشر الاختبار الآن' }).click();
  await expect(page.getByText('تم التسليم للقائمة')).toBeVisible();
  expect({ creates, updates, publications, transitions }).toEqual({ creates: 1, updates: 0, publications: 2, transitions: ['pending_review', 'approved'] });
});

test('حفظ المعلم يرسل للمراجعة دون اعتماد أو نشر', async ({ page }) => {
  test.setTimeout(300_000);
  const calls: string[] = [];
  let current: Record<string, any>;
  await page.route('**/api/v1/assessments**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/v1/assessments') {
      calls.push('create');
      const input = request.postDataJSON();
      current = { id: 'teacher-id', code: input.code, title: input.version.title, pathId: input.version.pathId, subjectId: input.version.subjectId, kind: 'normal', ownerType: 'teacher', ownerUserId: 'teacher', ownerSchoolId: '', assignedTeacherId: 'teacher', workflowStatus: 'draft', revision: 1, currentVersion: 1, isPublished: false, isVisible: true, version: input.version, sections: input.sections, questions: input.questions };
    } else if (path.endsWith('/workflow')) {
      calls.push(request.postDataJSON().status);
      current = { ...current!, workflowStatus: 'pending_review', revision: 2 };
    } else { calls.push('unexpected'); }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assessment: current! }) });
  });
  await page.goto('/tests/e2e/fixtures/assessment-save-workflow.html?role=teacher', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.getByPlaceholder('مثال: EXAM-TAH-PHYS-01 أو MOCK-QUD-01').fill('TEST-TEACHER');
  await page.getByPlaceholder('مثال: الاختبار المحاكي الشامل للقدرات العامة — النموذج التجريبي 1').fill('اختبار معلم');
  await page.getByRole('navigation', { name: 'أقسام منشئ الاختبارات' }).getByRole('button', { name: 'الإعدادات', exact: true }).click();
  await page.getByRole('button', { name: 'حفظ وإرسال للمراجعة' }).click();
  await expect(page.getByText('تم التسليم للقائمة')).toBeVisible();
  expect(calls).toEqual(['create', 'pending_review']);
});

test('يمنع تكرار الإنشاء عند تعذر تأكيد نتيجة الحفظ', async ({ page }) => {
  test.setTimeout(300_000);
  let creates = 0;
  await page.route('**/api/v1/assessments', route => { creates++; return route.abort('failed'); });
  await page.goto('/tests/e2e/fixtures/assessment-save-workflow.html', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.getByPlaceholder('مثال: EXAM-TAH-PHYS-01 أو MOCK-QUD-01').fill('UNCERTAIN-001');
  await page.getByPlaceholder('مثال: الاختبار المحاكي الشامل للقدرات العامة — النموذج التجريبي 1').fill('اختبار');
  await page.getByRole('navigation', { name: 'أقسام منشئ الاختبارات' }).getByRole('button', { name: 'الإعدادات', exact: true }).click();
  await page.getByRole('button', { name: 'حفظ ونشر الاختبار الآن' }).click();
  await expect(page.getByText(/تعذر تأكيد نتيجة الحفظ/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'حفظ ونشر الاختبار الآن' })).toBeDisabled();
  expect(creates).toBe(1);
});
