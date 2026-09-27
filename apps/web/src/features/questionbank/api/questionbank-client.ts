export type QuestionWorkflowStatus='draft'|'pending_review'|'approved'|'rejected'|'archived';
export type QuestionType='mcq'|'true_false'|'essay';

export interface QuestionSummary{
  id:string;
  questionCode:string;
  currentVersion:number;
  workflowStatus:QuestionWorkflowStatus;
  ownerType:'platform'|'teacher'|'school';
  ownerId:string;
  pathId:string;
  subjectId:string;
  assignedTeacherId:string;
  type:QuestionType;
  difficulty:string;
  examType:string;
  source:string;
  year:number|null;
  hasImage:boolean;
  hasVideo:boolean;
  hasExplanation:boolean;
  mainSkillId:string;
  skillIds:string[];
  updatedAt:string;
}
export interface QuestionPage{items:QuestionSummary[];page:number;limit:number;hasMore:boolean}
export interface SkillCoverage{skillId:string;relationType:'main'|'sub'|'secondary';questionCount:number}
export interface QuestionCoverage{
  questionsTotal:number;
  approved:number;
  pendingReview:number;
  unlinked:number;
  mainSkillCoverage:number;
  subSkillCoverage:number;
  skills:SkillCoverage[];
  skillPage:number;
  skillLimit:number;
  skillsHasMore:boolean;
}
export interface QuestionOption{index:number;text:string;assetId:string}
export interface QuestionSkillLink{skillId:string;relationType:'main'|'sub'|'secondary'}
export interface QuestionDetail extends QuestionSummary{
  approvedBy:string;
  approvedAt:string|null;
  reviewerNotes:string;
  revenueSharePercentage:number|null;
  version:{
    version:number;
    type:QuestionType;
    text:string;
    imageAssetId:string;
    imageAlt:string;
    optionsEmbeddedInImage:boolean;
    correctOptionIndex:number|null;
    explanation:string;
    hint:string;
    solvingStrategy:string;
    videoUrl:string;
    sourceMeta:unknown;
    aiContext:unknown;
    voiceExplanation:unknown;
    difficulty:string;
    examType:string;
    source:string;
    year:number|null;
    revisionNote:string;
  };
  options:QuestionOption[];
  skillLinks:QuestionSkillLink[];
}
export interface QuestionVersionWrite{
  pathId:string;
  subjectId:string;
  type:QuestionType;
  text:string;
  imageAssetId:string;
  imageAlt:string;
  optionsEmbeddedInImage:boolean;
  correctOptionIndex:number|null;
  explanation:string;
  hint:string;
  solvingStrategy:string;
  videoUrl:string;
  sourceMeta:Record<string,unknown>;
  aiContext:Record<string,unknown>;
  voiceExplanation:Record<string,unknown>;
  difficulty:string;
  examType:string;
  source:string;
  year:number|null;
  revisionNote:string;
  options:Array<{text:string;assetId:string}>;
  skillLinks:QuestionSkillLink[];
}
export interface QuestionCreateWrite{
  questionCode:string;
  ownerType:'platform'|'teacher';
  ownerId:string;
  assignedTeacherId:string;
  version:QuestionVersionWrite;
}
export interface QuestionFilters{
  page?:number;
  limit?:number;
  search?:string;
  pathId?:string;
  subjectId?:string;
  mainSkillId?:string;
  linked?:boolean|'';
  difficulty?:string;
  type?:QuestionType|'';
  workflowStatus?:QuestionWorkflowStatus|'';
  withVideo?:boolean|'';
  withExplanation?:boolean|'';
}
export interface ImportResult{
  status:'PASS'|'INVALID'|'CONFLICT'|'IMPORTED'|string;
  mode:'DRY_RUN'|'WRITE'|string;
  batchId:string;
  requested:number;
  prepared:number;
  inserted:number;
  questionCodes:string[];
  issues:Array<{index:number;questionCode:string;code:string;message:string}>;
  conflicts:Array<Record<string,unknown>>;
  batch?:Record<string,unknown>;
}
export interface MediaAsset{
  id:string;
  publicUrl:string;
  mimeType:string;
  sizeBytes:number;
  sha256:string;
  version:number;
  status:'pending_upload'|'active'|'orphan_candidate'|'archived';
  verifiedAt:string|null;
}
interface PresignResponse{
  asset:MediaAsset;
  uploadRequired:boolean;
  upload?:{url:string;headers:Record<string,string>;expiresAt:string};
}

