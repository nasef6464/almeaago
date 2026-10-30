import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeOpenPullRequests, collectLiveAudit, listAllPages, ownerForPath, renderReport,
} from './pr-overlap-audit.mjs';

const open = number => ({ number, state: 'open', head: { sha: 'head-' + number }, title: 'PR ' + number });

test('detects exact overlap between header and foundation without calling it a merge conflict', () => {
  const files = new Map([
    [159, ['apps/web/src/features/public/components/LegacySiteHeader.tsx', 'apps/web/src/features/learning/pages/LearningSpacePage.tsx']],
    [168, ['apps/web/src/features/learning/pages/LearningSpacePage.tsx', 'apps/web/src/features/learning/components/FoundationTopicDialog.tsx']],
    [166, ['apps/web/src/features/public/pages/PublicLandingPage.tsx']],
  ]);
  const audit = analyzeOpenPullRequests([open(159), open(168), open(166)], files);
  assert.deepEqual(audit.collisions, [{ left: 159, right: 168, sharedFiles: ['apps/web/src/features/learning/pages/LearningSpacePage.tsx'] }]);
  assert.match(renderReport(audit, 'nasef6464/almeaago'), /not proof of a merge conflict/i);
});

test('flags the broad PR spanning public, admin, student and shared boundaries', () => {
  const files = new Map([
    [158, ['apps/web/src/app/App.tsx', 'apps/web/src/features/public/components/LegacySiteHeader.tsx', 'apps/web/src/features/taxonomy/pages/TaxonomyAdminPage.tsx', 'apps/web/src/features/learning/pages/LearningSpacePage.tsx']],
    [159, ['apps/web/src/features/public/components/LegacySiteHeader.tsx']],
    [160, ['apps/web/src/app/App.tsx', 'apps/web/src/features/taxonomy/pages/TaxonomyAdminPage.tsx']],
  ]);
  const audit = analyzeOpenPullRequests([open(158), open(159), open(160)], files, 158);
  assert.deepEqual(audit.collisions.map(c => [c.left, c.right, c.sharedFiles.length]), [[158, 159, 1], [158, 160, 2]]);
  assert.deepEqual(audit.items[0].owners, ['admin', 'public', 'shared-router', 'student']);
});

test('ignores disjoint files and closed PRs', () => {
  const audit = analyzeOpenPullRequests([open(166), { ...open(123), state: 'closed' }],
    new Map([[166, ['apps/web/src/features/public/pages/PublicLandingPage.tsx']]]));
  assert.equal(audit.collisions.length, 0);
  assert.equal(audit.items.length, 1);
});

test('fails closed when inventory is absent or target is not open', () => {
  assert.throws(() => analyzeOpenPullRequests([open(159)], new Map()), /Missing complete/);
  assert.throws(() => analyzeOpenPullRequests([open(159)], new Map([[159, []]]), 160), /not an open PR/);
});

test('maps shared schema, API and CI separately from team UI', () => {
  assert.equal(ownerForPath('migrations/000046_learning_navigation_preferences.up.sql'), 'shared-schema');
  assert.equal(ownerForPath('api/openapi/openapi.yaml'), 'shared-api');
  assert.equal(ownerForPath('.github/workflows/frontend.yml'), 'shared-ci');
  assert.equal(ownerForPath('apps/web/src/features/organizations/pages/TeacherWorkspacePage.tsx'), 'schools');
  assert.equal(ownerForPath('internal/content/application/public_courses.go'), 'shared-content');
});

test('paginates fully at exact 100-row boundary', async () => {
  const calls = [];
  const fakeFetch = async url => {
    calls.push(url);
    const page = Number(new URL(url).searchParams.get('page'));
    return { ok: true, json: async () => page === 1 ? Array.from({ length: 100 }, (_, i) => ({ number: i + 1 })) : [{ number: 101 }] };
  };
  const rows = await listAllPages('/repos/a/b/pulls?state=open', 'token', fakeFetch);
  assert.equal(rows.length, 101);
  assert.equal(calls.length, 2);
});

test('never claims clean when GitHub API is denied', async () => {
  const fakeFetch = async () => ({ ok: false, status: 403 });
  await assert.rejects(collectLiveAudit({ repo: 'nasef6464/almeaago', token: 'x', fetcher: fakeFetch }), /inventory incomplete/);
  await assert.rejects(collectLiveAudit({ repo: 'nasef6464/almeaago', token: '' }), /TOKEN missing/);
});

test('truncates report paths but preserves collision count', () => {
  const files = Array.from({ length: 25 }, (_, i) => 'apps/web/src/features/learning/pages/file-' + i + '.tsx');
  const audit = analyzeOpenPullRequests([open(159), open(168)], new Map([[159, files], [168, files]]));
  const report = renderReport(audit, 'nasef6464/almeaago', { maxPaths: 2 });
  assert.match(report, /25 shared file\(s\)/);
  assert.match(report, /23 more/);
});
