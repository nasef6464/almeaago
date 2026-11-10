import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChalkboardSteps } from './chalkboardParser';

test('parseChalkboardSteps parses Arabic multi-step solution into ordered blackboard scenes', () => {
  const explanation = `
  أولاً: نحدد المعطيات في المسألة: $x + y = 10$.
  ثانياً: نطرح y من الطرفين للحصول على $x = 10 - y$.
  النتيجة النهائية: $x = 7$.
  `;
  const steps = parseChalkboardSteps(explanation);
  assert.ok(steps.length >= 3, `expected at least 3 steps, got ${steps.length}`);
  assert.ok(steps[0].title.includes('المعطيات') || steps[0].title.includes('أولاً'));
  assert.ok(steps[steps.length - 1].title.includes('النتيجة'));
});

test('parseChalkboardSteps extracts embedded KaTeX formulas into latex field', () => {
  const explanation = 'نطبق قانون فيثاغورس: $a^2 + b^2 = c^2$ ومنها $c = \\sqrt{25} = 5$.';
  const steps = parseChalkboardSteps(explanation);
  assert.ok(steps.length >= 1);
  assert.ok(steps.some((s) => s.latex && s.latex.includes('a^2')));
});
