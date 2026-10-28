export type TaxonomyStatus='active'|'inactive'|'archived';

export interface PathDisplayInput {showInNavbar?:boolean;showInHome?:boolean;settings?:{showMockExamCard?:boolean;stageSelection?:'auto'|'required'|'none';stageLabel?:string}}
export interface SubjectDisplayInput {icon?:string;color?:string}

export interface AdminTaxonomyPath extends PathDisplayInput{
  isActive:boolean;
  id:string;
  code:string;
  name:string;
  parentPathId?:string;
  description:string;
  sortOrder:number;
  status:TaxonomyStatus;
}
export interface AdminTaxonomyLevel{
  id:string;
  pathId:string;
  code:string;
  name:string;
  sortOrder:number;
  status:TaxonomyStatus;
}
export interface AdminTaxonomySubject extends SubjectDisplayInput{
  id:string;
  pathId:string;
  levelId?:string;
  code:string;
  name:string;
  sortOrder:number;
  status:TaxonomyStatus;
}
export interface AdminTaxonomySkill{
  id:string;
  subjectId:string;
  parentSkillId?:string;
  code:string;
  name:string;
  description:string;
  kind:'main'|'sub';
  sortOrder:number;
  status:TaxonomyStatus;
}
export interface AdminTaxonomyBootstrap{
  paths:AdminTaxonomyPath[];
  levels:AdminTaxonomyLevel[];
  subjects:AdminTaxonomySubject[];
  skills:AdminTaxonomySkill[];
}

const BASE=(import.meta.env.VITE_API_BASE_URL??'').replace(/\/$/,'');
async function request<T>(path:string,init:RequestInit={}):Promise<T>{
  const response=await fetch(BASE+path,{
    ...init,
    credentials:'include',
    headers:{Accept:'application/json',...(init.body?{'Content-Type':'application/json'}:{}),...init.headers},
  });
  if(!response.ok){
    const body=await response.json().catch(()=>({message:'تعذر تنفيذ طلب التصنيف'}));
    throw new Error(body.message||'تعذر تنفيذ طلب التصنيف');
  }
  return response.json() as Promise<T>;
}
function mutation(path:string,method:'POST'|'PATCH',body:unknown,csrf:string){
  return request<unknown>(path,{method,headers:{'X-CSRF-Token':csrf},body:JSON.stringify(body)}).then(value=>{window.dispatchEvent(new Event('almeaa:taxonomy-updated'));return value});
}

export const taxonomyAdminClient={
  bootstrap(signal?:AbortSignal){return request<AdminTaxonomyBootstrap>('/api/v1/taxonomy/admin/bootstrap',{signal})},
  createPath(input:PathDisplayInput & {code:string;name:string;parentPathId:string;description:string;sortOrder:number},csrf:string){
    return mutation('/api/v1/taxonomy/admin/paths','POST',input,csrf);
  },
  updatePath(id:string,input:PathDisplayInput & Partial<{name:string;parentPathId:string;description:string;sortOrder:number;status:TaxonomyStatus}>,csrf:string){
    return mutation(`/api/v1/taxonomy/admin/paths/${encodeURIComponent(id)}`,'PATCH',input,csrf);
  },
  createLevel(input:{pathId:string;code:string;name:string;sortOrder:number},csrf:string){
    return mutation('/api/v1/taxonomy/admin/levels','POST',input,csrf);
  },
  updateLevel(id:string,input:Partial<{name:string;sortOrder:number;status:TaxonomyStatus}>,csrf:string){
    return mutation(`/api/v1/taxonomy/admin/levels/${encodeURIComponent(id)}`,'PATCH',input,csrf);
  },
  createSubject(input:SubjectDisplayInput & {pathId:string;levelId:string;code:string;name:string;sortOrder:number},csrf:string){
    return mutation('/api/v1/taxonomy/admin/subjects','POST',input,csrf);
  },
  updateSubject(id:string,input:SubjectDisplayInput & Partial<{name:string;levelId:string;sortOrder:number;status:TaxonomyStatus}>,csrf:string){
    return mutation(`/api/v1/taxonomy/admin/subjects/${encodeURIComponent(id)}`,'PATCH',input,csrf);
  },
  createSkill(input:{subjectId:string;parentSkillId:string;code:string;name:string;description:string;kind:'main'|'sub';sortOrder:number},csrf:string){
    return mutation('/api/v1/taxonomy/admin/skills','POST',input,csrf);
  },
  updateSkill(id:string,input:Partial<{name:string;parentSkillId:string;description:string;sortOrder:number;status:TaxonomyStatus}>,csrf:string){
    return mutation(`/api/v1/taxonomy/admin/skills/${encodeURIComponent(id)}`,'PATCH',input,csrf);
  },
};
