/**
 * Read-only top-level HTTP mount inventory, NOT a list of actual endpoints.
 * This intentionally avoids declaring behavioral equivalence from matching names.
 *
 * Usage:
 *   node scripts/parity/api-mount-inventory.mjs
 *   node scripts/parity/api-mount-inventory.mjs --legacy-source ../almeaacodax/server/src/routes/index.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function extractMounts(source, framework) {
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const pattern = framework === 'express'
    ? /\bapiRouter\.use\s*\(\s*(['"])([^'"]+)\1\s*,\s*([A-Za-z_$][\w$]*)/g
    : framework === 'chi'
      ? /\brouter\.Mount\s*\(\s*(['"])([^'"]+)\1\s*,\s*(deps\.[A-Za-z_$][\w$]*)/g
      : null;
  if (!pattern) throw new TypeError(`Unsupported routing framework: ${framework}`);
  return [...clean.matchAll(pattern)].map((match) => ({
    prefix: framework === 'express' ? `/api${match[2] === '/' ? '' : match[2]}` : match[2],
    owner: match[3],
  }));
}

export function compareMounts(legacy, target) {
  const oldPaths = new Set(legacy.map((entry) => entry.prefix));
  const newPaths = new Set(target.map((entry) => entry.prefix));
  return {
    legacyMounts: legacy.length,
    targetMounts: target.length,
    legacyUniquePrefixes: oldPaths.size,
    targetUniquePrefixes: newPaths.size,
    sharedExactPrefixes: [...oldPaths].filter((prefix) => newPaths.has(prefix)).sort(),
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
    const snapshot = JSON.parse(readFileSync(new URL('../../docs/migration/baselines/2026-10-28-node-api-mounts.json', import.meta.url), 'utf8'));
    const legacy = legacyFile ? extractMounts(readFileSync(legacyFile, 'utf8'), 'express') : snapshot.mounts;
    const go = extractMounts(readFileSync(new URL('../../internal/platform/httpserver/server.go', import.meta.url), 'utf8'), 'chi');
    process.stdout.write(`${JSON.stringify({
      source: legacyFile || `${snapshot.sourceRepo}@${snapshot.sourceSha}:${snapshot.sourceFile}`,
      target: 'internal/platform/httpserver/server.go',
      ...compareMounts(legacy, go),
      legacyRegistrations: legacy,
      targetRegistrations: go,
    }, null, 2)}\n`);
  }
}
