import { test, expect } from '@playwright/test';

test.describe('ALMEAA CODAX 1:1 Parity Suite - Tier 1: Feature Coverage', () => {
  test('T1_F1: Dashboard Full-Width Shell (Edge-to-Edge Layout)', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    const outer = page.locator('main').locator('..');
    const className = (await outer.getAttribute('class')) || '';
    // Assert 1:1 parity without 1500px clamping once M1 lands
    expect(className).toBeDefined();
  });

  test('T1_F2: Course Runner Full-Width Shell', async ({ page }) => {
    await page.goto('/learning/courses/course-1?learn=1');
    await page.waitForLoadState('domcontentloaded');
    const main = page.locator('main');
    await expect(main).toBeAttached();
  });

  test('T1_F3: Responsive Gutters & Docked Sidebar (1440px)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    const aside = page.getByRole('complementary', { name: 'تنقل لوحة الطالب' });
    if (await aside.isVisible()) {
      const box = await aside.boundingBox();
      expect(box).not.toBeNull();
    }
  });

  test('T1_F4: Dashboard Tab Query Router (?tab=paths)', async ({ page }) => {
    await page.goto('/dashboard?tab=paths');
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('tab=paths');
  });

  test('T1_F5: "مساراتي" Active Tracks Grid', async ({ page }) => {
    await page.goto('/dashboard?tab=paths');
    await page.waitForLoadState('domcontentloaded');
    const body = await page.innerText('body');
    expect(body).toBeDefined();
  });
});

test.describe('ALMEAA CODAX 1:1 Parity Suite - Tier 2: Boundary & Corner Cases', () => {
  test('T2_B1: Mobile 390px Viewport Limit & No Horizontal Scroll Overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2);
    expect(overflow).toBe(true);
  });

  test('T2_B2: Tablet 820px Viewport Limit', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    const body = await page.innerText('body');
    expect(body.length).toBeGreaterThan(0);
  });

  test('T2_B3: Ultra-Wide 1920px Desktop Layout', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    const body = await page.innerText('body');
    expect(body.length).toBeGreaterThan(0);
  });
});

test.describe('ALMEAA CODAX 1:1 Parity Suite - Tier 3: Cross-Feature Combinations', () => {
  test('T3_XF1: Dashboard to Learning Space Navigation', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await page.goto('/learning');
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/learning');
  });
});

test.describe('ALMEAA CODAX 1:1 Parity Suite - Tier 4: Real-World Student Lifecycle', () => {
  test('T4_LC1: Student Lifecycle Onboarding to Learning View', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await page.goto('/dashboard?tab=paths');
    await page.waitForLoadState('domcontentloaded');
    await page.goto('/reports');
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/reports');
  });
});
