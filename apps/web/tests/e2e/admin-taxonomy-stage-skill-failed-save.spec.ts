import { expect, test, type Page, type Route } from '@playwright/test';

// Independent acceptance tests for the two original admin create flows omitted by #199.
// Production UI remains owned by #160; this test does not modify that branch.
const admin = {
  id: 'admin-draft-stage-skill', email: 'admin@example.test', name: 'مدير المنصة',
  status: 'active', avatarUrl: '', emailVerified: true,
  role: 'admin', roles: ['admin'],
};

type Stage = { id: string; pathId: string; code: string; name: string; sortOrder: number; status: string };
type Skill = { id: string; subjectId: string; parentSkillId: string; code: string; name: string; description: string; kind: string; sortOrder: number; status: string };

function respond(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

function fixture() {
  return {
    paths: [{ id: 'path-1', code: 'QDR', name: 'القدرات', parentPathId: '', description: '', sortOrder: 1, status: 'active' }],
    levels: [{ id: 'level-1', pathId: 'path-1', code: 'L1', name: 'الأول', sortOrder: 1, status: 'active' }] as Stage[],
    subjects: [{ id: 'subject-1', pathId: 'path-1', levelId: 'level-1', code: 'QNT', name: 'الكمي', sortOrder: 1, status: 'active' }],
    skills: [{ id: 'main-1', subjectId: 'subject-1', parentSkillId: '', code: 'NUM', name: 'الأعداد', description: '', kind: 'main', sortOrder: 1, status: 'active' }] as Skill[],
  };
}

async function setup(page: Page, data: ReturnType<typeof fixture>) {
  await page.route('**/api/v1/auth/me', route => respond(route, { user: admin }));
  await page.route('**/api/v1/auth/csrf', route => respond(route, { csrfToken: 'csrf-admin-draft' }));
  await page.route('**/api/v1/taxonomy/admin/bootstrap', route => respond(route, data));
  await page.goto('/admin-dashboard/taxonomy');
  await expect(page.getByLabel('كود المرحلة الجديدة')).toBeVisible();
  await expect(page.getByLabel('كود المهارة الجديدة')).toBeVisible();
}

for (const width of [390, 820, 1440]) {
  for (const failure of [503, 409]) {
    test(`stage creation retains draft after HTTP ${failure}, retries and survives reload — RTL ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const data = fixture();
      await setup(page, data);
      let writes = 0;
      let lastBody: { pathId: string; code: string; name: string; sortOrder: number } | undefined;
      await page.route('**/api/v1/taxonomy/admin/levels', route => {
        writes++;
        lastBody = route.request().postDataJSON() as typeof lastBody;
        if (writes === 1) return respond(route, { message: 'تعذر حفظ المرحلة' }, failure);
        data.levels.push({ id: 'level-new', ...lastBody!, status: 'active' });
        return respond(route, { level: { id: 'level-new' } }, 201);
      });
      await page.getByLabel('كود المرحلة الجديدة').fill('L2');
      await page.getByLabel('اسم المرحلة الجديدة').fill('الثاني');
      await page.getByRole('button', { name: 'إنشاء المرحلة' }).click();
      await expect(page.getByText('تعذر حفظ المرحلة')).toBeVisible();
      await expect(page.getByLabel('كود المرحلة الجديدة')).toHaveValue('L2');
      await expect(page.getByLabel('اسم المرحلة الجديدة')).toHaveValue('الثاني');
      expect(writes).toBe(1);
      expect(data.levels).toHaveLength(1);
      await page.getByRole('button', { name: 'إنشاء المرحلة' }).click();
      await expect(page.getByText('تم إنشاء المرحلة.')).toBeVisible();
      expect(writes).toBe(2);
      expect(lastBody).toMatchObject({ pathId: 'path-1', code: 'L2', name: 'الثاني' });
      await expect(page.getByLabel('كود المرحلة الجديدة')).toHaveValue('');
      await page.reload();
      await expect(page.getByText('الثاني', { exact: true })).toBeVisible();
    });

    test(`sub-skill creation retains parent, description and kind after HTTP ${failure} — RTL ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const data = fixture();
      await setup(page, data);
      let writes = 0;
      let lastBody: { subjectId: string; parentSkillId: string; code: string; name: string; description: string; kind: string; sortOrder: number } | undefined;
      await page.route('**/api/v1/taxonomy/admin/skills', route => {
        writes++;
        lastBody = route.request().postDataJSON() as typeof lastBody;
        if (writes === 1) return respond(route, { message: 'تعذر حفظ المهارة' }, failure);
        data.skills.push({ id: 'skill-new', ...lastBody!, status: 'active' });
        return respond(route, { skill: { id: 'skill-new' } }, 201);
      });
      await page.getByLabel('نوع المهارة الجديدة').selectOption('sub');
      await page.getByLabel('المهارة الرئيسية الأب').selectOption('main-1');
      await page.getByLabel('كود المهارة الجديدة').fill('NUM-2');
      await page.getByLabel('اسم المهارة الجديدة').fill('العمليات');
      await page.getByLabel('وصف المهارة الجديدة').fill('مسودة وصف لا تُفقد');
      await page.getByRole('button', { name: 'إضافة المهارة' }).click();
      await expect(page.getByText('تعذر حفظ المهارة')).toBeVisible();
      await expect(page.getByLabel('كود المهارة الجديدة')).toHaveValue('NUM-2');
      await expect(page.getByLabel('اسم المهارة الجديدة')).toHaveValue('العمليات');
      await expect(page.getByLabel('وصف المهارة الجديدة')).toHaveValue('مسودة وصف لا تُفقد');
      await expect(page.getByLabel('نوع المهارة الجديدة')).toHaveValue('sub');
      await expect(page.getByLabel('المهارة الرئيسية الأب')).toHaveValue('main-1');
      expect(writes).toBe(1);
      expect(data.skills).toHaveLength(1);
      await page.getByRole('button', { name: 'إضافة المهارة' }).click();
      await expect(page.getByText('تم إنشاء المهارة.')).toBeVisible();
      expect(writes).toBe(2);
      expect(lastBody).toMatchObject({ subjectId: 'subject-1', parentSkillId: 'main-1', kind: 'sub', code: 'NUM-2', name: 'العمليات', description: 'مسودة وصف لا تُفقد' });
      await expect(page.getByLabel('كود المهارة الجديدة')).toHaveValue('');
      await page.reload();
      await expect(page.getByText('العمليات', { exact: true })).toBeVisible();
    });
  }
}
