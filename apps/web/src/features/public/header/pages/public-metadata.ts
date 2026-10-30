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
export const loadMocks=async(signal:AbortSignal)=>(await get<{mocks:MockSummary[]}>('/api/v1/public/mock-exams',signal)).mocks;
export const loadArticles=async(signal:AbortSignal)=>{const items:PublicArticleMetadata[]=[];for(let page=1;;page++){const result=await get<{items:PublicArticleMetadata[];hasMore:boolean}>(`/api/v1/public/articles?page=${page}&limit=100`,signal);items.push(...result.items);if(!result.hasMore)return items;}};
export const usePublicMocks=()=>usePublicList(loadMocks);
export const usePublicArticles=()=>usePublicList(loadArticles);
