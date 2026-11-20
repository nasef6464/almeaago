import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeImportHeader,
  normalizeArabicText,
  parseTextToRows,
  parseImportRows,
  inspectImportData,
  STUDENT_IMPORT_HEADER_ALIASES,
  canonicalizeHeader,
} from './importRowParsing';

test('normalizeImportHeader strips BOM, diacritics, and spaces', () => {
  const raw = '\uFEFF  الْبَرِيدُ الْإلِكْتُرُونِيّ  ';
  const normalized = normalizeImportHeader(raw);
  assert.equal(normalized, 'البريدالإلكتروني');
});

test('normalizeArabicText normalizes Alef forms, Ta Marbuta, and whitespace', () => {
  const raw = '  أحمد   إبراهيم  حمزة   ';
  const normalized = normalizeArabicText(raw);
  assert.equal(normalized, 'احمد ابراهيم حمزه');
});

test('canonicalizeHeader correctly matches Arabic and English aliases', () => {
  assert.equal(canonicalizeHeader('اسم الطالب', STUDENT_IMPORT_HEADER_ALIASES), 'name');
  assert.equal(canonicalizeHeader('student name', STUDENT_IMPORT_HEADER_ALIASES), 'name');
  assert.equal(canonicalizeHeader('البريد الإلكتروني', STUDENT_IMPORT_HEADER_ALIASES), 'email');
  assert.equal(canonicalizeHeader('السجل المدني', STUDENT_IMPORT_HEADER_ALIASES), 'civilId');
  assert.equal(canonicalizeHeader('الفصل', STUDENT_IMPORT_HEADER_ALIASES), 'className');
  assert.equal(canonicalizeHeader('كلمة السر', STUDENT_IMPORT_HEADER_ALIASES), 'password');
});

test('parseTextToRows parses CSV with quoted fields correctly', () => {
  const csv = 'الاسم,البريد,الفصل\n"عبدالله الشمري",abdullah@test.com,"أول ثانوي (أ)"\nسارة,sara@test.com,ثاني';
  const rows = parseTextToRows(csv);
  assert.equal(rows.length, 3);
  assert.equal(rows[1][0], 'عبدالله الشمري');
  assert.equal(rows[1][2], 'أول ثانوي (أ)');
});

test('parseTextToRows handles Noor tab-delimited exports with BOM', () => {
  const tsv = '\uFEFFاسم الطالب\tالبريد\tالصف\nمحمد\tmohd@test.com\tثالث أ';
  const rows = parseTextToRows(tsv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0][0], 'اسم الطالب');
  assert.equal(rows[1][1], 'mohd@test.com');
});

test('parseImportRows auto-generates student email from Civil ID when email is missing', () => {
  const rows = [
    ['اسم الطالب', 'السجل المدني', 'الفصل'],
    ['فهد العتيبي', '1098765432', 'أول ثانوي'],
  ];
  const parsed = parseImportRows(rows);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].name, 'فهد العتيبي');
  assert.equal(parsed[0].civilId, '1098765432');
  assert.equal(parsed[0].email, 'std-1098765432@almeaa.edu.sa');
  assert.equal(parsed[0].className, 'أول ثانوي');
});

test('inspectImportData accurately detects duplicates and unique classes', () => {
  const rows = [
    { name: 'طالب 1', email: 's1@test.com', className: 'صف أ' },
    { name: 'طالب 2', email: 's2@test.com', className: 'صف ب' },
    { name: 'طالب 3 (مكرر)', email: 's1@test.com', className: 'صف أ' },
  ];
  const stats = inspectImportData(rows);

  assert.equal(stats.totalRows, 3);
  assert.deepEqual(stats.duplicateEmails, ['s1@test.com']);
  assert.deepEqual(stats.classNames.sort(), ['صف أ', 'صف ب'].sort());
  assert.equal(stats.rowsWithoutPassword, 3);
});
