import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(new URL('../../apps/web/package.json',import.meta.url));
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {MemoryRouter}=require('react-router-dom');

function render(brand,user=null){
  const source=readFileSync(new URL('../../apps/web/src/features/public/components/LegacySiteHeader.tsx',import.meta.url),'utf8');
  const navigationSource=readFileSync(new URL('../../apps/web/src/features/public/components/headerNavigation.ts',import.meta.url),'utf8');
  const navigationModule={exports:{}};
  new Function('module','exports',ts.transpileModule(navigationSource,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(navigationModule,navigationModule.exports);
  const mod={exports:{}};
  const resolve=id=>id.endsWith('/useHomepageSettings')?{useHomepageSettings:()=>({brand})}:
    id.endsWith('/AuthProvider')?{useAuth:()=>({user})}:
    id.endsWith('/content-client')?{contentClient:{}}:
    id.endsWith('/dashboard-path')?{dashboardPathFor:()=>'/dashboard'}:
    id.endsWith('/headerNavigation')?navigationModule.exports:require(id);
  new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText)(resolve,mod,mod.exports);
  return renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(mod.exports.LegacySiteHeader,{onAuth:()=>{}})));
}

for(const user of [null,{name:'طالب',roles:['student']}]){
  test(`saved logo keeps original circular image alongside brand text for ${user?'student':'guest'}`,()=>{
    const html=render({logoUrl:' /brand.svg ',logoAlt:' شعارنا ',logoText:' أكاديمية ',logoAccentText:' التفوق '},user);
    assert.match(html,/src="\/brand.svg"/);
    assert.match(html,/alt="شعارنا"/);
    assert.match(html,/rounded-full object-contain bg-white border border-amber-100 shadow-sm shrink-0/);
    assert.match(html,/>أكاديمية<\/span>/);
    assert.match(html,/>التفوق<\/span>/);
    assert.match(html,/h-9 w-9 sm:h-11 sm:w-11/);
  });
}
test('empty or whitespace logo preserves original text brand without an image',()=>{
  const html=render({logoUrl:'   ',logoText:'اسم',logoAccentText:'مميز'});
  assert.doesNotMatch(html,/<img /);
  assert.match(html,/>اسم<\/span>/);
  assert.match(html,/>مميز<\/span>/);
});
