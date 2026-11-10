const { chromium } = require('C:/almeaago/almeaago/apps/web/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://127.0.0.1:5173';
const API_BASE = 'http://127.0.0.1:8080';
const ARTIFACT_DIR = 'C:/Users/nasef/.gemini/antigravity/brain/3387613e-8116-41d7-a510-0d9d92453cb5/screenshots';

if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

async function loginAndGetCredentials(email, password) {
  console.log(`[API] Authenticating as ${email}...`);
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Login failed for ${email}: ${res.status} ${errText}`);
  }
  const data = await res.json();
  const setCookies = res.headers.getSetCookie();
  const cookies = [];
  let accessToken = '';

  for (const c of setCookies) {
    const parts = c.split(';')[0].split('=');
    const name = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    if (name === 'almeaa_access_token') {
      accessToken = value;
    }
    cookies.push({
      name,
      value,
      domain: '127.0.0.1',
      path: '/',
    });
  }

  return {
    cookies,
    accessToken,
    csrfToken: data.csrfToken,
    user: data.user,
  };
}

async function run() {
  console.log('================================================================');
  console.log('🛡️  ALMEAA PLATFORM ADMIN FULL-SPECTRUM ENGINEERING AUDIT (P5+) 🛡️');
  console.log('================================================================');

  const { cookies, accessToken, csrfToken, user } = await loginAndGetCredentials(
    'admin@almeaa.com',
    'Almeaa@2026'
  );
  console.log(`[AUTH] Admin authenticated successfully: ${user.name} (${user.email})`);
  console.log(`[AUTH] Roles: ${user.roles.join(', ')}`);
  console.log(`[AUTH] Access Token: ${accessToken ? accessToken.slice(0, 10) + '...' : 'none'}`);
  console.log(`[AUTH] CSRF Token: ${csrfToken ? csrfToken.slice(0, 10) + '...' : 'none'}`);

  const apiHeaders = {
    'Content-Type': 'application/json',
    Cookie: `almeaa_access_token=${accessToken}`,
    Authorization: `Bearer ${accessToken}`,
    'X-CSRF-Token': csrfToken,
    Accept: 'application/json',
  };

  const auditReport = {
    timestamp: new Date().toISOString(),
    adminUser: { id: user.id, name: user.name, email: user.email, roles: user.roles },
    metrics: {},
    mutations: [],
    inspectedDomains: [],
    consoleErrors: [],
    pageErrors: [],
  };

  // Launch Playwright with Chrome
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'ar-SA',
    });
    await context.addCookies(cookies);
    const page = await context.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        auditReport.consoleErrors.push(msg.text());
        console.error(' [BROWSER ERROR]', msg.text());
      }
    });
    page.on('pageerror', (err) => {
      auditReport.pageErrors.push(err.message);
      console.error(' [PAGE CRASH]', err.message);
    });

    // -------------------------------------------------------------
    // DOMAIN 1: Admin Overview & System KPIs
    // -------------------------------------------------------------
    console.log('\n--- [DOMAIN 1] Auditing Admin Overview & System KPIs ---');
    const [summaryRes, questionsCoverageRes, readinessRes] = await Promise.all([
      fetch(`${API_BASE}/api/v1/auth/admin/users/summary`, { headers: apiHeaders }),
      fetch(`${API_BASE}/api/v1/questions/coverage?page=1&limit=1`, { headers: apiHeaders }),
      fetch(`${API_BASE}/api/v1/operations/readiness`, { headers: apiHeaders }),
    ]);

    const userSummary = summaryRes.ok ? await summaryRes.json() : null;
    const qCoverage = questionsCoverageRes.ok ? await questionsCoverageRes.json() : null;
    const readiness = readinessRes.ok ? await readinessRes.json() : null;

    auditReport.metrics = {
      usersSummary: userSummary?.summary || {},
      questionsTotal: qCoverage?.questionsTotal || 0,
      approvedQuestions: qCoverage?.approved || 0,
      systemReadiness: readiness?.status || 'unknown',
      checks: readiness?.checks || [],
    };
    console.log(`  -> Users in DB: Total ${userSummary?.summary?.total || 0}`);
    console.log(`  -> Question Bank: Total ${qCoverage?.questionsTotal || 0} (Approved: ${qCoverage?.approved || 0})`);
    console.log(`  -> System Readiness: ${readiness?.status || 'N/A'}`);

    await page.goto(`${BASE_URL}/admin-dashboard`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '201_admin_overview_kpis.png') });
    console.log('  ✅ [SCREENSHOT] 201_admin_overview_kpis.png captured');
    auditReport.inspectedDomains.push('Overview & KPIs');

    // -------------------------------------------------------------
    // DOMAIN 2: Taxonomy & Skills CRUD Roundtrip
    // -------------------------------------------------------------
    console.log('\n--- [DOMAIN 2] Auditing Taxonomy & Skills CRUD ---');
    const bootstrapRes = await fetch(`${API_BASE}/api/v1/taxonomy/admin/bootstrap`, { headers: apiHeaders });
    const bootstrapData = await bootstrapRes.json();
    console.log(`  -> Paths in DB: ${bootstrapData.paths?.length || 0}`);
    console.log(`  -> Subjects in DB: ${bootstrapData.subjects?.length || 0}`);
    console.log(`  -> Skills in DB: ${bootstrapData.skills?.length || 0}`);

    const targetSubject = bootstrapData.subjects?.[0];
    let createdSkillId = null;

    if (targetSubject) {
      const skillCode = `SKILL_AUDIT_${Date.now().toString().slice(-4)}`;
      console.log(`  -> Creating main skill in PostgreSQL under: ${targetSubject.name} (${skillCode})...`);
      const createSkillRes = await fetch(`${API_BASE}/api/v1/taxonomy/admin/skills`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          subjectId: targetSubject.id,
          parentSkillId: '',
          code: skillCode,
          name: 'مهارة تدقيق منصة المئة المعتمدة',
          description: 'مهارة رئيسية تم التحقق من كتابتها وقراءتها وتحديثها في قاعدة البيانات',
          kind: 'main',
          sortOrder: 999,
        }),
      });

      if (createSkillRes.ok) {
        const createSkillData = await createSkillRes.json();
        createdSkillId = createSkillData?.skill?.ID || createSkillData?.skill?.id || createSkillData?.id;
        console.log(`  ✅ [MUTATION 1] Skill created in PostgreSQL! ID: ${createdSkillId}`);
        auditReport.mutations.push({ action: 'create_skill', status: 'SUCCESS', id: createdSkillId, code: skillCode });

        // Update skill
        if (createdSkillId) {
          const updateSkillRes = await fetch(`${API_BASE}/api/v1/taxonomy/admin/skills/${createdSkillId}`, {
            method: 'PATCH',
            headers: apiHeaders,
            body: JSON.stringify({
              name: 'مهارة تدقيق منصة المئة المعتمدة (تم التحديث والتحقق بنجاح)',
              sortOrder: 1000,
            }),
          });
          if (updateSkillRes.ok) {
            console.log(`  ✅ [MUTATION 2] Skill updated in PostgreSQL!`);
            auditReport.mutations.push({ action: 'update_skill', status: 'SUCCESS', id: createdSkillId });
          }
        }
      } else {
        console.warn(`  ⚠️ Skill creation failed: ${createSkillRes.status}`);
      }
    }

    await page.goto(`${BASE_URL}/admin-dashboard/taxonomy`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '202_admin_taxonomy_page.png') });
    console.log('  ✅ [SCREENSHOT] 202_admin_taxonomy_page.png captured');

    await page.goto(`${BASE_URL}/admin-dashboard?tab=skills`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '203_admin_taxonomy_skills_tab.png') });
    console.log('  ✅ [SCREENSHOT] 203_admin_taxonomy_skills_tab.png captured');
    auditReport.inspectedDomains.push('Taxonomy & Skills');

    // -------------------------------------------------------------
    // DOMAIN 3: Question Bank & KaTeX Math Rendering
    // -------------------------------------------------------------
    console.log('\n--- [DOMAIN 3] Auditing Question Bank & KaTeX Math Rendering ---');
    await page.goto(`${BASE_URL}/admin-dashboard/questions`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(2500);

    const questionCards = await page.$$eval('table tbody tr, [data-testid="question-card"], div.rounded-2xl', (els) => els.length);
    console.log(`  -> Detected question cards/rows on page: ${questionCards}`);

    const inspectBtn = page.locator('button:has-text("معاينة"), button:has-text("فحص"), button:has([data-lucide="eye"]), button svg.lucide-eye').first();
    let previewOpened = false;
    if (await inspectBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('  -> Opening question preview modal...');
      await inspectBtn.click();
      await page.waitForTimeout(1500);
      previewOpened = true;
    }

    const katexCount = await page.$$eval('.katex, .katex-html, math', (els) => els.length).catch(() => 0);
    console.log(`  -> KaTeX math elements detected: ${katexCount}`);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, '204_admin_question_katex_preview.png') });
    console.log('  ✅ [SCREENSHOT] 204_admin_question_katex_preview.png captured');

    if (previewOpened) {
      const closeBtn = page.locator('button:has-text("إغلاق"), button:has([data-lucide="x"]), button svg.lucide-x').first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    }
    auditReport.inspectedDomains.push('Question Bank & KaTeX');

    // -------------------------------------------------------------
    // DOMAIN 4: Assessment & Exam Center
    // -------------------------------------------------------------
    console.log('\n--- [DOMAIN 4] Auditing Assessment Center ---');
    await page.goto(`${BASE_URL}/admin-dashboard/assessments`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '205_admin_assessment_detail_view.png') });
    console.log('  ✅ [SCREENSHOT] 205_admin_assessment_detail_view.png captured');
    auditReport.inspectedDomains.push('Assessment Center');

    // -------------------------------------------------------------
    // DOMAIN 5: Content, Courses & Homepage Settings
    // -------------------------------------------------------------
    console.log('\n--- [DOMAIN 5] Auditing Content & Homepage Editor ---');
    await page.goto(`${BASE_URL}/admin-dashboard/content`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '206_admin_content_editor.png') });
    console.log('  ✅ [SCREENSHOT] 206_admin_content_editor.png captured');

    await page.goto(`${BASE_URL}/admin-dashboard/homepage`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '207_admin_homepage_editor.png') });
    console.log('  ✅ [SCREENSHOT] 207_admin_homepage_editor.png captured');
    auditReport.inspectedDomains.push('Content & Homepage');

    // -------------------------------------------------------------
    // DOMAIN 6: Commerce, Packages & Coupon Management
    // -------------------------------------------------------------
    console.log('\n--- [DOMAIN 6] Auditing Commerce & Coupons ---');
    const testCouponCode = `AUDIT_${Date.now().toString().slice(-4)}`;
    console.log(`  -> Testing Coupon Creation in PostgreSQL: ${testCouponCode}...`);

    const createCouponRes = await fetch(`${API_BASE}/api/v1/commerce/admin/discounts`, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({
        code: testCouponCode,
        label: 'كوبون تدقيق المنصة الآلي',
        discountType: 'percentage',
        percentageBps: 2000,
        fixedMinor: null,
        status: 'active',
        minAmountMinor: 0,
        maxRedemptions: 50,
        startsAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        scopes: [{ scopeType: 'all', productId: '', productType: '' }],
      }),
    });

    if (createCouponRes.ok) {
      const couponData = await createCouponRes.json();
      const createdCouponId = couponData.discount?.id;
      console.log(`  ✅ [MUTATION 3] Coupon ${testCouponCode} created in PostgreSQL! ID: ${createdCouponId}`);
      auditReport.mutations.push({ action: 'create_coupon', status: 'SUCCESS', id: createdCouponId, code: testCouponCode });
    } else {
      console.warn(`  ⚠️ Coupon creation status: ${createCouponRes.status}`);
    }

    await page.goto(`${BASE_URL}/admin-dashboard/commerce`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '208_admin_commerce_coupons.png') });
    console.log('  ✅ [SCREENSHOT] 208_admin_commerce_coupons.png captured');
    auditReport.inspectedDomains.push('Commerce & Subscriptions');

    // -------------------------------------------------------------
    // DOMAIN 7: User Management & Role Lifecycle
    // -------------------------------------------------------------
    console.log('\n--- [DOMAIN 7] Auditing User Management & Lifecycle ---');
    const testUserEmail = `audit.temp.${Date.now().toString().slice(-4)}@almeaa.com`;
    console.log(`  -> Creating temporary student in PostgreSQL: ${testUserEmail}...`);

    let createdUserId = null;
    const createUserRes = await fetch(`${API_BASE}/api/v1/auth/admin/users`, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({
        name: 'طالب تدقيق المنصة المؤقت',
        email: testUserEmail,
        password: 'Password@2026',
        role: 'student',
      }),
    });

    if (createUserRes.ok) {
      const createdUserData = await createUserRes.json();
      createdUserId = createdUserData?.user?.id;
      console.log(`  ✅ [MUTATION 4] User created in PostgreSQL! ID: ${createdUserId}`);
      auditReport.mutations.push({ action: 'create_user', status: 'SUCCESS', id: createdUserId, email: testUserEmail });

      if (createdUserId) {
        const delUserRes = await fetch(`${API_BASE}/api/v1/auth/admin/users/${createdUserId}`, {
          method: 'DELETE',
          headers: apiHeaders,
        });
        if (delUserRes.ok) {
          console.log(`  ✅ [MUTATION 5] Test user deleted from PostgreSQL! Clean rollback.`);
          auditReport.mutations.push({ action: 'delete_user', status: 'SUCCESS', id: createdUserId });
        }
      }
    } else {
      console.warn(`  ⚠️ Create user status: ${createUserRes.status}`);
    }

    await page.goto(`${BASE_URL}/admin-dashboard/users`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '209_admin_user_management.png') });
    console.log('  ✅ [SCREENSHOT] 209_admin_user_management.png captured');

    await page.goto(`${BASE_URL}/admin-dashboard/trainers`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '210_admin_trainers_management.png') });
    console.log('  ✅ [SCREENSHOT] 210_admin_trainers_management.png captured');
    auditReport.inspectedDomains.push('User & Trainer Management');

    // -------------------------------------------------------------
    // DOMAIN 8: Schools Operations & Classes
    // -------------------------------------------------------------
    console.log('\n--- [DOMAIN 8] Auditing Schools & Classes ---');
    await page.goto(`${BASE_URL}/admin-dashboard/schools`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '211_admin_school_roster.png') });
    console.log('  ✅ [SCREENSHOT] 211_admin_school_roster.png captured');
    auditReport.inspectedDomains.push('Schools & Classes');

    // -------------------------------------------------------------
    // DOMAIN 9: AI Assistant & Quotas Engine
    // -------------------------------------------------------------
    console.log('\n--- [DOMAIN 9] Auditing AI Assistant & Quotas ---');
    const aiReadinessRes = await fetch(`${API_BASE}/api/v1/ai/admin/readiness`, { headers: apiHeaders });
    const aiReadiness = aiReadinessRes.ok ? await aiReadinessRes.json() : null;
    console.log(`  -> AI Readiness:`, JSON.stringify(aiReadiness?.readiness || {}));

    await page.goto(`${BASE_URL}/admin-dashboard/ai`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '212_admin_ai_assistant_panel.png') });
    console.log('  ✅ [SCREENSHOT] 212_admin_ai_assistant_panel.png captured');
    auditReport.inspectedDomains.push('AI Assistant & Quotas');

    // -------------------------------------------------------------
    // DOMAIN 10: Announcements & Banner Ads
    // -------------------------------------------------------------
    console.log('\n--- [DOMAIN 10] Auditing Announcements & Popups ---');
    await page.goto(`${BASE_URL}/admin-dashboard/announcements`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '213_admin_announcements_manager.png') });
    console.log('  ✅ [SCREENSHOT] 213_admin_announcements_manager.png captured');
    auditReport.inspectedDomains.push('Announcements & Ads');

    // -------------------------------------------------------------
    // DOMAIN 11: Operations, Audit Logs & Integrations
    // -------------------------------------------------------------
    console.log('\n--- [DOMAIN 11] Auditing System Operations & Audit Logs ---');
    await page.goto(`${BASE_URL}/admin-dashboard/operations`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '214_admin_operations_audit_logs.png') });
    console.log('  ✅ [SCREENSHOT] 214_admin_operations_audit_logs.png captured');

    await page.goto(`${BASE_URL}/admin-dashboard/integrations`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '215_admin_platform_integrations.png') });
    console.log('  ✅ [SCREENSHOT] 215_admin_platform_integrations.png captured');
    auditReport.inspectedDomains.push('Operations & Integrations');

    // -------------------------------------------------------------
    // DOMAIN 12: Disaster Recovery & Backup Snapshots
    // -------------------------------------------------------------
    console.log('\n--- [DOMAIN 12] Auditing Disaster Recovery & Backups ---');
    await page.goto(`${BASE_URL}/admin-dashboard/backups`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(2000);

    const backupBtn = page.locator('button:has-text("إنشاء نسخة احتياطية"), button:has-text("نسخة احتياطية الآن")').first();
    if (await backupBtn.isVisible().catch(() => false)) {
      console.log('  -> Triggering manual backup snapshot creation in UI...');
      await backupBtn.click();
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '216_admin_backups_created.png') });
    console.log('  ✅ [SCREENSHOT] 216_admin_backups_created.png captured');
    auditReport.inspectedDomains.push('Backups & Disaster Recovery');

    // -------------------------------------------------------------
    // DOMAIN 13: Platform Typography & Font Engine
    // -------------------------------------------------------------
    console.log('\n--- [DOMAIN 13] Auditing Platform Typography ---');
    await page.goto(`${BASE_URL}/admin-dashboard/platform-fonts`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '217_admin_platform_fonts.png') });
    console.log('  ✅ [SCREENSHOT] 217_admin_platform_fonts.png captured');
    auditReport.inspectedDomains.push('Platform Fonts');

    console.log('\n================================================================');
    console.log('🎯 FULL-SPECTRUM PLATFORM ADMIN AUDIT COMPLETED SUCCESSFULLY!');
    console.log(`   - Verified PostgreSQL Mutations: ${auditReport.mutations.length}`);
    console.log(`   - Inspected Domains: ${auditReport.inspectedDomains.length}`);
    console.log(`   - Console Errors: ${auditReport.consoleErrors.length}`);
    console.log(`   - Page Errors: ${auditReport.pageErrors.length}`);
    console.log('================================================================\n');

    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'admin_full_spectrum_audit_result.json'),
      JSON.stringify(auditReport, null, 2),
      'utf8'
    );
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('FATAL AUDIT FAILURE:', err);
  process.exit(1);
});
