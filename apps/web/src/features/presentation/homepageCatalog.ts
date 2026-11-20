import {useEffect,useState} from 'react';
import {contentClient} from '../content/api/content-client';
import type {PageResult,CourseSummary,LessonSummary,TaxonomyPath,TaxonomySubject} from '../content/api/content-types';
type Catalog={paths:(TaxonomyPath&{isActive?:boolean})[];subjects:TaxonomySubject[];courses:(CourseSummary&{isPackage?:boolean;description?:string;category?:string})[];lessons:(LessonSummary&{content?:string;showOnPlatform?:boolean;approvalStatus?:string})[];announcementAds:{isActive:boolean}[];catalogError:string|null;catalogLoading:boolean};
async function all<T>(read:(page:number)=>Promise<PageResult<T>>):Promise<T[]>{
  const result:T[]=[];
  const MAX_HOMEPAGE_PAGES = 5; // Safe cap: max 500 items preload
  for(let page=1;page<=MAX_HOMEPAGE_PAGES;page++){
    const batch=await read(page);
    result.push(...batch.items);
    if(!batch.hasMore || batch.items.length === 0) return result;
  }
  return result;
}
export function useHomepageCatalog(){const [catalog,setCatalog]=useState<Catalog>({paths:[],subjects:[],courses:[],lessons:[],announcementAds:[],catalogError:null,catalogLoading:true});useEffect(()=>{const c=new AbortController();Promise.all([contentClient.taxonomyCore(c.signal),all(p=>contentClient.courses({page:p,limit:100},c.signal)),all(p=>contentClient.lessons({page:p,limit:100},c.signal))]).then(([taxonomy,courses,lessons])=>{if(!c.signal.aborted)setCatalog({paths:taxonomy.paths,subjects:taxonomy.subjects,courses,lessons:lessons.map(l=>({...l,showOnPlatform:l.isVisible,approvalStatus:l.workflowStatus})),announcementAds:[],catalogError:null,catalogLoading:false});}).catch(()=>{if(!c.signal.aborted)setCatalog(v=>({...v,catalogLoading:false,catalogError:'تعذر تحميل كتالوج المحتوى. أعد تحميل الصفحة قبل الحفظ.'}));});return()=>c.abort();},[]);return catalog;}
