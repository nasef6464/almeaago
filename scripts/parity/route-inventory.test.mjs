import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { compareRoutes, extractRoutePaths } from './route-inventory.mjs';

test('extracts explicit JSX route paths once and ignores unrelated path props', () => {
  const jsx = `
    <div path="not-a-route" />
    <Route path="/" element={<Home />} />
    <Route path="/courses/:courseId" element={<Course />} />
    <Route path="/courses/:courseId" element={<Course />} />
    <Route
      path="/reports" element={<Reports />}
    />
  `;
  assert.deepEqual(extractRoutePaths(jsx), ['/', '/courses/:courseId', '/reports']);
});

test('compares explicit route contracts without treating different URLs as equivalent', () => {
  const result = compareRoutes(['/', '/legacy', '/legacy'], ['/', '/modern']);
  assert.deepEqual(result, {
    legacyCount: 2,
    targetCount: 2,
    sharedCount: 1,
    legacyOnly: ['/legacy'],
    targetOnly: ['/modern'],
  });
});

test('the reviewed legacy snapshot can be compared to the current Go App route tree', () => {
  const legacy = JSON.parse(readFileSync(new URL('../../docs/migration/baselines/2026-10-28-node-explicit-routes.json', import.meta.url), 'utf8'));
  const goRoutes = extractRoutePaths(readFileSync(new URL('../../apps/web/src/app/App.tsx', import.meta.url), 'utf8'));
  const diff = compareRoutes(legacy.paths, goRoutes);
  assert.equal(legacy.sourceFile, 'app/AppRouteTree.tsx');
  assert.equal(diff.legacyCount, 55);
  assert.equal(diff.targetCount, 70);
  assert.equal(diff.sharedCount, 34);
  assert.equal(diff.legacyOnly.length, 21);
  assert.equal(diff.targetOnly.length, 36);
  assert.ok(diff.legacyOnly.includes('/admin/quiz-gen'));
  assert.ok(diff.targetOnly.includes('/admin-dashboard/assessments'));
  assert.ok(diff.targetOnly.includes('/admin-dashboard/platform-fonts'));
});
