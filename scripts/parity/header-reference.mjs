// Original full Header, presentation unchanged. Only imports cross the Go adapter boundary.
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sourceURL=new URL('../../docs/migration/baselines/legacy-Header.tsx.txt',import.meta.url);
let source=readFileSync(sourceURL,'utf8');
if(createHash('sha1').update(`blob ${Buffer.byteLength(source)}\0`).update(source).digest('hex')!=='c4e45e5d9bd485538036e98f70eac42471a8fa71')throw Error('Pinned original Header blob changed');
const remaps={
 '../contexts/StudentExperienceContext':'../../../src/features/learning/navigation',
 '../contexts/AuthContext':'../../../src/features/public/header/authAdapter',
 '../services/api':'../source-header-api-adapter',
 '../store/useStore':'../source-header-api-adapter',
 '../types':'../../../src/features/presentation/homepage-types',
 '../utils/sanitizeMojibakeArabic':'../../../src/features/presentation/homepageSanitizer',
 './ThemeToggle':'../../../src/features/public/header/dependencies/ThemeToggle',
 './SearchModal':'../../../src/features/public/header/dependencies/SearchModal',
 './NotificationBell':'../../../src/features/public/header/dependencies/NotificationBell',
};
for(const [from,to] of Object.entries(remaps)){
 const before=`from '${from}'`;if(!source.includes(before))throw Error('Original Header import missing: '+from);
 source=source.replace(before,`from '${to}'`);
}
const output=new URL('../../apps/web/tests/reference/generated/',import.meta.url);mkdirSync(output,{recursive:true});
writeFileSync(new URL('Header.tsx',output),source);
