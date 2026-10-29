import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { MemoryRouter } = require('react-router-dom');
const source = new URL('../../apps/web/src/features/public/components/headerNavigation.ts', import.meta.url);

function build(taxonomy, navigation = {}) {
  const module = { exports: {} };
  const javascript = ts.transpileModule(readFileSync(source, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('module', 'exports', javascript)(module, module.exports);
  return module.exports.buildHeaderNavigation(taxonomy, navigation);
}

const path = (id, extra = {}) => ({ id, name: `مسار ${id}`, sortOrder: Number(id) || 1, ...extra });
const subject = (id, pathId, extra = {}) => ({ id, pathId, name: `مادة ${id}`, sortOrder: 1, ...extra });

test('shows all eligible top-level paths without the four-path cap and nests child paths', () => {
  const paths = Array.from({ length: 8 }, (_, i) => path(String(i + 1)));
  paths.push(path('child', { parentPathId: '1', sortOrder: 2 }));
  const menu = build({ paths, levels: [], subjects: [] });
  const parents = menu.filter((item) => item.kind === 'path');
  assert.equal(parents.length, 8);
  assert.deepEqual(parents.map((item) => item.id), paths.slice(0, 8).map((item) => item.id));
  assert.equal(parents[0].href, '/category/1');
  assert.equal(parents[0].children.find((item) => item.id === 'child').href, '/category/child');
});

test('preserves level→subject hierarchy and source category query names', () => {
  const menu = build({
    paths: [path('q')],
    levels: [{ id: 'l1', pathId: 'q', name: 'المرحلة الأولى', sortOrder: 1 }],
    subjects: [subject('math', 'q', { levelId: 'l1' }), subject('verbal', 'q')],
  });
  const parent = menu.find((item) => item.id === 'q');
  const level = parent.children.find((item) => item.id === 'l1');
  assert.equal(level.kind, 'level');
  assert.equal(level.href, '/category/q?level=l1');
  assert.deepEqual(level.children.map((item) => item.href), ['/category/q?level=l1&subject=math']);
  assert.equal(parent.children.find((item) => item.id === 'verbal').href, '/category/q?subject=verbal');
  assert.equal(parent.children.find((item) => item.kind === 'mock-exam').href, '/category/q?tab=mock-exams');
  assert.equal(parent.children.find((item) => item.kind === 'package').href, '/category/q?tab=packages');
});

test('honors source visibility, automatic-path toggle, and navigation order', () => {
  const taxonomy = { paths: [path('one'), path('hidden', { showInNavbar: false })], subjects: [], levels: [] };
  const settings = { items: [
    { id: 'home', order: 10, visible: true },
    { id: 'pricing', order: 5, visible: false },
    { id: 'blog', order: 4, label: 'أخبارنا' },
  ] };
  const menu = build(taxonomy, settings);
  assert.deepEqual(menu.filter((item) => item.kind === 'path').map((item) => item.id), ['one']);
  assert.equal(menu.some((item) => item.id === 'pricing'), false);
  assert.equal(menu.find((item) => item.id === 'more').children[0].label, 'أخبارنا');
  assert.equal(menu[0].id, 'home');
  const noPaths = build(taxonomy, { ...settings, showAutoPaths: false });
  assert.equal(noPaths.some((item) => item.kind === 'path'), false);
});

test('keeps original mock-exam navigation and grouped pricing/blog links', () => {
  const menu = build({ paths: [path('q')], subjects: [subject('s', 'q')], levels: [] });
  const mock = menu.find((item) => item.id === 'mock-exams');
  assert.equal(mock.href, '/mock-exams');
  assert.equal(mock.children[0].href, '/category/q?tab=mock-exams');
  const more = menu.find((item) => item.id === 'more');
  assert.deepEqual(more.children.map((item) => item.href), ['/pricing', '/blog']);
});

test('actual public header renders every root path at its original category URL', () => {
  const taxonomy = { paths: Array.from({ length: 8 }, (_, i) => path(String(i + 1))), levels: [], subjects: [] };
  const realReact = { ...React, useState(initial) {
    return React.useState(initial && typeof initial === 'object' && Array.isArray(initial.paths) ? taxonomy : initial);
  } };
  const sourceText = readFileSync(new URL('../../apps/web/src/features/public/components/LegacySiteHeader.tsx', import.meta.url), 'utf8');
  const mod = { exports: {} };
  const helper = { exports: {} };
  new Function('module', 'exports', ts.transpileModule(readFileSync(source, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(helper, helper.exports);
  const resolve = (id) => id === 'react' ? realReact :
    id.endsWith('/useHomepageSettings') ? { useHomepageSettings: () => ({ brand: {}, navigation: {} }) } :
    id.endsWith('/AuthProvider') ? { useAuth: () => ({ user: null }) } :
    id.endsWith('/content-client') ? { contentClient: { taxonomyCore: () => Promise.resolve(taxonomy) } } :
    id.endsWith('/dashboard-path') ? { dashboardPathFor: () => '/dashboard' } :
    id.endsWith('/headerNavigation') ? helper.exports : require(id);
  new Function('require', 'module', 'exports', ts.transpileModule(sourceText, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText)(resolve, mod, mod.exports);
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(mod.exports.LegacySiteHeader, { onAuth() {} })));
  assert.match(html, /href="\/category\/8"/);
  assert.doesNotMatch(html, /href="\/learning\?pathId=8"/);
});
