import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const output=new URL('../../apps/web/tests/reference/generated/',import.meta.url);mkdirSync(output,{recursive:true});
let source=readFileSync(new URL('../../docs/migration/baselines/legacy-HomepageManager.tsx.txt',import.meta.url),'utf8');
source=source.replace("from '../../services/api'","from '../homepage-api-adapter'").replace("from '../../contexts/AuthContext'","from '../auth-adapter'").replace("from '../../store/useStore'","from '../homepage-store-adapter'").replace("from '../../types'","from '../../../src/features/presentation/homepage-types'").replace("from '../../utils/sanitizeMojibakeArabic'","from '../../../src/features/presentation/homepageSanitizer'").replace("from './components/StudentExperienceSettings'","from '../../../src/features/presentation/StudentExperienceSettings'").replace("from '../../utils/defaultAvatar'","from '../../../src/features/presentation/defaultAvatar'").replace("NonNullable<HomepageSettings['navigation']>['items'][number]","NonNullable<NonNullable<HomepageSettings['navigation']>['items']>[number]");
writeFileSync(new URL('HomepageManager.tsx',output),source);
// Isolate each bounded JSX section from the real original and restored files,
// retaining their hooks/handlers/imports. Equal document coordinates prevent
// unrelated unavailable controls from changing the rasterization origin.
const target=readFileSync(new URL('../../apps/web/src/features/presentation/HomepageManager.tsx',import.meta.url),'utf8');
for(const [variant,code] of [['source',source],['go',target]])for(const id of ['brand','hero']){
 const sectionStart=code.indexOf(`<section id="${id}-section"`);const sectionEnd=code.indexOf('</section>',sectionStart)+10;
 const rootStart=code.indexOf('    return (\n        <div className="space-y-6 animate-fade-in">');const rootEnd=code.indexOf('\n};\n\nconst HeroLivePreview',rootStart);
 if(sectionStart<0||rootStart<0||rootEnd<0)throw Error('original editor section boundaries changed');
 let isolated=code.slice(0,rootStart)+'    return ('+code.slice(sectionStart,sectionEnd)+');'+code.slice(rootEnd);
 if(variant==='go') isolated=isolated.replaceAll("from './", "from '../../../src/features/presentation/").replace("from '../auth/state/AuthProvider'","from '../../../src/features/auth/state/AuthProvider'");
 writeFileSync(new URL(`Homepage-${variant}-${id}.tsx`,output),isolated);
}
