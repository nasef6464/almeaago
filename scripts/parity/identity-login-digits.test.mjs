import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  identifyLoginInput,
  normalizeArabicIndicDigits,
} from '../../apps/web/src/features/auth/utils/identify-login-input.ts';

test('matches Legacy Arabic-Indic digit normalization without modifying other characters', () => {
  assert.equal(normalizeArabicIndicDigits('٠١٢٣٤٥٦٧٨٩'), '0123456789');
  assert.equal(normalizeArabicIndicDigits('1٢3٤5٦7٨9٠'), '1234567890');
  assert.equal(normalizeArabicIndicDigits('test@example.com'), 'test@example.com');
});

test('recognizes Arabic-Indic national IDs and phone numbers in smart login', () => {
  assert.equal(identifyLoginInput('١٢٣٤٥٦٧٨٩٠'), 'nationalId');
  assert.equal(identifyLoginInput('  ٢٣٤٥٦٧٨٩٠١  '), 'nationalId');
  assert.equal(identifyLoginInput('٠٥٥١٢٣٤٥٦٧'), 'phone');
  assert.equal(identifyLoginInput('someone@example.com'), 'email');
  assert.equal(identifyLoginInput('٣٢٣٤٥٦٧٨٩٠'), 'phone');
});