const BASE=(import.meta.env.VITE_API_BASE_URL??'').replace(/\/$/,'');
async function request<T>(path:string,init:RequestInit={}):Promise<T>{
  const response=await fetch(BASE+path,{
    ...init,
    credentials:'include',
    headers:{Accept:'application/json',...init.headers},
  });
  if(!response.ok){
    const body=await response.json().catch(()=>({message:'تعذر تنفيذ طلب بنك الأسئلة'}));
    throw new Error(body.message||body.error?.message||'تعذر تنفيذ طلب بنك الأسئلة');
  }
  return response.json() as Promise<T>;
}
function qs(filters:QuestionFilters){
  const p=new URLSearchParams();
  p.set('page',String(filters.page||1));
  p.set('limit',String(filters.limit||50));
  if(filters.search)p.set('search',filters.search);
  if(filters.pathId)p.set('pathId',filters.pathId);
  if(filters.subjectId)p.set('subjectId',filters.subjectId);
  if(filters.mainSkillId)p.set('mainSkillId',filters.mainSkillId);
  if(filters.linked!=='')p.set('linked',String(filters.linked));
  if(filters.difficulty)p.set('difficulty',filters.difficulty);
  if(filters.type)p.set('type',filters.type);
  if(filters.workflowStatus)p.set('workflowStatus',filters.workflowStatus);
  if(filters.withVideo!=='')p.set('withVideo',String(filters.withVideo));
  if(filters.withExplanation!=='')p.set('withExplanation',String(filters.withExplanation));
  return p.toString();
}
function csrfHeaders(csrf:string){return {'Content-Type':'application/json','X-CSRF-Token':csrf}}
async function sha256Hex(file:File){
  const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
}

export const questionBankClient={
  list(filters:QuestionFilters,signal?:AbortSignal){
    return request<QuestionPage>(`/api/v1/questions?${qs(filters)}`,{signal});
  },
  coverage(filters:QuestionFilters,signal?:AbortSignal){
    const query=qs(filters);
    return request<QuestionCoverage>(`/api/v1/questions/coverage?${query}&skillPage=1&skillLimit=50`,{signal});
  },
  get(id:string,signal?:AbortSignal){
    return request<{question:QuestionDetail}>(`/api/v1/questions/${encodeURIComponent(id)}/staff`,{signal});
  },
  create(input:QuestionCreateWrite,csrf:string){
    return request<{question:QuestionDetail}>('/api/v1/questions/',{method:'POST',headers:csrfHeaders(csrf),body:JSON.stringify(input)});
  },
  appendVersion(id:string,expectedCurrentVersion:number,version:QuestionVersionWrite,csrf:string){
    return request<{question:QuestionDetail}>(`/api/v1/questions/${encodeURIComponent(id)}/versions`,{method:'POST',headers:csrfHeaders(csrf),body:JSON.stringify({expectedCurrentVersion,version})});
  },
  workflow(id:string,expectedCurrentVersion:number,status:QuestionWorkflowStatus,reviewerNotes:string,csrf:string){
    return request<{question:QuestionDetail}>(`/api/v1/questions/${encodeURIComponent(id)}/workflow`,{method:'PATCH',headers:csrfHeaders(csrf),body:JSON.stringify({expectedCurrentVersion,status,reviewerNotes})});
  },
  importBatch(batchId:string,dryRun:boolean,items:unknown[],csrf:string){
    return request<ImportResult>('/api/v1/questions/import-batches',{method:'POST',headers:csrfHeaders(csrf),body:JSON.stringify({batchId,dryRun,items})});
  },
  async uploadAsset(file:File,questionCode:string,kind:'question_image'|'question_import_image'|'explanation_audio',csrf:string){
    const sha256=await sha256Hex(file);
    const presign=await request<PresignResponse>('/api/v1/media/uploads/presign',{
      method:'POST',
      headers:csrfHeaders(csrf),
      body:JSON.stringify({kind,questionCode,sha256,mimeType:file.type,sizeBytes:file.size}),
    });
    if(presign.uploadRequired){
      if(!presign.upload)throw new Error('لم يرجع مزود الوسائط رابط رفع صالحًا.');
      const upload=await fetch(presign.upload.url,{method:'PUT',headers:presign.upload.headers,body:file});
      if(!upload.ok)throw new Error('فشل الرفع المباشر إلى مخزن الوسائط.');
      return request<{asset:MediaAsset}>(`/api/v1/media/uploads/${encodeURIComponent(presign.asset.id)}/complete`,{
        method:'POST',
        headers:{'X-CSRF-Token':csrf},
      }).then(x=>x.asset);
    }
    return presign.asset;
  },
};
