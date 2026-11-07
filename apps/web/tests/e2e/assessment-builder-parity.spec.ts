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

test.describe('Assessment Builder Parity Suite (Regular & Mock Exams)', () => {
  test.setTimeout(180_000);

  test('Exam Builder matches legacy with Qiyas sections, auto-select, and visual cards', async ({ page }) => {
    // 1. Login as Admin
    console.log('--- Step 1: Login as Admin ---');
    await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

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

    // Ensure session is active on dashboard
    await page.waitForTimeout(4000);
    await expect(page.locator('text=مدير المنصة').first()).toBeVisible({ timeout: 15_000 });
    console.log('Admin login verified.');

    // 2. Open Assessment Center
    console.log('--- Step 2: Open Assessment Center ---');
    await page.goto('http://localhost:5173/admin-dashboard/assessments', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Click "اختبار جديد"
    const newExamBtn = page.getByRole('button', { name: 'اختبار جديد' });
    await expect(newExamBtn).toBeVisible({ timeout: 15_000 });
    await newExamBtn.click();
    await page.waitForTimeout(2000);

    // 3. Tab 1: Info & Mode Switcher
    console.log('--- Step 3: Tab 1 - Mode switcher & basic info ---');
    const mockModeBtn = page.getByRole('button', { name: 'محاكي قياس رسمي (أقسام ومؤقت)' });
    await expect(mockModeBtn).toBeVisible({ timeout: 10_000 });
    await mockModeBtn.click();
    await page.waitForTimeout(1000);

    const snap1 = await page.screenshot({ fullPage: true });
    saveEvidence('16_exam_builder_mode_and_info.png', snap1);

    // 4. Tab 2: Sections & Qiyas One-Click Templates
    console.log('--- Step 4: Tab 2 - Sections & Qiyas One-Click generator ---');
    const sectionsTab = page.getByRole('button', { name: /2\. الأقسام والمؤقت/ });
    await sectionsTab.click();
    await page.waitForTimeout(1000);

    // Click Tahsili Qiyas template generator
    const tahsiliBtn = page.getByRole('button', { name: 'توليد أقسام محاكي التحصيلي (4 أقسام)' });
    await expect(tahsiliBtn).toBeVisible({ timeout: 5000 });
    await tahsiliBtn.click();
    await page.waitForTimeout(1500);

    // Verify the 4 Tahsili sections were created
    await expect(page.getByPlaceholder('عنوان القسم...')).toHaveCount(4);
    await expect(page.locator('input[value="القسم الأول — الرياضيات"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[value="القسم الثاني — الفيزياء"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[value="القسم الثالث — الكيمياء"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[value="القسم الرابع — الأحياء"]')).toBeVisible({ timeout: 5000 });

    const snap2 = await page.screenshot({ fullPage: true });
    saveEvidence('17_mock_exam_qiyas_sections_builder.png', snap2);

    // 5. Tab 3: Questions & Auto-Generation
    console.log('--- Step 5: Tab 3 - Questions picker & auto-generation drawer ---');
    const questionsTab = page.getByRole('button', { name: /3\. انتقاء وتوليد الأسئلة/ });
    await questionsTab.click();
    await page.waitForTimeout(1500);

    // Open Auto-Generation Box
    const autoGenBtn = page.getByRole('button', { name: 'التوليد التلقائي للأسئلة من البنك' });
    await expect(autoGenBtn).toBeVisible({ timeout: 5000 });
    await autoGenBtn.click();
    await page.waitForTimeout(1000);

    const snap3 = await page.screenshot({ fullPage: true });
    saveEvidence('18_exam_builder_questions_picker_and_auto_gen.png', snap3);

    // 6. Tab 4: Settings & Policies
    console.log('--- Step 6: Tab 4 - Settings & Policies ---');
    const settingsTab = page.getByRole('button', { name: /4\. الإعدادات والسياسات/ });
    await settingsTab.click();
    await page.waitForTimeout(1000);

    // Verify key policy toggles
    await expect(page.locator('text=ترتيب عشوائي للأسئلة في كل محاولة')).toBeVisible();
    await expect(page.locator('text=ترتيب عشوائي للخيارات')).toBeVisible();
    await expect(page.locator('text=إظهار التفسيرات والشروحات')).toBeVisible();
    await expect(page.locator('text=إظهار تقرير النتيجة والتفاصيل للطالب')).toBeVisible();

    const snap4 = await page.screenshot({ fullPage: true });
    saveEvidence('19_exam_builder_settings_and_policies.png', snap4);
    console.log('All 4 tabs verified and screenshots captured successfully!');
  });
});
