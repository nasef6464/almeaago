import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractRoutePaths } from './route-inventory.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appFilePath = resolve(__dirname, '../../apps/web/src/app/App.tsx');
const errorBoundaryPath = resolve(__dirname, '../../apps/web/src/app/AppErrorBoundary.tsx');

const EXPECTED_28_LAZY_MODULES = [
  { name: 'ContentAdminPage', path: '../features/content/pages/ContentAdminPage' },
  { name: 'AdminOverviewPage', path: '../features/content/pages/AdminOverviewPage' },
  { name: 'AssessmentAdminPage', path: '../features/assessment/pages/AssessmentAdminPage' },
  { name: 'PreparedQuizAdminPage', path: '../features/assessment/pages/PreparedQuizAdminPage' },
  { name: 'CommerceAdminPage', path: '../features/commerce/pages/CommerceAdminPage' },
  { name: 'UsersAdminPage', path: '../features/auth/pages/UsersAdminPage' },
  { name: 'SchoolsAdminPage', path: '../features/organizations/pages/SchoolsAdminPage' },
  { name: 'NotificationsAdminPage', path: '../features/notifications/pages/NotificationsAdminPage' },
  { name: 'ClassroomContractsAdminPage', path: '../features/classroom/pages/ClassroomContractsAdminPage' },
  { name: 'AiAdminPage', path: '../features/ai/pages/AiAdminPage' },
  { name: 'ReportsPage', path: '../features/reporting/pages/ReportsPage' },
  { name: 'OperationsAdminPage', path: '../features/operations/pages/OperationsAdminPage' },
  { name: 'TaxonomyAdminPage', path: '../features/taxonomy/pages/TaxonomyAdminPage' },
  { name: 'SkillsAdminPage', path: '../features/taxonomy/pages/SkillsAdminPage' },
  { name: 'QuestionBankAdminPage', path: '../features/questionbank/pages/QuestionBankAdminPage' },
  { name: 'AnnouncementAdsAdminPage', path: '../features/presentation/AnnouncementAdsAdminPage' },
  { name: 'PlatformIntegrationsAdminPage', path: '../features/operations/pages/PlatformIntegrationsAdminPage' },
  { name: 'BackupAdminPage', path: '../features/operations/pages/BackupAdminPage' },
  { name: 'PlatformFontsPage', path: '../features/presentation/PlatformFontsPage' },
  { name: 'HomepagePage', path: '../features/presentation/HomepagePage' },
  { name: 'SchoolDirectorDashboardPage', path: '../features/organizations/pages/SchoolDirectorDashboardPage' },
  { name: 'TeacherWorkspacePage', path: '../features/organizations/pages/TeacherWorkspacePage' },
  { name: 'PlatformTrainerDashboardPage', path: '../features/organizations/pages/PlatformTrainerDashboardPage' },
  { name: 'ClassroomTeacherPage', path: '../features/classroom/pages/ClassroomTeacherPage' },
  { name: 'ClassroomProjectorPage', path: '../features/classroom/pages/ClassroomProjectorPage' },
  { name: 'ClassroomJoinPage', path: '../features/classroom/pages/ClassroomJoinPage' },
  { name: 'ClassroomStudentPage', path: '../features/classroom/pages/ClassroomStudentPage' },
  { name: 'SchoolInterventionsPage', path: '../features/learning/pages/SchoolInterventionsPage' },
  { name: 'BookSessionPage', path: '../features/learning/pages/BookSessionPage' },
  { name: 'QAPage', path: '../features/learning/pages/QAPage' },
  { name: 'LiveSessionsPage', path: '../features/learning/pages/LiveSessionsPage' },
  { name: 'LiveSessionLobbyPage', path: '../features/learning/pages/LiveSessionLobbyPage' },
  { name: 'MyRequestsPage', path: '../features/learning/pages/MyRequestsPage' },
  { name: 'QuizGeneratorPage', path: '../features/questionbank/pages/QuizGeneratorPage' },
];

test('App.tsx defines all 99 explicit route declarations preserving route inventory parity', () => {
  assert.ok(existsSync(appFilePath), 'App.tsx must exist');
  const appSource = readFileSync(appFilePath, 'utf8');
  const routePaths = extractRoutePaths(appSource);

  assert.equal(routePaths.length, 99, `Expected exactly 99 route declarations, found ${routePaths.length}`);
  assert.ok(routePaths.includes('/'), 'Must include root landing page');
  assert.ok(routePaths.includes('/admin-dashboard'), 'Must include admin dashboard');
  assert.ok(routePaths.includes('/school-director'), 'Must include school director');
  assert.ok(routePaths.includes('/school-teacher-dashboard'), 'Must include school teacher dashboard');
  assert.ok(routePaths.includes('/supervisor-dashboard'), 'Must include supervisor dashboard');
  assert.ok(routePaths.includes('*'), 'Must include 404 catch-all route');
});

test('App.tsx utilizes lazy-loading for the 34 role, admin, and student parity modules with valid targets', () => {
  const appSource = readFileSync(appFilePath, 'utf8');
  const appDir = dirname(appFilePath);

  assert.equal(EXPECTED_28_LAZY_MODULES.length, 34, 'Should test exactly 34 lazy modules');

  for (const mod of EXPECTED_28_LAZY_MODULES) {
    const importPattern = new RegExp(`React\\.lazy\\s*\\(\\s*\\(\\)\\s*=>\\s*import\\(['"]${mod.path.replace(/\./g, '\\.')}['"]\\)`);
    assert.match(
      appSource,
      importPattern,
      `App.tsx should lazily import ${mod.name} from ${mod.path}`
    );

    const tsxPath = resolve(appDir, mod.path + '.tsx');
    const tsPath = resolve(appDir, mod.path + '.ts');
    const fileExists = existsSync(tsxPath) || existsSync(tsPath);
    assert.ok(fileExists, `Target module file must exist on disk: ${mod.path}`);
  }
});

test('AppErrorBoundary provides recoverable RTL fallback with retry and home actions', () => {
  assert.ok(existsSync(errorBoundaryPath), 'AppErrorBoundary.tsx must exist');
  const source = readFileSync(errorBoundaryPath, 'utf8');

  assert.match(source, /class\s+AppErrorBoundary\s+extends\s+Component/, 'Must be a React Error Boundary class component');
  assert.match(source, /getDerivedStateFromError/, 'Must implement getDerivedStateFromError');
  assert.match(source, /componentDidCatch/, 'Must implement componentDidCatch');
  assert.match(source, /حدث خطأ أثناء تحميل الصفحة/, 'Must provide friendly Arabic error heading');
  assert.match(source, /إعادة المحاولة/, 'Must provide retry button');
  assert.match(source, /العودة للرئيسية/, 'Must provide go-home button');
});

test('App.tsx wraps route tree in AppErrorBoundary and Suspense fallback', () => {
  const appSource = readFileSync(appFilePath, 'utf8');

  assert.match(appSource, /import\s+\{\s*AppErrorBoundary\s*\}\s+from\s+['"]\.\/AppErrorBoundary['"]/, 'Must import AppErrorBoundary');
  assert.match(appSource, /<AppErrorBoundary>/, 'Must wrap element tree with <AppErrorBoundary>');
  assert.match(appSource, /<Suspense\s+fallback=/, 'Must wrap dynamic routes with <Suspense fallback=...>');
});
