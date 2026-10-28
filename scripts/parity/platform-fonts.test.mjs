import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../apps/web/package.json',import.meta.url));
const ts=require('typescript');
function load(source, resolve=require){const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,esModuleInterop:true,module:ts.ModuleKind.CommonJS}}).outputText)(resolve,mod,mod.exports);return mod.exports;}
test('source font normalization retained, including cleared overrides and four independent targets',()=>{
 const file=new URL('../../apps/web/src/features/presentation/platformFonts.ts',import.meta.url);
 assert.ok(existsSync(file),'persisted source font implementation missing');
 const original=load(readFileSync(new URL('../../docs/migration/baselines/legacy-platformFonts.ts.txt',import.meta.url),'utf8'));
 const restored=load(readFileSync(file,'utf8'));
 for(const input of [undefined,{}, {bodyFont:'cairo',headingFont:'system',navigationSize:'14px',buttonWeight:'700',bodyColor:'#abcdef'}, {bodySize:'99.9rem',headingSize:'100px',bodyWeight:'100',bodyColor:'red'}, {bodyColor:'',bodyCustomFont:{name:'Example',dataUrl:'data:font/woff2;base64,AAAA'}}]) {
  assert.deepEqual(restored.normalizePlatformFontSettings(input),original.normalizePlatformFontSettings(input));
 }
 assert.deepEqual(restored.PLATFORM_FONT_OPTIONS,original.PLATFORM_FONT_OPTIONS);
});

const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
test('restored editor renders complete source markup for loaded and loading states',()=>{
 const source=readFileSync(new URL('../../docs/migration/baselines/legacy-PlatformFontsManager.tsx.txt',import.meta.url),'utf8');
 const target=readFileSync(new URL('../../apps/web/src/features/presentation/PlatformFontsManager.tsx',import.meta.url),'utf8');
 const fonts=load(readFileSync(new URL('../../apps/web/src/features/presentation/platformFonts.ts',import.meta.url),'utf8'));
 for(const loading of [false,true]) {
  const hooks={...React,useEffect:()=>{},useMemo:fn=>fn(),useState:value=>[value===true?loading:value,()=>{}]};
  const resolve=id=>{
   if(id==='react')return hooks;
   if(id.endsWith('types'))return {};
   if(id.endsWith('api'))return {api:{}};
   if(id.endsWith('AuthContext')||id.endsWith('AuthProvider'))return {useAuth:()=>({user:{roles:['admin']},logout:()=>{},signOut:()=>{},getCsrfToken:()=>{}})};
   if(id.endsWith('PlatformFontBootstrap'))return {PLATFORM_FONT_SETTINGS_UPDATED:'platform-font-settings-updated'};
   if(id.endsWith('platformFonts'))return fonts;
   return require(id);
  };
  const render=code=>renderToStaticMarkup(React.createElement(load(code,resolve).PlatformFontsManager));
  assert.equal(render(target),render(source));
 }
});
test('custom font CSS escapes names so an uploaded name cannot inject declarations',()=>{
 const nodes=new Map();
 const properties=new Map();
 globalThis.document={getElementById:id=>nodes.get(id),createElement:()=>({}),head:{appendChild:node=>nodes.set(node.id,node)},documentElement:{style:{setProperty:(name,value)=>properties.set(name,value)}}};
 try {
  const fonts=load(readFileSync(new URL('../../apps/web/src/features/presentation/platformFonts.ts',import.meta.url),'utf8'));
  fonts.applyPlatformFontSettings({bodyFont:'custom',bodyCustomFont:{name:"A';color:red;/*",dataUrl:'data:font/woff2;base64,AAAA',mimeType:'font/woff2'}});
  assert.ok(nodes.get('platform-custom-font-style').textContent.includes("A\\27 ;color:red;/*"));
  assert.ok(properties.get('--platform-font-body').includes('\\27 '));
 } finally {delete globalThis.document;}
});

test('original font tab URLs retain source hash priority and direct Go compatibility',()=>{
 const file=new URL('../../apps/web/src/features/presentation/navigation.ts',import.meta.url);
 assert.ok(existsSync(file),'original font tab navigation adapter missing');
 const {isPlatformFontsLocation:matches}=load(readFileSync(file,'utf8'));
 for(const [pathname,search,hash,want] of [
  ['/admin-dashboard','?tab=platform-fonts','',true],
  ['/admin-dashboard/','','#/admin-dashboard?tab=platform-fonts',true],
  ['/admin-dashboard','?tab=paths','#/admin-dashboard?tab=platform-fonts',true],
  ['/admin-dashboard','?tab=platform-fonts','#/admin-dashboard?tab=paths',false],
  ['/admin-dashboard/platform-fonts','','',true],
  ['/about','','#/admin-dashboard?tab=platform-fonts',false],
 ]) assert.equal(matches({pathname,search,hash}),want,`${pathname}${search}${hash}`);
});
