// Build a test-only runtime of the pinned original component. No production
// route is added and no source repository file is modified.
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const output=new URL('../../apps/web/tests/reference/generated/',import.meta.url);
mkdirSync(output,{recursive:true});
const baseline=name=>readFileSync(new URL(`../../docs/migration/baselines/legacy-${name}.txt`,import.meta.url),'utf8');
let manager=baseline('PlatformFontsManager.tsx');
manager=manager.replace("from '../../services/api'","from '../api-adapter'")
 .replace("from '../../contexts/AuthContext'","from '../auth-adapter'")
 .replace("from '../../components/PlatformFontBootstrap'","from '../../../src/features/presentation/PlatformFontBootstrap'")
 .replace("from '../../types'","from '../../../src/features/presentation/types'")
 .replace("from '../../utils/platformFonts'","from './platformFonts'");
writeFileSync(new URL('PlatformFontsManager.tsx',output),manager);
writeFileSync(new URL('platformFonts.ts',output),baseline('platformFonts.ts').replace("from '../types'","from '../../../src/features/presentation/types'"));
