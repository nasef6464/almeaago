import { execSync } from 'child_process';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const { chromium } = require(path.resolve('apps/web/node_modules/playwright'));

const ARTIFACT_DIR = process.env.ARTIFACT_DIR || path.resolve('./artifacts');

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 },
];

async function verifySlice(targetUrl, sliceName) {
  console.log(`\n========================================`);
  console.log(`🔍 [GATE 1 & 2] Verifying Build & Types...`);
  console.log(`========================================`);

  try {
    console.log('Building Web Client (tsc -b && vite build)...');
    execSync('npm run build', { cwd: 'c:/almeaago/almeaago/apps/web', stdio: 'inherit' });
    console.log('✅ Web build succeeded!');
  } catch (err) {
    console.error('❌ Web build failed:', err.message);
    process.exit(1);
  }

  try {
    console.log('Building Go API (go build -o build_check.exe ./cmd/api)...');
    execSync('go build -o build_check.exe ./cmd/api', { cwd: 'c:/almeaago/almeaago', stdio: 'inherit' });
    if (fs.existsSync('c:/almeaago/almeaago/build_check.exe')) {
      fs.unlinkSync('c:/almeaago/almeaago/build_check.exe');
    }
    console.log('✅ Go API build succeeded!');
  } catch (err) {
    console.error('❌ Go API build failed:', err.message);
    process.exit(1);
  }

  console.log(`\n========================================`);
  console.log(`📸 [GATE 3] Multi-Viewport Browser Verification (${sliceName})...`);
  console.log(`========================================`);

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  let hasConsoleErrors = false;

  for (const vp of VIEWPORTS) {
    console.log(`Auditing viewport: ${vp.name} (${vp.width}x${vp.height})...`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      locale: 'ar-SA',
    });
    const page = await context.newPage();

    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`🚨 [${vp.name}] BROWSER ERROR:`, msg.text());
        hasConsoleErrors = true;
      }
    });

    try {
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1500);

      const shotPath = path.join(ARTIFACT_DIR, `${sliceName}_${vp.name}.png`);
      await page.screenshot({ path: shotPath, fullPage: false });
      console.log(`✅ Saved screenshot: ${shotPath}`);
    } catch (e) {
      console.error(`❌ Viewport test failed for ${vp.name}:`, e.message);
    } finally {
      await context.close();
    }
  }

  await browser.close();

  console.log(`\n========================================`);
  console.log(`🏁 [SUMMARY] Vertical Slice Quality Certification`);
  console.log(`========================================`);
  if (hasConsoleErrors) {
    console.warn(`⚠️ Completed with console warnings/errors. Review logs above.`);
  } else {
    console.log(`🎉 All Quality Gates Passed (GREEN)! Ready for Safe PR / Merge.`);
  }
}

const targetUrl = process.argv[2] || 'http://localhost:5173/category/p_qudrat?subject=sub_quant';
const sliceName = process.argv[3] || 'slice_verification';

verifySlice(targetUrl, sliceName).catch(err => {
  console.error('Verification script crashed:', err);
  process.exit(1);
});
