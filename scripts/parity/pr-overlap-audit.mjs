/** Read-only GitHub PR file-overlap audit; a shared path is not proof of a merge conflict. */
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const RULES = [
  [/^\.github\/workflows\//, 'shared-ci'], [/^api\/openapi\//, 'shared-api'],
  [/^migrations\//, 'shared-schema'], [/^apps\/web\/src\/app\//, 'shared-router'],
  [/^apps\/web\/src\/features\/content\/api\//, 'shared-content-api'],
  [/^apps\/web\/src\/features\/(public|presentation)\//, 'public'],
  [/^apps\/web\/src\/features\/(taxonomy|content)\//, 'admin'],
  [/^apps\/web\/src\/features\/(learning|assessment)\//, 'student'],
  [/^apps\/web\/src\/features\/(organizations|parents|classroom)\//, 'schools'],
  [/^internal\/taxonomy\//, 'admin'], [/^internal\/content\//, 'shared-content'],
  [/^internal\/learning\//, 'student'], [/^internal\/organizations\//, 'schools'],
  [/^internal\/(commerce|assessment|platform)\//, 'shared-domain'],
  [/^docs\//, 'documentation'], [/^scripts\//, 'tooling'],
];
export function ownerForPath(file) {
  return RULES.find(([pattern]) => pattern.test(file))?.[1] ?? 'unassigned';
}
export function analyzeOpenPullRequests(pulls, filesByNumber, targetNumber = null) {
  const items = pulls.filter(p => p && Number.isInteger(p.number) && p.state === 'open')
    .map(p => {
      if (!filesByNumber.has(p.number)) throw new Error('Missing complete changed-file inventory for PR #' + p.number);
      const files = [...new Set(filesByNumber.get(p.number))].sort();
      return { number: p.number, headSha: p.head?.sha ?? null, files,
        owners: [...new Set(files.map(ownerForPath))].sort() };
    }).sort((a, b) => a.number - b.number);
  if (targetNumber !== null && !items.some(p => p.number === targetNumber))
    throw new Error('Target PR #' + targetNumber + ' is not an open PR in the complete inventory');
  const collisions = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    if (targetNumber !== null && a.number !== targetNumber && b.number !== targetNumber) continue;
    const paths = new Set(b.files);
    const sharedFiles = a.files.filter(file => paths.has(file));
    if (sharedFiles.length) collisions.push({ left: a.number, right: b.number, sharedFiles });
  }
  return { items, collisions, targetNumber };
}
export function renderReport(audit, repo, { maxPaths = 12 } = {}) {
  const tick = String.fromCharCode(96);
  const visible = audit.targetNumber === null ? audit.items : audit.items.filter(p => p.number === audit.targetNumber);
  const lines = ['# ALMEAA PR overlap / single-writer audit', '',
    'Repository: ' + tick + repo + tick + ' — ' + audit.items.length + ' open PRs inspected.',
    'Read-only exact-path audit. Overlap is not proof of a merge conflict; a clean result is not visual/functional parity.', '',
    '| PR | Files | Ownership areas | Head SHA |', '| --- | ---: | --- | --- |'];
  for (const p of visible) lines.push('| #' + p.number + ' | ' + p.files.length + ' | ' + p.owners.join(', ') + ' | ' + (p.headSha ?? 'UNKNOWN').slice(0, 12) + ' |');
  lines.push('', '## Exact file collisions (' + audit.collisions.length + ' PR pairs)', '');
  if (!audit.collisions.length) lines.push('No exact file overlap found. Semantic API/schema contracts still need manual review.');
  for (const c of audit.collisions) {
    lines.push('### #' + c.left + ' ↔ #' + c.right + ': ' + c.sharedFiles.length + ' shared file(s)');
    for (const file of c.sharedFiles.slice(0, maxPaths)) lines.push('- ' + tick + file.replaceAll(tick, '') + tick + ' (' + ownerForPath(file) + ')');
    if (c.sharedFiles.length > maxPaths) lines.push('- … ' + (c.sharedFiles.length - maxPaths) + ' more; review full file lists.');
    lines.push('');
  }
  lines.push('**Next:** one writer per shared file; compare patches to main and reapply only missing Legacy-backed behavior. No automatic merge.');
  return lines.join('\n') + '\n';
}
async function getArray(path, token, fetcher) {
  const response = await fetcher('https://api.github.com' + path, { headers: {
    Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'almeaa-pr-overlap-audit',
  } });
  if (!response.ok) throw new Error('GitHub API HTTP ' + response.status + ' on ' + path + '; inventory incomplete');
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('Unexpected GitHub API response; inventory incomplete');
  return rows;
}
export async function listAllPages(path, token, fetcher = fetch, maxPages = 20) {
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    const rows = await getArray(path + (path.includes('?') ? '&' : '?') + 'per_page=100&page=' + page, token, fetcher);
    all.push(...rows);
    if (rows.length < 100) return all;
  }
  throw new Error('Pagination limit exceeded for ' + path + '; refusing incomplete audit');
}
export async function collectLiveAudit({ repo, token, targetNumber = null, fetcher = fetch }) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo ?? '')) throw new Error('GITHUB_REPOSITORY must be owner/repo');
  if (!token) throw new Error('GITHUB_TOKEN missing: cannot claim a clean audit');
  const pulls = await listAllPages('/repos/' + repo + '/pulls?state=open', token, fetcher);
  const files = new Map();
  for (const p of pulls) {
    const entries = await listAllPages('/repos/' + repo + '/pulls/' + p.number + '/files', token, fetcher);
    files.set(p.number, entries.map(row => row.filename));
  }
  return analyzeOpenPullRequests(pulls, files, targetNumber);
}
export async function main(argv = process.argv.slice(2), env = process.env) {
  const index = argv.indexOf('--pr');
  const targetNumber = index === -1 ? null : Number(argv[index + 1]);
  if (index !== -1 && (!Number.isInteger(targetNumber) || targetNumber <= 0)) throw new Error('--pr requires positive integer');
  const audit = await collectLiveAudit({ repo: env.GITHUB_REPOSITORY, token: env.GITHUB_TOKEN, targetNumber });
  const report = renderReport(audit, env.GITHUB_REPOSITORY);
  process.stdout.write(report);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, report);
  if (audit.collisions.length) process.stdout.write('::warning::' + audit.collisions.length + ' overlapping PR pair(s) need review.\n');
  if (argv.includes('--strict') && audit.collisions.length) process.exitCode = 1;
  return audit;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error('PR overlap audit BLOCKED: ' + e.message); process.exitCode = 1; });
}
