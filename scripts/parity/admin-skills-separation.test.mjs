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
  const { TaxonomyAdminPage } = load('features/taxonomy/pages/TaxonomyAdminPage.tsx', [fixture, 'p', 's']);
  const html = renderToStaticMarkup(React.createElement(TaxonomyAdminPage));
  assert.match(html, /شجرة المسارات/);
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
