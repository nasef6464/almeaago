// Guest-only read model. Never call the staff /api/v1/courses endpoint here.
export interface PublicCourse {
 id:string;
 title:string;
 instructorName:string;
 thumbnailUrl:string;
}
export async function getPublicCourses(signal?:AbortSignal):Promise<PublicCourse[]>{
 const base=String(import.meta.env.VITE_API_BASE_URL||'').replace(/\/$/,'');
 const response=await fetch(`${base}/api/v1/courses/public?limit=100`,{signal,credentials:'omit',headers:{Accept:'application/json'}});
 if(!response.ok)throw new Error('Public course catalog unavailable');
 const payload:unknown=await response.json();
 if(!payload || typeof payload!=='object' || !('items' in payload) || !Array.isArray(payload.items))throw new Error('Invalid public course catalog');
 return payload.items.filter((item:unknown):item is PublicCourse=>{
  if(!item||typeof item!=='object')return false;
  const row=item as Record<string,unknown>;
  return typeof row.id==='string'&&row.id.length>0&&typeof row.title==='string'&&row.title.trim().length>0&&typeof row.instructorName==='string'&&typeof row.thumbnailUrl==='string';
 });
}
