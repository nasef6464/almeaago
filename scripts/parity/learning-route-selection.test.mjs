import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const ts = require('typescript');
const source = new URL('../../apps/web/src/features/learning/pages/learningRouteSelection.ts', import.meta.url);

function moduleUnderTest() {
  const module = { exports: {} };
  const javascript = ts.transpileModule(readFileSync(source, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('module', 'exports', javascript)(module, module.exports);
  return module.exports;
}

test('resolves original category stage and subject links without dropping the path', () => {
  const { parseLearningRoute } = moduleUnderTest();
  const selection = parseLearningRoute('quant', new URLSearchParams('level=first&subject=math&tab=courses'));
  assert.deepEqual(selection, { pathId: 'quant', levelId: 'first', subjectId: 'math', tab: 'courses' });
});

test('supports original subjectId alias and maps mock exam route to exams tab', () => {
  const { parseLearningRoute } = moduleUnderTest();
  const selection = parseLearningRoute('', new URLSearchParams('pathId=capacity&subjectId=verbal&tab=mock-exams'));
  assert.deepEqual(selection, { pathId: 'capacity', levelId: '', subjectId: 'verbal', tab: 'exams' });
});

test('limits material options to the selected stage in original navigation', () => {
  const { subjectsForSelection } = moduleUnderTest();
  const subjects = [
    { id: 'math', pathId: 'q', levelId: 'first' },
    { id: 'science', pathId: 'q', levelId: 'second' },
    { id: 'verbal', pathId: 'q' },
    { id: 'other', pathId: 't', levelId: 'first' },
  ];
  assert.deepEqual(subjectsForSelection(subjects, 'q', 'first').map((subject) => subject.id), ['math']);
  assert.deepEqual(subjectsForSelection(subjects, 'q', '').map((subject) => subject.id), ['math', 'science', 'verbal']);
});
