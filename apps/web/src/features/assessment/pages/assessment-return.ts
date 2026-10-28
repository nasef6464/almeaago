// Navigation context only. It never authorizes an assessment or changes its lifecycle.
export function safeAssessmentReturn(search:string):string|null {
 const params=new URLSearchParams(search);
 if(params.getAll('source').length!==1||params.get('source')!=='mock-exam'||params.getAll('returnTo').length!==1)return null;
 const target=params.get('returnTo')||'';
 if(!target.startsWith('/')||target.startsWith('//')||target.length>2048||/[\\\u0000-\u001f\u007f]/.test(target))return null;
 try{
  const url=new URL(target,'https://assessment.internal');
  if(url.origin!=='https://assessment.internal'||url.hash||!/^\/category\/[A-Za-z0-9_-]+$/.test(url.pathname)||url.pathname!==target.split(/[?#]/)[0])return null;
  if(url.searchParams.getAll('tab').length!==1||url.searchParams.get('tab')!=='mock-exams')return null;
  for(const [name,value] of url.searchParams){if(!['tab','level','subject'].includes(name)||/[\\\u0000-\u001f\u007f]/.test(decodeURIComponent(value)))return null;}
  return url.pathname+url.search;
 }catch{return null;}
}

// Forward only validated mock journey context through result detail/history links.
export function assessmentResultsHref(attemptId:string|undefined,search:string):string {
 const path=attemptId?`/assessment-results/${encodeURIComponent(attemptId)}`:'/assessment-results';
 const returnTo=safeAssessmentReturn(search);
 return returnTo?`${path}?${new URLSearchParams({returnTo,source:'mock-exam'})}`:path;
}
