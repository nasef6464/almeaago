/**
 * Read-only inventory for explicit React Router path declarations.
 * It does not infer redirects, behavioral parity, conditional routes, or API equivalence.
 *
 * Usage:
 *   node scripts/parity/route-inventory.mjs
 *   node scripts/parity/route-inventory.mjs --legacy-source ../almeaacodax/app/AppRouteTree.tsx
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function extractRoutePaths(source) {
  const found = [...source.matchAll(/<Route\b[^>]*?\bpath\s*=\s*"([^"]+)"/gs)].map((match) => match[1]);
  return [...new Set(found)];
}

export function compareRoutes(legacyRoutes, targetRoutes) {
  const legacy = new Set(legacyRoutes);
  const target = new Set(targetRoutes);
  return {
    legacyCount: legacy.size,
    targetCount: target.size,
    sharedCount: [...legacy].filter((path) => target.has(path)).length,
    legacyOnly: [...legacy].filter((path) => !target.has(path)).sort(),
    targetOnly: [...target].filter((path) => !legacy.has(path)).sort(),
  };
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === thisFile) {
  const index = process.argv.indexOf('--legacy-source');
  if (index >= 0 && !process.argv[index + 1]) {
    process.stderr.write('Missing --legacy-source argument\n');
    process.exitCode = 2;
  } else {
    const legacyFile = index >= 0 ? resolve(process.argv[index + 1]) : null;
    const snapshot = JSON.parse(readFileSync(new URL('../../docs/migration/baselines/2026-10-28-node-explicit-routes.json', import.meta.url), 'utf8'));
    const legacyRoutes = legacyFile ? extractRoutePaths(readFileSync(legacyFile, 'utf8')) : snapshot.paths;
    const targetFile = new URL('../../apps/web/src/app/App.tsx', import.meta.url);
    const targetRoutes = extractRoutePaths(readFileSync(targetFile, 'utf8'));
    process.stdout.write(`${JSON.stringify({
      source: legacyFile || `${snapshot.sourceRepo}@${snapshot.sourceSha}:${snapshot.sourceFile}`,
      target: 'apps/web/src/app/App.tsx',
      ...compareRoutes(legacyRoutes, targetRoutes),
    }, null, 2)}\n`);
  }
}
