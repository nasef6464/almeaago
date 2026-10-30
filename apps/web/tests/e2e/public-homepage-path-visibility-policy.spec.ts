import { expect, test } from '@playwright/test';

import { selectHomepagePaths } from '../../src/features/public/homepagePathVisibility';

/**
 * Pure source-policy regression tests. These prove the shared selection
 * function only; the six existing RED browser tests must still pass after
 * the #166 owner connects this function to PublicLandingPage and the
 * taxonomy owner projects showInHome/isActive from Go/PostgreSQL.
 */
const paths = [
  { id: 'first', name: 'الأول', showInHome: true, isActive: true },
  { id: 'hidden', name: 'مخفي', showInHome: false, isActive: true },
  { id: 'inactive', name: 'غير نشط', showInHome: true, isActive: false },
  { id: 'second', name: 'الثاني', showInHome: true, isActive: true },
] as const;

test('visitor receives only active paths explicitly eligible for the homepage', () => {
  expect(selectHomepagePaths(paths, []).map(path => path.id)).toEqual(['first', 'second']);
});

test('hidden or inactive featured IDs never override visitor eligibility', () => {
  expect(selectHomepagePaths(paths, ['hidden', 'inactive']).map(path => path.id))
    .toEqual(['first', 'second']);
  expect(selectHomepagePaths(paths, ['hidden', 'second']).map(path => path.id))
    .toEqual(['second']);
});

test('featured selection preserves source path order rather than featured ID order', () => {
  expect(selectHomepagePaths(paths, ['second', 'first']).map(path => path.id))
    .toEqual(['first', 'second']);
});

test('privileged original roles may see inactive paths, but never showInHome=false', () => {
  expect(selectHomepagePaths(paths, ['inactive'], true).map(path => path.id))
    .toEqual(['inactive']);
  expect(selectHomepagePaths(paths, ['hidden'], true).map(path => path.id))
    .toEqual(['first', 'inactive', 'second']);
});

test('invalid path IDs and names are excluded before featured selection', () => {
  const invalid = [
    { id: '', name: 'بدون معرف', showInHome: true },
    { id: 'blank-name', name: '   ', showInHome: true },
    { id: 'valid', name: 'صحيح', showInHome: true },
  ];
  expect(selectHomepagePaths(invalid, ['blank-name']).map(path => path.id))
    .toEqual(['valid']);
  expect(selectHomepagePaths([], ['valid'])).toEqual([]);
});
