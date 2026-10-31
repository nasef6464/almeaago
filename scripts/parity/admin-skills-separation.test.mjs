import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { MemoryRouter } = require('react-router-dom');
const fixture = {
  paths: [{ id: 'p', code: 'QDR', name: 'القدرات', description: '', sortOrder: 0, status: 'active' }],
  levels: [],
  subjects: [{ id: 's', pathId: 'p', code: 'MATH', name: 'الكمي', sortOrder: 0, status: 'active' }],
  skills: [
    { id: 'main', subjectId: 's', code: 'M1', name: 'الجبر', kind: 'main', description: '', sortOrder: 0, status: 'active' },
    { id: 'sub', subjectId: 's', code: 'S1', name: 'المعادلات', kind: 'sub', parentSkillId: 'main', description: '', sortOrder: 1, status: 'active' },
  ],
};

function load(relative, initialStates = []) {
  const source = new URL(`../../apps/web/src/${relative}`, import.meta.url);
  const javascript = ts.transpileModule(readFileSync(source, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let state = 0;
  const seededReact = {
    ...React,
    useState: (initial) => React.useState(state < initialStates.length ? initialStates[state++] : (state++, initial)),
  };
  const resolve = (id) => {
    if (id === 'react') return seededReact;
    if (id.endsWith('/AuthProvider')) return { useAuth: () => ({ user: { roles: ['admin'], name: 'مدير المنصة' }, loading: false, getCsrfToken: async () => 'test' }) };
    if (id.endsWith('/taxonomy-admin-client')) return { taxonomyAdminClient: {} };
    if (id.endsWith('/questionbank-client')) return { questionBankClient: {} };
    if (id.endsWith('/content-client')) return { contentClient: {} };
    if (id.endsWith('/commerce/api/commerce-client')) return { commerceClient: {} };
    if (id.endsWith('/assessment/api/assessment-client')) return { assessmentClient: {} };
    if (id.endsWith('/components/AdminBreadcrumbHeader')) return { AdminBreadcrumbHeader: () => null };
    if (id.endsWith('/components/EducationalIconPicker')) return { EducationalIconPicker: () => null };
    if (id.endsWith('/components/pathDisplayPresentation')) return {
      getPathIcon: (_path, className) => React.createElement('span', { className }, '📚'),
      getSubjectIcon: (_subject, className) => React.createElement('span', { className }, '📖'),
      getLevelIcon: (_level, className) => React.createElement('span', { className }, '🎓'),
      resolveColor: () => ({ soft: '#f3f4f6', text: '#4b5563', border: '#d1d5db' }),
      resolvePathDisplaySettings: () => ({ showSubjectCards: true, showMockExamCard: true, showPackageCard: true }),
    };
    if (id.endsWith('/components/pathsManagerUrlState')) return {
      resolvePathsManagerUrlState: () => ({
        selectedPathId: 'p', selectedSubjectId: null, pathTab: 'subjects', subjectTab: 'courses',
      }),
      replacePathsManagerUrlState: () => {},
    };
    if (id.endsWith('/components/pathReadiness')) return {
      buildPathReadinessSummary: () => ({ total: 0, visible: 0, hidden: 0, subjects: 0, packages: 0 }),
    };
    if (id.endsWith('/lesson-link-write')) return load('features/content/api/lesson-link-write.ts');
    if (id.endsWith('/LessonEditorPanel')) return load('features/content/components/LessonEditorPanel.tsx');
    if (id.endsWith('/navigation')) return {
      HOMEPAGE_ADMIN_HREF: '/admin-dashboard?tab=homepage', PLATFORM_FONTS_ADMIN_HREF: '/admin-dashboard?tab=platform-fonts',
      isHomepageLocation: () => false, isPlatformFontsLocation: () => false,
      buildHomepageHref: () => '/admin-dashboard?tab=homepage', buildPlatformFontsHref: () => '/admin-dashboard?tab=platform-fonts',
    };
    return require(id);
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', javascript)(resolve, module, module.exports);
  return module.exports;
}

test('original admin navigation keeps Skills Center separate from Paths Center', () => {
  const { AdminDashboardShell } = load('features/content/components/AdminDashboardShell.tsx');
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null,
    React.createElement(AdminDashboardShell, null, React.createElement('main', null, 'workspace'))));
  assert.match(html, /href="\/admin-dashboard\?tab=skills"[^>]*>[^<]*<[^>]*>.*?مركز المهارات/s);
  assert.match(html, /href="\/admin-dashboard\/taxonomy"/);
  assert.doesNotMatch(html, /إدارة المسارات والتصنيف/);
});

test('path workspace does not also own the skill creation tree', () => {
  // The current Paths Manager uses URL-backed state and separate presentation/data
  // modules. Seed its first six state hooks and isolate imported services so this
  // SSR contract only verifies the selected path workspace, not API behavior.
  const { TaxonomyAdminPage } = load('features/taxonomy/pages/TaxonomyAdminPage.tsx', [fixture, false, '', '', '', 0]);
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(TaxonomyAdminPage)));
  assert.match(html, /إضافة مادة/);
  assert.doesNotMatch(html, /شجرة المهارات/);
  assert.doesNotMatch(html, /إضافة المهارة/);
});

