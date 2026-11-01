import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { mockHeaderNavigation } from './fixtures/header-navigation';

const student = { id: 'enrollment-visual', name: 'طالب مرجعي', email: 'visual@example.invalid', role: 'student', roles: ['student'], status: 'active', avatarUrl: '', emailVerified: true };
const catalog = { paths: [{ id: 'target-path', name: 'المسار التعليمي المرجعي', isActive: true, showInHome: true, settings: { stageSelection: 'required', stageLabel: 'اختر مرحلتك' } }], levels: [{ id: 'target-level', pathId: 'target-path', name: 'المرحلة المرجعية' }], subjects: [] };

test.use({ launchOptions: { args: ['--disable-gpu'] } });
test.beforeAll(() => {
  execFileSync(process.execPath, [fileURLToPath(new URL('../../../../scripts/parity/enrollment-reference.mjs', import.meta.url))]);
});

async function variant(page: Page, value: 'source' | 'go') {
  await page.evaluate(next => window.__setEnrollmentVariant?.(next), value);
  await expect(page.getByTestId('enrollment-reference')).toHaveAttribute('data-variant', value);
  await page.getByRole('button', { name: 'افتح اختيار المسار', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'اختر مسارك التعليمي', exact: true })).toHaveCount(1);
}

function changedPixels(source: Buffer, target: Buffer) {
  const left = PNG.sync.read(source), right = PNG.sync.read(target);
  expect({ width: right.width, height: right.height }).toEqual({ width: left.width, height: left.height });
  let changed = 0;
  for (let i = 0; i < left.data.length; i += 4) {
    if (left.data[i] !== right.data[i] || left.data[i + 1] !== right.data[i + 1] || left.data[i + 2] !== right.data[i + 2] || left.data[i + 3] !== right.data[i + 3]) changed++;
  }
  return changed;
}

for (const width of [390, 820, 1440]) {
  test(`original and Go enrollment component exact paired pixels at ${width}px`, async ({ page }, info) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 1000 });
    await page.route(url => url.pathname.startsWith('/api/'), route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/v1/auth/me') return route.fulfill({ json: { user: student } });
      if (path === '/api/v1/auth/csrf') return route.fulfill({ json: { csrfToken: 'visual-csrf' } });
      if (path === '/api/v1/content/homepage-settings') return route.fulfill({ json: {} });
      return route.fulfill({ status: 403, json: { message: 'Unexpected synthetic request' } });
    });
    const fixture = await mockHeaderNavigation(page, { actor: () => student, catalog });
    await page.goto('/tests/reference/enrollment.html');
    await expect(page.getByTestId('enrollment-reference')).toHaveAttribute('data-ready', 'true');
    await page.evaluate(() => document.fonts.ready);

    for (const state of ['choose-stage', 'stage-selected', 'save-error'] as const) {
      const shots: Buffer[] = [];
      for (const value of ['source', 'go'] as const) {
        await variant(page, value);
        const dialog = page.getByRole('dialog', { name: 'اختر مسارك التعليمي', exact: true });
        await expect(dialog.getByLabel('المسار التعليمي', { exact: true })).toHaveValue('target-path');
        if (state !== 'choose-stage') await dialog.getByLabel('اختر مرحلتك', { exact: true }).selectOption('target-level');
        if (state === 'save-error') {
          fixture.failNextSave('تعذر حفظ التسجيل؛ حاول مرة أخرى.');
          await dialog.getByRole('button', { name: 'تأكيد التسجيل', exact: true }).click();
          await expect(dialog.getByRole('alert')).toHaveText('تعذر حفظ التسجيل؛ حاول مرة أخرى.');
          await expect(dialog.getByLabel('اختر مرحلتك', { exact: true })).toHaveValue('target-level');
        }
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        await page.mouse.move(0, 999);
        const shot = await page.screenshot({ path: info.outputPath(`${value}-${state}-${width}.png`), animations: 'disabled' });
        await info.attach(`${value}-${state}-${width}`, { body: shot, contentType: 'image/png' });
        shots.push(shot);
        await dialog.getByRole('button', { name: 'إغلاق اختيار المسار', exact: true }).click();
        await expect(dialog).toHaveCount(0);
      }
      expect(changedPixels(shots[0], shots[1]), `${state}: original dialog versus Go under identical providers, synthetic data and shared Go stylesheet`).toBe(0);
    }
    expect(fixture.records.get(student.id)).toBeUndefined();
  });
}
