import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const output = new URL('../../apps/web/tests/reference/generated/', import.meta.url);
mkdirSync(output, { recursive: true });
function source(path, blob) {
  // Windows checkout CRLF is normalized exactly as Git's text blob; no source
  // expression, presentation or logic is altered by this transport normalization.
  const text = readFileSync(new URL('../../docs/migration/baselines/' + path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const actual = createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
  if (actual !== blob) throw new Error(`Legacy reference changed: ${path}: ${actual}; reconcile baseline before comparing`);
  return text;
}
let dialog = source('legacy-PathEnrollmentDialog.tsx.txt', '4d911b31027e263bfa4b3f8100108ecd7a8a0f81');
for (const [from, to] of [
  ['../../store/useStore', '../enrollment-store-adapter'],
  ['../../contexts/StudentExperienceContext', '../../../src/features/learning/navigation'],
  ['../../utils/studentPathScope', './enrollment-source-scope'],
]) {
  if (!dialog.includes(`from '${from}'`)) throw new Error('Missing original import: ' + from);
  dialog = dialog.replace(`from '${from}'`, `from '${to}'`);
}
let scope = source('legacy-studentPathScope.ts.txt', '9a1be3de879308f6245ad0db8b3047484746f122');
scope = scope.replace("from '../types'", "from '../../../src/features/learning/navigation/types'");
writeFileSync(new URL('EnrollmentSource.tsx', output), dialog);
writeFileSync(new URL('enrollment-source-scope.ts', output), scope);
console.log('Pinned legacy enrollment dialog and scope generated; presentation and source policy unchanged.');
