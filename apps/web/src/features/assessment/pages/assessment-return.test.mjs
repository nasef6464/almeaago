import test from 'node:test';import assert from 'node:assert/strict';
import {safeAssessmentReturn,assessmentResultsHref} from './assessment-return.ts';
const query=(returnTo,source='mock-exam')=>'?' + new URLSearchParams({returnTo,source});
test('standalone mock return preserves canonical category path, selected scope and mock tab',()=>{const target='/category/12345678-1234-1234-1234-123456789abc?tab=mock-exams&level=l1&subject=s1';assert.equal(safeAssessmentReturn(query(target)),target);assert.equal(safeAssessmentReturn(query('/category/qudrat?tab=mock-exams')),'/category/qudrat?tab=mock-exams')});
test('external, scheme relative, encoded escape and control routes never become return links',()=>{for(const target of ['https://evil.example/category/p?tab=mock-exams','//evil.example/category/p?tab=mock-exams','/\\evil.example?tab=mock-exams','/category/%2f%2fevil.example?tab=mock-exams','/category/%5cp?tab=mock-exams','/category/p?tab=mock-exams%0a','/category/p?tab=mock-exams&subject=%0d%0a','/category/p?tab=mock-exams#foreign','/category/../category/p?tab=mock-exams'])assert.equal(safeAssessmentReturn(query(target)),null,target)});
test('other journey sources and missing/ambiguous mock destinations preserve existing navigation',()=>{for(const q of ['',query('/assessment-results'),query('/category/p?tab=courses'),query('/category/p?tab=mock-exams','course'),query('/category/p?tab=mock-exams')+'&returnTo=/category/q?tab=mock-exams',query('/category/p?tab=mock-exams&tab=courses')])assert.equal(safeAssessmentReturn(q),null,q)});

test('attempt completion to review to history preserves only validated mock context',()=>{
 const target='/category/canonical-path?tab=mock-exams&level=level-1&subject=subject-1';const search=query(target);
 const review=assessmentResultsHref('attempt/id',search);assert.match(review,/^\/assessment-results\/attempt%2Fid\?/);assert.equal(safeAssessmentReturn(review.slice(review.indexOf('?'))),target);
 const history=assessmentResultsHref(undefined,review.slice(review.indexOf('?')));assert.match(history,/^\/assessment-results\?/);assert.equal(safeAssessmentReturn(history.slice(history.indexOf('?'))),target);
 assert.equal(assessmentResultsHref('other',query('https://evil.example')),'/assessment-results/other');assert.equal(assessmentResultsHref(undefined,''),'/assessment-results');
});
