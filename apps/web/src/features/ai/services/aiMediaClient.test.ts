import test from 'node:test';
import assert from 'node:assert/strict';
import { phoneticArabicFromKatex } from './aiMediaClient';

test('phoneticArabicFromKatex converts fractions and powers to natural spoken Arabic words', () => {
  const raw = 'حل المعادلة: $x^2 + 5 = 9$ و الكسر $\\frac{1}{2}$';
  const spoken = phoneticArabicFromKatex(raw);
  assert.ok(!spoken.includes('\\frac'), 'should not contain raw \\frac');
  assert.ok(!spoken.includes('^2'), 'should not contain raw ^2');
  assert.ok(spoken.includes('تربيع'), 'should include تربيع');
  assert.ok(spoken.includes('نصف'), 'should include نصف');
});

test('phoneticArabicFromKatex cleans square roots and basic arithmetic signs', () => {
  const raw = 'احسب $\\sqrt{16} + 4$';
  const spoken = phoneticArabicFromKatex(raw);
  assert.ok(!spoken.includes('\\sqrt'), 'should not contain \\sqrt');
  assert.ok(spoken.includes('جذر'), 'should include جذر');
  assert.ok(spoken.includes('زائد'), 'should include زائد');
});
