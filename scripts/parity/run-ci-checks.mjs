import { execSync } from 'child_process';

const checks = [
  'node scripts/parity/public-footer.test.mjs',
  'node scripts/parity/platform-fonts.test.mjs',
  'node scripts/parity/homepage-ui.test.mjs',
  'node --test scripts/parity/header-brand.test.mjs',
  'node --test scripts/parity/admin-skills-separation.test.mjs',
  'node --test scripts/parity/header-navigation.test.mjs',
  'node --test apps/web/src/features/learning/navigation/StudentNavigationProvider.test.mjs',
  'node --test apps/web/src/features/learning/navigation/studentPathScope.test.mjs',
  'node --test scripts/parity/learning-route-selection.test.mjs',
  'node scripts/parity/screen-inventory.test.mjs',
  'node scripts/parity/route-inventory.test.mjs',
  'node scripts/parity/api-mount-inventory.test.mjs',
  'node --experimental-strip-types scripts/parity/identity-login-digits.test.mjs',
  'node --experimental-strip-types scripts/parity/learning-golden.test.mjs',
  'node --experimental-strip-types scripts/parity/adaptive-ranking.test.mjs',
  'node --experimental-strip-types scripts/parity/adaptive-selection-golden.mjs --check',
];

console.log('--- Running Complete Frontend CI Suite ---');
let allPassed = true;

for (const cmd of checks) {
  process.stdout.write(`Running: ${cmd} ... `);
  try {
    execSync(cmd, { stdio: 'pipe' });
    console.log('✅ PASS');
  } catch (err) {
    console.log('❌ FAIL');
    console.error(err.stdout ? err.stdout.toString() : err.message);
    allPassed = false;
  }
}

if (!allPassed) {
  process.exit(1);
} else {
  console.log('\n🎉 ALL 15 FRONTEND CI CHECKS PASSED PERFECTLY!');
}
