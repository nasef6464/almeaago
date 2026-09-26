export interface SchoolContext{
  schoolId:string;
  schoolName:string;
  role:'student'|'teacher'|'supervisor'|'school_admin'|'parent';
  permissions:string[];
  source:string;
}
export interface SchoolClass{id:string;schoolId:string;code:string;name:string;status:string}
export interface RosterMember{userId:string;name:string;email:string;status:string;roles:string[];classIds:string[]}
const BASE=(import.meta.env.VITE_API_BASE_URL??'').replace(/\/$/,'');
async function request<T>(path:string,init:RequestInit={}):Promise<T>{
  const r=await fetch(BASE+path,{...init,credentials:'include',headers:{Accept:'application/json',...init.headers}});
  if(!r.ok){const b=await r.json().catch(()=>({message:'تعذر تنفيذ الطلب'}));throw new Error(b.message||'تعذر تنفيذ الطلب')}
  return r.json() as Promise<T>;
}
export const organizationsClient={
  contexts(signal?:AbortSignal){return request<{contexts:SchoolContext[]}>('/api/v1/schools/context',{signal})},
  classes(schoolId:string,signal?:AbortSignal){
    return request<{classes:SchoolClass[];pagination:{page:number;limit:number;total:number;totalPages:number}}>(
      `/api/v1/schools/${encodeURIComponent(schoolId)}/classes?page=1&limit=100&status=active`,{signal});
  },
  students(schoolId:string,classId:string,signal?:AbortSignal){
    const p=new URLSearchParams({page:'1',limit:'100',role:'student',isActive:'true',classId});
    return request<{members:RosterMember[];pagination:{page:number;limit:number;total:number;totalPages:number}}>(
      `/api/v1/schools/${encodeURIComponent(schoolId)}/roster?${p.toString()}`,{signal});
  },
};
