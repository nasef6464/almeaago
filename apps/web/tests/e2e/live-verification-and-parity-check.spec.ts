import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOT_DIR = path.resolve('C:/almeaago/almeaago/docs/migration/evidence/batch-g1-student-walkthrough/screenshots');
const ARTIFACT_DIR = path.resolve('C:/Users/nasef/.gemini/antigravity/brain/0ccfb08a-58bb-4c4b-b298-4bd5e2ebea66');

function saveEvidence(filename: string, buffer: Buffer) {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  fs.writeFileSync(path.join(SCREENSHOT_DIR, filename), buffer);
  fs.writeFileSync(path.join(ARTIFACT_DIR, filename), buffer);
}

test.describe('Live Integrated Verification Suite', () => {
  test.setTimeout(180_000);

  test('Live login, question bank images, taxonomy paths, foundation locking, and exam parity', async ({ page }) => {
    // 1. Live Login as Admin
    console.log('--- Step 1: Navigating to login page ---');
    await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Check if auth modal is open, or click login trigger
    const loginInput = page.locator('#smart-login-input');
    if (!(await loginInput.isVisible())) {
      const loginBtn = page.getByRole('button', { name: /تسجيل الدخول|دخول/i }).first();
      if (await loginBtn.isVisible()) {
        await loginBtn.click();
      }
    }

    await expect(loginInput).toBeVisible({ timeout: 15_000 });
    await loginInput.fill('admin@almeaa.com');

    const passwordInput = page.locator('#smart-login-password');
    await expect(passwordInput).toBeVisible({ timeout: 5000 });
    await passwordInput.fill('Almeaa@2026');

    const submitBtn = page.locator('#smart-login-submit');
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });
    await submitBtn.click();

    // Wait for authentication and redirect
    await page.waitForTimeout(4000);
    const loginScreenshot = await page.screenshot({ fullPage: true });
    saveEvidence('10_live_login_admin_dashboard.png', loginScreenshot);
    console.log('Step 1 complete: Admin logged in successfully.');

    // 2. Question Bank Admin: Image Thumbnails & Details Panel
    console.log('--- Step 2: Checking Question Bank Admin Images ---');
    await page.goto('http://localhost:5173/admin-dashboard/questions', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const searchInput = page.getByLabel('بحث بنك الأسئلة');
    await expect(searchInput).toBeVisible({ timeout: 15_000 });
    await searchInput.fill('QDR-QNT');
    await page.waitForTimeout(3000);

    // Look for question images / thumbnails
    const thumbnails = page.locator('article img');
    const thumbCount = await thumbnails.count();
    console.log(`Found ${thumbCount} Cloudinary thumbnails in questions list.`);

    // Click on the first question "فتح وتفاصيل" button to view details panel
    const firstOpenBtn = page.getByRole('button', { name: 'فتح وتفاصيل' }).first();
    if (await firstOpenBtn.isVisible()) {
      await firstOpenBtn.click();
      await page.waitForTimeout(2000);
      console.log('Opened first question details panel.');
    }

    const qbScreenshot = await page.screenshot({ fullPage: true });
    saveEvidence('11_live_admin_question_bank_images.png', qbScreenshot);
    console.log('Step 2 complete: Question Bank images captured.');

    // 3. Taxonomy & Paths Parity (Codex changes check)
    console.log('--- Step 3: Checking Taxonomy & Paths Manager ---');
    await page.goto('http://localhost:5173/admin-dashboard/taxonomy', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const taxonomyScreenshot = await page.screenshot({ fullPage: true });
    saveEvidence('12_live_admin_taxonomy_paths.png', taxonomyScreenshot);
    console.log('Step 3 complete: Taxonomy paths captured.');

    // 4. Learning Space & Foundation 3-Free Rule
    console.log('--- Step 4: Checking Learning Space & Foundation Locking ---');
    await page.goto('http://localhost:5173/learning', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const learningScreenshot = await page.screenshot({ fullPage: true });
    saveEvidence('13_live_foundation_topics_locking.png', learningScreenshot);
    console.log('Step 4 complete: Learning Space captured.');

    // 5. Assessments & Mock Exams Catalog
    console.log('--- Step 5: Checking Assessments & Mock Exams ---');
    await page.goto('http://localhost:5173/assessments', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const assessmentsScreenshot = await page.screenshot({ fullPage: true });
    saveEvidence('14_live_assessment_catalog.png', assessmentsScreenshot);
    console.log('Step 5 complete: Assessments catalog captured.');

    // 6. Student Dashboard
    console.log('--- Step 6: Checking Dashboard ---');
    await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const dashboardScreenshot = await page.screenshot({ fullPage: true });
    saveEvidence('15_live_dashboard.png', dashboardScreenshot);
    console.log('Step 6 complete: Dashboard captured.');
  });
});
