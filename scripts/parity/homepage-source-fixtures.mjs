// Optional source characterization tool. Provide a scratch directory containing
// exact source dependencies; it never installs packages or writes Legacy.
// node scripts/parity/homepage-source-fixtures.mjs /path/to/probe/node_modules
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(new URL('../../apps/web/package.json',import.meta.url));
const ts=require('typescript');
if(!process.argv[2])throw Error('Pass source dependency node_modules directory (mongoose8.24.3, zod4.6.7)');
const sourceRequire=createRequire(resolve(process.argv[2],'../package.json'));
for(const [name,version]of [['mongoose','8.24.3'],['zod','4.6.7']]){
 if(sourceRequire(`${name}/package.json`).version!==version)throw Error(`Use pinned source ${name}@${version}`);
}
const load=(name)=>{
 const input=readFileSync(new URL(`../../docs/migration/baselines/${name}`,import.meta.url),'utf8');
 const mod={exports:{}};
 const resolver=id=>id.includes('dbGrowthBudgets')?{DB_GROWTH_BUDGETS:{inlineAdminMediaChars:1500000}}:sourceRequire(id);
 new Function('require','module','exports',ts.transpileModule(input,{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText)(resolver,mod,mod.exports);
 return mod.exports;
};
const {homepageSettingsSchema}=load('legacy-homepage-presentation-schemas.ts.txt');
const {HomepageSettingsModel:Model}=load('legacy-homepage-model.ts.txt');
const {defaultHomepageSettings}=load('legacy-homepage-presentation-defaults.ts.txt');
const clean=doc=>{
 const {_id,__v,createdAt,updatedAt,...rest}=doc.toObject();return rest;
};
const defaults=clean(new Model(defaultHomepageSettings));
const inputs=[{},null,
 {key:'ignored',brand:{logoText:'هوية',unknown:'strip'}},
 {brand:{}},
 {hero:{titlePrefix:'',autoRotateImages:false,rotateIntervalSeconds:3}},
 {hero:{rotateIntervalSeconds:60,galleryImages:['/a.png','/b.png']}},
 {navigation:{showAutoPaths:false,moreLabel:'',items:[{id:'home',visible:false,order:0},{id:'x',order:-2}]}},
 {navigation:{}},{typography:{}},
 {sections:{featuredArticlesTitle:'عنوان'}},
 {stats:[{id:'a',label:'طلاب'}]},
 {stats:[],testimonials:[],featuredPathIds:[],featuredCourseIds:[],featuredArticleLessonIds:[]},
 {testimonials:[{id:'t',name:'اسم',text:'نص'}]},
 {studentExperience:{visibilityMode:'enrolled',promptEnrollment:false}},
 {studentExperience:{visibilityMode:'enrolled'}},
 {hero:null},{hero:{autoRotateImages:'false'}},{hero:{rotateIntervalSeconds:2}},
 {hero:{rotateIntervalSeconds:61}},{typography:{bodyFont:'cairo'}},
 {navigation:{items:[{visible:true}]}},{featuredPathIds:[42]},
 {featuredPathIds:['legacy-id','legacy-id']},
 {stats:[{id:'',label:'x'}]},{testimonials:[{id:'a',name:'x'}]},
];
const cases=inputs.map(input=>{
 const result=homepageSettingsSchema.safeParse(input);
 if(!result.success)return {input,valid:false};
 const parsed=result.data;
 return {input,valid:true,parsed,persisted:clean(new Model({...defaults,...parsed}))};
});
const output={legacySHA:'bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7',mongoose:'8.24.3',zod:'4.6.7',scope:'Zod parsing and Mongoose document casting/defaults without MongoDB; NOT findOneAndUpdate or full Legacy runtime proof',defaults,cases};
writeFileSync(new URL('../../internal/content/domain/homepage_source_fixtures.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(`Generated ${cases.length} source cases; model casting only, no MongoDB writes.`);
