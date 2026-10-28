/** Static discovery only. Never certifies visual, role or functional parity. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export function inspect(source) {
  const matches = pattern => [...source.matchAll(pattern)].map(m => ({ value:m[1], line:source.slice(0,m.index).split('\n').length }));
  return {
    routes: matches(/<Route\b[^>]*?\bpath\s*=\s*["']([^"']+)["']/gs),
    navigation: matches(/\b(?:to|href)\s*=\s*["']([^"']+)["']/g),
    events: matches(/\b(on[A-Z]\w*)\s*=/g),
    controls: matches(/<(button|input|select|textarea|form|dialog)\b/g),
    apiCandidates: matches(/\b((?:api|\w+Client)\.\w+)\s*\(/g),
    labels: matches(/\b(?:aria-label|role)\s*=\s*["']([^"']+)["']/g),
    componentImports: matches(/from\s+["']([^"']+)["']/g),
    status:'UNKNOWN', role:'UNKNOWN', visualEvidence:[],
    remaining:['Resolve dynamic routes/menus/guards and component call graph','Trace each action to HTTP, Go and PostgreSQL','Inspect success/error/loading/empty states','Capture equivalent role/data/viewport screenshots'],
  };
}
export function inventory(root, roots) {
 const files=[];
 function walk(dir) { for(const entry of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) { const path=resolve(dir,entry.name); if(entry.isDirectory()) walk(path); else if(/\.(?:tsx|jsx)$/.test(entry.name)) files.push(path); } }
 for(const dir of roots) if(statSync(resolve(root,dir),{throwIfNoEntry:false})) walk(resolve(root,dir));
 return {sha:execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),files:files.map(file=>({file:relative(root,file),...inspect(readFileSync(file,'utf8'))}))};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const legacy=process.argv[2]; if(!legacy) throw Error('Explicit read-only Legacy checkout required');
 const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
 process.stdout.write(JSON.stringify({kind:'STATIC_DISCOVERY_NOT_PARITY_CERTIFICATION',legacy:inventory(resolve(legacy),['app','pages','dashboards','components']),target:inventory(root,['apps/web/src'])},null,2)+'\n');
}
