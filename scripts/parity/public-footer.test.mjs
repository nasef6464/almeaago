import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(new URL('../../apps/web/package.json',import.meta.url));
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {MemoryRouter}=require('react-router-dom');
const file=new URL('../../apps/web/src/features/public/components/LegacySiteFooter.tsx',import.meta.url);
function load(source) {
 const output=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,esModuleInterop:true,module:ts.ModuleKind.CommonJS}}).outputText;
 const module={exports:{}};
 new Function('require','module','exports',output)(require,module,module.exports);
 return module.exports.LegacySiteFooter;
}
function render(component){return renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(component)));}
test('shared footer renders exact approved source markup and routes',()=>{
 assert.ok(existsSync(file),'Shared source footer component must exist');
 const source=readFileSync(new URL('../../docs/migration/baselines/legacy-public-footer.tsx.txt',import.meta.url),'utf8');
 assert.equal(render(load(readFileSync(file,'utf8'))),render(load(source)));
});
test('shared footer scope matches public routes including trailing slash',()=>{
 const source=readFileSync(file,'utf8');
 const output=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,esModuleInterop:true,module:ts.ModuleKind.CommonJS}}).outputText;
 const module={exports:{}};new Function('require','module','exports',output)(require,module,module.exports);
 assert.equal(typeof module.exports.showPublicFooter,'function');
 for(const path of ['/','/about','/about/','/faq/','/privacy/','/terms/','/contact/','/login/','/signup/','/forgot-password/','/reset-password/']) assert.equal(module.exports.showPublicFooter(path),true,path);
 // All these pages are children of Legacy AppRouteTree's MainLayout, which renders the same footer.
 for(const path of ['/verify-email','/verify-email/','/checkout','/checkout/','/category/quant','/category/quant/','/course/course-123','/course/course-123/']) assert.equal(module.exports.showPublicFooter(path),true,path);
 for(const path of ['/admin-dashboard','/classroom/x/projector','/course','/category','/about-more','/course/x/lesson']) assert.equal(module.exports.showPublicFooter(path),false,path);
});
