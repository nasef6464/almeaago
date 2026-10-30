import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';

const require=createRequire(new URL('../../apps/web/package.json',import.meta.url));
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {MemoryRouter}=require('react-router-dom');

const source=readFileSync(new URL('../../apps/web/src/features/public/pages/StaticInfoPage.tsx',import.meta.url),'utf8');
const mod={exports:{}};
new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText)(require,mod,mod.exports);


// Verify every source byte, not only the representative text assertions.
// The two export changes are the only permitted adapter delta.
test('the entire information-page source equals approved Legacy blob after export adaptation',()=>{
  // #240 is the canonical source-preserving component on main. Its sole
  // extra export supports existing consumers; normalize ONLY that export.
  assert.match(source,/\nexport default StaticInfoPage;\n$/);
  const canonicalSource=source.replace(/\nexport default StaticInfoPage;\n$/, '\n');
  const original=canonicalSource
    .replace('export type StaticInfoPageKind =','type StaticInfoPageKind =')
    .replace('export const StaticInfoPage: React.FC','const StaticInfoPage: React.FC')+
    'export default StaticInfoPage;\n';
  const gitBlob=createHash('sha1').update(`blob ${Buffer.byteLength(original)}\0`).update(original).digest('hex');
  assert.equal(gitBlob,'80013eb98dcddf0454a4a43f22720a91239a4248');
});

const pages=[
  ['about','من نحن','مهمتنا','ما نقدمه','نساعد الطالب على فهم مستواه'],
  ['contact','تواصل معنا','الدعم','طلبات الاشتراك','زر واتساب الظاهر في الصفحات العامة عند تفعيله'],
  ['faq','الأسئلة الشائعة','هل أحتاج حسابا للبدء؟','كيف أتابع طلب الدفع؟','يظهر في صفحة طلباتي'],
  ['privacy','سياسة الخصوصية','بيانات الحساب','بيانات التعلم','تقييد الصفحات الخاصة خلف تسجيل الدخول'],
  ['terms','الشروط والأحكام','استخدام الحساب','المحتوى والاشتراكات','المحتوى، الأسعار، أو آليات الوصول'],
];

for(const [kind,title,first,second,legacyPhrase] of pages){
  test(`original public information page ${kind} retains copy and navigation`,()=>{
    const html=renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(mod.exports.StaticInfoPage,{kind})));
    for(const phrase of [title,first,second,legacyPhrase,'العودة للرئيسية'])assert.ok(html.includes(phrase),`${kind}: missing ${phrase}`);
    assert.match(html,/href="\/"/);
    assert.match(html,/dir="rtl"/);
    assert.match(html,/mx-auto max-w-4xl px-4 py-10/);
    assert.match(html,/rounded-2xl border border-gray-100 bg-white p-6 shadow-sm/);
    assert.match(html,/mt-8 space-y-4/);
    assert.doesNotMatch(html,/min-h-\[calc\(100vh-5rem\)\]|rounded-\[2rem\]|bg-slate-50 px-4 py-8/);
  });
}
