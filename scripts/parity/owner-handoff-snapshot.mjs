/** Local static discovery only. No runtime, visual or functional certification.
 * node scripts/parity/owner-handoff-snapshot.mjs --legacy "C:\\path with spaces\\legacy" \
 *   --output docs/migration/owner-handoff/2026-11-01/discovery.json
 * Omitting --output writes JSON to stdout. Never reads environment or DB files.
 */
import { mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { inventory, summarize } from './screen-inventory.mjs';
import { compareRoutes, extractRoutePaths } from './route-inventory.mjs';

const targetRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const slash = value => value.split(sep).join('/');
const within = (root, path) => {
  const rel = relative(root, path);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
};

export function parseArguments(args) {
  const result = {};
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i];
    if (!['--legacy', '--output'].includes(name) || !args[i + 1] || args[i + 1].startsWith('--')) {
      throw new Error('Usage: --legacy <read-only checkout> [--output <allowed JSON path>]');
    }
    if (result[name.slice(2)]) throw new Error(`Duplicate option: ${name}`);
    result[name.slice(2)] = args[i + 1];
  }
  if (!result.legacy) throw new Error('Explicit --legacy checkout is required; no historical snapshot fallback.');
  return result;
}

export function allowedOutputPath(output, root = targetRoot) {
  const path = resolve(root, output);
  const allowed = ['docs/migration/owner-handoff', '.tmp'].map(dir => resolve(root, dir));
  if (!allowed.some(dir => within(dir, path)) || !path.endsWith('.json')) {
    throw new Error('Output must be a JSON file beneath docs/migration/owner-handoff or .tmp in the target checkout.');
  }
  // Existing parents/files may be symlinks or junctions: enforce their real destination.
  let ancestor = path;
  while (!statSync(ancestor, { throwIfNoEntry: false })) ancestor = dirname(ancestor);
  const canonicalRoot = realpathSync(root);
  const actualAncestor = realpathSync(ancestor);
  if (actualAncestor !== canonicalRoot && !within(canonicalRoot, actualAncestor)) {
    throw new Error('Output symlink/junction resolves outside the target checkout.');
  }
  const projected = resolve(actualAncestor, relative(ancestor, path));
  const canonicalAllowed = allowed.map(dir => resolve(canonicalRoot, relative(root, dir)));
  if (!canonicalAllowed.some(dir => within(dir, projected))) {
    throw new Error('Output symlink/junction resolves outside the allowed evidence directories.');
  }
  return path;
}

function gitState(root) {
  const run = args => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true }).trim();
  const records = run(['status', '--porcelain=v1', '-z', '--untracked-files=all']).split('\0').filter(Boolean);
  let trackedChanges = 0, untrackedFiles = 0;
  for (let i = 0; i < records.length; i++) {
    const state = records[i].slice(0, 2);
    if (state === '??') untrackedFiles++; else trackedChanges++;
    if (/[RC]/.test(state)) i++; // porcelain -z supplies a second pathname for renames/copies.
  }
  return { branch: run(['branch', '--show-current']) || null, dirty: records.length > 0, trackedChanges, untrackedFiles };
}

function discover(root, roots) {
  const result = summarize(inventory(root, roots));
  const files = result.files.map(record => ({
    file: slash(record.file),
    routes: record.routes,
    controlsCount: record.controlsCount,
    eventsCount: record.eventsCount,
    navigationCount: record.navigationCount,
    apiCandidatesCount: record.apiCandidatesCount,
    labelsCount: record.labelsCount,
    componentImportsCount: record.componentImportsCount,
    actionCoverage: 'UNKNOWN',
  })).sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  return {
    sha: result.sha,
    workingTree: gitState(root),
    discoveryRoots: roots,
    totals: { files: files.length, controls: files.reduce((n, f) => n + f.controlsCount, 0), events: files.reduce((n, f) => n + f.eventsCount, 0) },
    files,
  };
}

export function captureSnapshot(legacy, root = targetRoot) {
  const sourceRoot = realpathSync(resolve(legacy));
  if (sourceRoot === realpathSync(root)) throw new Error('Legacy and target must be separate checkouts.');
  const source = discover(sourceRoot, ['app', 'pages', 'dashboards', 'components']);
  const target = discover(root, ['apps/web/src']);
  const sourceRoutes = 'app/AppRouteTree.tsx';
  const targetRoutes = 'apps/web/src/app/App.tsx';
  return {
    schemaVersion: 1,
    kind: 'STATIC_DISCOVERY_NOT_PARITY_CERTIFICATION',
    capturedAtUtc: new Date().toISOString(),
    evidence: { runtime: 'UNKNOWN', visual: 'UNKNOWN', persistence: 'UNKNOWN', roleAuthorization: 'UNKNOWN', functionalParity: 'UNKNOWN' },
    limitations: [
      'Counts are syntax candidates, not completed actions or exhaustive product coverage.',
      'Dynamic routes, conditional menus, component reuse and indirect APIs require manual tracing.',
      'Matching route strings do not establish equivalent behavior, permission or appearance.',
      'Working-tree content is inspected; SHAs alone do not identify dirty files.',
      'No network, provider, browser, database or environment-file inspection was performed.',
    ],
    source,
    target,
    explicitRouteComparison: {
      sourceFile: sourceRoutes,
      targetFile: targetRoutes,
      status: 'UNKNOWN',
      ...compareRoutes(extractRoutePaths(readFileSync(resolve(sourceRoot, sourceRoutes), 'utf8')), extractRoutePaths(readFileSync(resolve(root, targetRoutes), 'utf8'))),
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArguments(process.argv.slice(2));
    // Reject invalid destinations before any discovery or write.
    const output = args.output ? allowedOutputPath(args.output) : null;
    const snapshot = captureSnapshot(args.legacy);
    const json = `${JSON.stringify(snapshot, null, 2)}\n`;
    if (output) {
      mkdirSync(dirname(output), { recursive: true });
      writeFileSync(output, json, 'utf8');
      process.stdout.write(JSON.stringify({ output: slash(relative(targetRoot, output)), sourceSha: snapshot.source.sha, targetSha: snapshot.target.sha, sourceFiles: snapshot.source.totals.files, targetFiles: snapshot.target.totals.files, runtime: 'UNKNOWN', visual: 'UNKNOWN' }) + '\n');
    } else process.stdout.write(json);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}
