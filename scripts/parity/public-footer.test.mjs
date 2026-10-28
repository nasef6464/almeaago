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
