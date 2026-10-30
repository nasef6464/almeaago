import {useEffect,useState} from 'react';
import type {MockSummary} from './destination-model';
export type PublicArticleMetadata={id:string;title:string;description:string;pathId?:string;subjectId?:string;type:string;approvedAt?:number;approvalStatus?:string;showOnPlatform?:boolean};
const BASE=String(import.meta.env?.VITE_API_BASE_URL||'').replace(/\/$/,'');
async function get<T>(path:string,signal:AbortSignal):Promise<T>{const response=await fetch(BASE+path,{signal,headers:{Accept:'application/json'},credentials:'omit'});if(!response.ok)throw Error('تعذر تحميل المحتوى المنشور.');return response.json();}
function usePublicList<T>(load:(signal:AbortSignal)=>Promise<T[]>){
 const [items,setItems]=useState<T[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [revision,setRevision]=useState(0);
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');load(controller.signal).then(rows=>{if(!controller.signal.aborted)setItems(rows)}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'تعذر تحميل المحتوى المنشور.')}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[load,revision]);
 return {items,loading,error,reload:()=>setRevision(x=>x+1)};
}
export const loadMocks=async(signal:AbortSignal):Promise<MockSummary[]>=>{
 const payload=await get<unknown>('/api/v1/public/mock-exams',signal);
 if(!payload || typeof payload!=='object' || !('mocks' in payload) || !Array.isArray(payload.mocks)){
  throw Error('تعذر قراءة بيانات المحاكيات.');
 }
 return payload.mocks as MockSummary[];
};
export const loadArticles=async(signal:AbortSignal):Promise<PublicArticleMetadata[]>=>{
 const items:PublicArticleMetadata[]=[];
 for(let page=1;;page++){
  const payload=await get<unknown>(`/api/v1/public/articles?page=${page}&limit=100`,signal);
  if(!payload || typeof payload!=='object' || !('items' in payload) || !Array.isArray(payload.items) || !('hasMore' in payload) || typeof payload.hasMore!=='boolean' || (payload.hasMore && payload.items.length===0)){
   throw Error('تعذر قراءة بيانات المقالات.');
  }
  items.push(...payload.items as PublicArticleMetadata[]);
  if(!payload.hasMore)return items;
 }
};
export const usePublicMocks=()=>usePublicList(loadMocks);
export const usePublicArticles=()=>usePublicList(loadArticles);