test('independent Skills Center presents original main/subskill tree with its own filters', () => {
  const { SkillsAdminPage } = load('features/taxonomy/pages/SkillsAdminPage.tsx', [fixture, '', '']);
  const html = renderToStaticMarkup(React.createElement(SkillsAdminPage));
  assert.match(html, /مركز المهارات/);
  assert.match(html, /إضافة مهارة رئيسة/);
  assert.match(html, /كل المسارات/);
  assert.match(html, /المهارات الرئيسة/);
  assert.match(html, /الجبر/);
  assert.doesNotMatch(html, /شجرة المسارات/);
});

test('skill save error is visible inside the open editor and the draft survives', () => {
  const draft = { kind: 'sub', subjectId: 's', parentSkillId: 'main', code: 'EQ2', name: 'حل المعادلات', description: '', sortOrder: 0 };
  const states = [fixture, '', '', false, false, 'تعارض مؤقت', '', 0, 'main', draft];
  const { SkillsAdminPage } = load('features/taxonomy/pages/SkillsAdminPage.tsx', states);
  const html = renderToStaticMarkup(React.createElement(SkillsAdminPage));
  const dialog = html.slice(html.indexOf('role="dialog"'));
  assert.match(dialog, /role="alert"[^>]*>تعارض مؤقت/);
  assert.match(dialog, /value="حل المعادلات"/);
});

test('expanded subskill exposes its own question workspace linked to the canonical question bank', () => {
  const states = [fixture, '', '', false, false, '', '', 0, 'main', null, 'sub'];
  const { SkillsAdminPage } = load('features/taxonomy/pages/SkillsAdminPage.tsx', states);
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(SkillsAdminPage)));
  assert.match(html, /الأسئلة المرتبطة/);
  assert.match(html, /href="\/admin-dashboard\/questions\?skillId=sub"/);
  assert.match(html, /مهارة المعادلات/);
});

test('original Skills Center link dialog uses a single lesson selector, Cancel and Link without invented controls', () => {
  const states = [fixture, '', '', false, false, '', '', 0, 'main', null, 'sub',
    { skillId: 'sub', rows: [], total: 0, loading: false, error: '' },
    { skillId: 'sub', rows: [], loading: false, hasMore: false, error: '' },
    1, 0, fixture.skills[1]];
  const { SkillsAdminPage } = load('features/taxonomy/pages/SkillsAdminPage.tsx', states);
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(SkillsAdminPage)));
  assert.match(html, /aria-label="ربط درس موجود"/);
  assert.match(html, /<label[^>]*>اختر الدرس<\/label>/);
  assert.match(html, /<select[^>]*id="skills-lesson-to-link"/);
  assert.match(html, />إلغاء<\/button>/);
  assert.match(html, />ربط<\/button>/);
  assert.doesNotMatch(html, /تحديث المهارات|حالة المهارة/);
});

