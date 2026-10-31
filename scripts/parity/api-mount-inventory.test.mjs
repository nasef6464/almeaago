import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { compareMounts, extractMounts } from './api-mount-inventory.mjs';

test('reads Express mounts including repeated prefixes and ignores comments', () => {
  const source = `
    // apiRouter.use('/fake', fakeRouter);
    apiRouter.use('/quizzes', learningCompletionRouter);
    apiRouter.use("/quizzes", quizRouter);
    apiRouter.use(
      '/review', reviewRouter
    );
  `;
  assert.deepEqual(extractMounts(source, 'express'), [
    { prefix: '/api/quizzes', owner: 'learningCompletionRouter' },
    { prefix: '/api/quizzes', owner: 'quizRouter' },
    { prefix: '/api/review', owner: 'reviewRouter' },
  ]);
});

test('reads Chi mounts with the fully-qualified versioned and compatibility prefixes', () => {
  const source = `
    router.Mount("/api/v1/assessments", deps.Assessments)
    // router.Mount("/api/v1/unsafe", deps.Unsafe)
    router.Mount("/api/school-access", deps.LegacySchoolAccess)
  `;
  assert.deepEqual(extractMounts(source, 'chi'), [
    { prefix: '/api/v1/assessments', owner: 'deps.Assessments' },
    { prefix: '/api/school-access', owner: 'deps.LegacySchoolAccess' },
  ]);
});

test('does not claim two different API prefixes are behaviorally equivalent', () => {
  const comparison = compareMounts(
    [{ prefix: '/api/quiz' }, { prefix: '/api/quiz' }, { prefix: '/api/school-access' }],
    [{ prefix: '/api/v1/assessments' }, { prefix: '/api/school-access' }],
  );
  assert.deepEqual(comparison, {
    legacyMounts: 3,
    targetMounts: 2,
    legacyUniquePrefixes: 2,
    targetUniquePrefixes: 2,
    sharedExactPrefixes: ['/api/school-access'],
  });
});

test('baseline records the Node mount table and detects its exact Go comparison', () => {
  const baseline = JSON.parse(readFileSync(new URL('../../docs/migration/baselines/2026-10-28-node-api-mounts.json', import.meta.url), 'utf8'));
  const sourceGo = readFileSync(new URL('../../internal/platform/httpserver/server.go', import.meta.url), 'utf8');
  const go = extractMounts(sourceGo, 'chi');
  const comparison = compareMounts(baseline.mounts, go);
  assert.equal(baseline.sourceFile, 'server/src/routes/index.ts');
  assert.equal(comparison.legacyMounts, 33);
  assert.equal(comparison.targetMounts, 33);
  assert.equal(comparison.legacyUniquePrefixes, 30);
  assert.equal(comparison.targetUniquePrefixes, 33);
  assert.deepEqual(comparison.sharedExactPrefixes, ['/api/school-access']);
});
