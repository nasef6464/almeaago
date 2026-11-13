import {useEffect,useRef,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {useStudentExperience} from '../../../learning/navigation/StudentNavigationProvider';
import {useAuth} from '../../../auth/state/AuthProvider';
import {attemptClient} from '../../../assessment/api/attempt-client';
import {Card} from './Card';
import {PathMockExamsView} from './PathMockExamsView';
import {usePublicMocks} from './public-metadata';
import {pathMockCatalog,startPublishedMock} from './path-mocks';

export function PathMockExamsPage({pathId}:{pathId:string}) {
 const experience=useStudentExperience();const auth=useAuth();const navigate=useNavigate();const catalog=usePublicMocks();
 const [starting,setStarting]=useState('');const [startError,setStartError]=useState('');
 const [accessById,setAccessById]=useState<Record<string,'allowed'|'purchased'|'locked'|'unavailable'|'error'|'loading'>>({});const [accessRevision,setAccessRevision]=useState(0);
 const keys=useRef(new Map<string,string>());const identity=useRef({user:auth.user,pathId,generation:0});const mounted=useRef(true);
 if(identity.current.user!==auth.user||identity.current.pathId!==pathId){identity.current={user:auth.user,pathId,generation:identity.current.generation+1}}
 useEffect(()=>{mounted.current=true;setStarting('');setStartError('');keys.current.clear();return()=>{mounted.current=false}},[auth.user,pathId]);
 const path=experience.paths.find(row=>row.id===pathId && experience.scope.pathVisible(row));
 const subjects=experience.subjects;
 const catalogView=pathMockCatalog(catalog.items.filter(experience.scope.matchesContent),pathId);
 const isStudent=Boolean(auth.user?.roles.includes('student'));
 const returnTo=`/category/${encodeURIComponent(pathId)}?tab=mock-exams`;
 useEffect(()=>{const controller=new AbortController();const ids=[...new Set(catalog.items.filter(row=>row.pathId===pathId&&row.id).map(row=>row.id!))];setAccessById(Object.fromEntries(ids.map(id=>[id,'loading'])));let cursor=0;async function worker(){while(!controller.signal.aborted&&cursor<ids.length){const id=ids[cursor++];try{const result=await attemptClient.previewAccess(id,controller.signal);if(!controller.signal.aborted)setAccessById(current=>({...current,[id]:result.allowed?(result.reason==='user_entitlement'||result.reason==='school_entitlement'?'purchased':'allowed'):result.reason==='package_required'||result.reason==='paid_required'?'locked':'unavailable'}));}catch{if(!controller.signal.aborted)setAccessById(current=>({...current,[id]:'error'}));}}}void Promise.all(Array.from({length:Math.min(ids.length,6)},worker));return()=>controller.abort()},[catalog.items,pathId,auth.user,accessRevision]);
 async function start(assessmentId:string){
  if(!isStudent||!assessmentId||starting||!['allowed','purchased'].includes(accessById[assessmentId]))return;
  const generation=identity.current.generation;const current=()=>mounted.current&&identity.current.generation===generation;
  let key=keys.current.get(assessmentId);if(!key){key=crypto.randomUUID();keys.current.set(assessmentId,key)}
  setStarting(assessmentId);setStartError('');
  try{const attemptId=await startPublishedMock({assessmentId,key,current,getCsrf:auth.getCsrfToken,start:attemptClient.start});if(current())navigate(`/assessment-attempts/${encodeURIComponent(attemptId)}?${new URLSearchParams({returnTo,source:'mock-exam'})}`)}
  catch(error){if(current())setStartError(error instanceof Error?error.message:'تعذر بدء الاختبار.')}
  finally{if(current())setStarting('')}
 }
 if(experience.loading||auth.loading||catalog.loading)return <div role="status" className="p-8 text-center">جاري تحميل المحاكيات...</div>;
 if(experience.error||catalog.error)return <div role="alert" className="p-8 text-center"><p>{experience.error||catalog.error}</p><button type="button" onClick={()=>experience.error?window.location.reload():catalog.reload()} className="mt-3 rounded-xl border px-4 py-2">إعادة المحاولة</button></div>;
 if(!path)return <Card className="p-8 text-center"><h1 className="text-xl font-black">المسار غير متاح</h1><Link to="/mock-exams" className="mt-4 inline-block text-indigo-700">العودة إلى الاختبارات المحاكية</Link></Card>;
 return <PathMockExamsView path={{id:path.id,name:path.name,color:typeof path.color==='string'?path.color:undefined}} subjects={subjects} catalogView={catalogView} guest={!auth.user} isStudent={isStudent} returnTo={returnTo} starting={starting} startError={startError} accessById={accessById} onRetryAccess={()=>setAccessRevision(value=>value+1)} onStart={id=>void start(id)} onBack={()=>navigate(`/category/${encodeURIComponent(path.id)}`)}/>;
}