test('question-bank client uses exact skill ID and omits unselected optional filters', async () => {
  const source = readFileSync(new URL('../../apps/web/src/features/questionbank/api/questionbank-client.ts', import.meta.url), 'utf8');
  const javascript = ts.transpileModule(source.replaceAll('import.meta.env', '({ VITE_API_BASE_URL: "" })'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', javascript)(mod, mod.exports);
  const previous = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(new URL(url, 'https://example.test'));
    return { ok: true, json: async () => ({ items: [], page: 1, limit: 6, hasMore: false }) };
  };
  try {
    await mod.exports.questionBankClient.list({ page: 1, limit: 6, skillIds: ['sub'] });
    assert.equal(urls.length, 1);
    assert.equal(urls[0].searchParams.get('skillId'), 'sub');
    assert.equal(urls[0].searchParams.has('linked'), false);
    assert.equal(urls[0].searchParams.has('withVideo'), false);
    assert.equal(urls[0].searchParams.has('withExplanation'), false);
  } finally {
    globalThis.fetch = previous;
  }
});

test('expanded subskill shows its linked lessons with a safe link and detach workspace', () => {
  const questions = { skillId: 'sub', rows: [], total: 0, loading: false, error: '' };
  const lesson = { id: 'lesson-1', pathId: 'p', subjectId: 's', title: 'درس المعادلات', type: 'video', workflowStatus: 'draft', revision: 1 };
  const lessons = { skillId: 'sub', rows: [lesson], loading: false, hasMore: false, error: '' };
  const states = [fixture, '', '', false, false, '', '', 0, 'main', null, 'sub', questions, lessons];
  const { SkillsAdminPage } = load('features/taxonomy/pages/SkillsAdminPage.tsx', states);
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(SkillsAdminPage)));
  assert.match(html, /الدروس المرتبطة/);
  assert.ok(html.indexOf('الدروس المرتبطة') < html.indexOf('الأسئلة المرتبطة'), 'legacy subskill renders lessons before questions');
  assert.match(html, /درس المعادلات/);
  assert.match(html, /ربط درس موجود/);
  assert.match(html, /فصل الدرس درس المعادلات عن المهارة/);
});

test('skill lesson link updates preserve every existing lesson field and optimistic revision', () => {
  const { lessonLinkWrite } = load('features/content/api/lesson-link-write.ts');
  const lesson = {
    id: 'l1', revision: 4, pathId: 'p1', subjectId: 's1', title: 'معادلات', description: 'شرح',
    type: 'video', contentText: 'المحتوى', durationSeconds: 480, videoUrl: 'https://youtu.be/abc', videoSource: 'youtube',
    meetingUrl: '', meetingAt: null, recordingUrl: '', joinInstructions: '', showRecording: false,
    ownerType: 'platform', ownerUserId: '', ownerSchoolId: '', assignedTeacherId: '', revenueSharePercentage: null,
    isVisible: true, isLocked: false, skillIds: ['s-old'], assetIds: ['media-1'],
  };
  const result = lessonLinkWrite(lesson, ['s-old', 's-new']);
  assert.deepEqual(result.skillIds, ['s-old', 's-new']);
  assert.equal(result.expectedRevision, 4);
  assert.equal(result.videoUrl, 'https://youtu.be/abc');
  assert.equal(result.title, 'معادلات');
  assert.equal(result.contentText, 'المحتوى');
  assert.deepEqual(result.assetIds, ['media-1']);
  assert.equal(result.ownerType, 'platform');
  assert.equal(result.isVisible, true);
});

test('canonical lesson editor pins the initiating subskill only for the skills workflow', () => {
  const props = { coreTaxonomy: fixture, initialPathId: 'p', initialSubjectId: 's', lockScope: true,
    getCsrfToken: async () => 'token', onCancel: () => {}, onSaved: () => {} };
  const seed = [null, fixture, false, false];
  const { LessonEditorPanel } = load('features/content/components/LessonEditorPanel.tsx', seed);
  const anchored = renderToStaticMarkup(React.createElement(LessonEditorPanel, {
    ...props, initialSkillIds: ['sub'], requiredSkillIds: ['sub'], scopeContext: 'skill',
  }));
  assert.match(anchored, /مهارة المعادلات/);
  assert.match(anchored, /<input(?=[^>]*type="checkbox")(?=[^>]*checked="")(?=[^>]*disabled="")[^>]*\/?><span[^>]*>المعادلات/s);
  const { LessonEditorPanel: PlainEditor } = load('features/content/components/LessonEditorPanel.tsx', seed);
  const plain = renderToStaticMarkup(React.createElement(PlainEditor, { ...props, lockScope: false }));
  assert.doesNotMatch(plain, /مهارة المعادلات/);
  assert.match(plain, /المعادلات/);
});

test('expanded subskill preserves original add and edit lesson controls beside link/detach', () => {
  const questions = { skillId: 'sub', rows: [], total: 0, loading: false, error: '' };
  const lessons = { skillId: 'sub', rows: [{ id: 'lesson-1', pathId: 'p', subjectId: 's', title: 'درس المعادلات', type: 'text', workflowStatus: 'draft', revision: 1 }], loading: false, hasMore: false, error: '' };
  const states = [fixture, '', '', false, false, '', '', 0, 'main', null, 'sub', questions, lessons];
  const { SkillsAdminPage } = load('features/taxonomy/pages/SkillsAdminPage.tsx', states);
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(SkillsAdminPage)));
  assert.match(html, /إضافة درس جديد/);
  assert.match(html, /تعديل الدرس درس المعادلات/);
});
