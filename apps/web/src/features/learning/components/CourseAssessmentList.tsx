import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/state/AuthProvider';
import { assessmentPlacementClient } from '../../assessment/api/assessment-placement-client';
import type { LearnerAssessmentPlacement } from '../../assessment/api/assessment-types';

type Preview = { id?: string; quizId?: string; title?: string };
type Props = { courseId:string; pathId:string; subjectId:string; returnTo:string; previews?:Preview[] };
const sameId = (value:unknown, expected:string) => typeof value === 'string' && value.toLowerCase() === expected.toLowerCase();

// Course placement is authoritative: the same exam may have a different
// entitlement in another location. Never start it through the direct route.
export function CourseAssessmentList({courseId,pathId,subjectId,returnTo,previews=[]}:Props) {
  const {user,loading,getCsrfToken} = useAuth();
  const navigate = useNavigate();
  const [rows,setRows] = useState<LearnerAssessmentPlacement[]>([]);
  const [loadedScope,setLoadedScope] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [page,setPage] = useState(1);
  const [hasMore,setHasMore] = useState(false);
  const [revision,setRevision] = useState(0);
  const [starting,setStarting] = useState('');
  const startRef = useRef(false);
  const scope = JSON.stringify([user?.id || '',courseId,pathId,subjectId]);
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const isStudent = Boolean(user?.roles?.includes('student'));
  const visibleRows = loadedScope === scope ? rows : [];
  useEffect(() => { setRows([]); setLoadedScope(''); setPage(1); setHasMore(false); setError(''); }, [scope]);
  useEffect(() => {
    if (loading || (user && !isStudent) || !courseId || !pathId || !subjectId) { setBusy(false); return; }
    const controller = new AbortController();
    const currentScope = scope;
    setBusy(true); setError('');
    assessmentPlacementClient.available({slot:'course',pathId,subjectId,courseId,page,limit:30},controller.signal)
      .then(result => {
        if (controller.signal.aborted || scopeRef.current !== currentScope) return;
        if (!Array.isArray(result.items) || result.items.some(item => item.slot !== 'course' || !sameId(item.courseId,courseId) || !sameId(item.pathId,pathId) || !sameId(item.subjectId,subjectId))) throw new Error('تعذر التحقق من نطاق اختبارات الدورة.');
        setRows(previous => page === 1 ? result.items : [...previous,...result.items.filter(item => !previous.some(old => old.placementId === item.placementId))]);
        setLoadedScope(currentScope);
        setHasMore(result.hasMore);
      }).catch(cause => { if (!controller.signal.aborted && scopeRef.current === currentScope) { setError(cause instanceof Error ? cause.message : 'تعذر تحميل اختبارات الدورة.'); if(page===1) setRows([]); } })
      .finally(() => { if (!controller.signal.aborted && scopeRef.current === currentScope) setBusy(false); });
    return () => controller.abort();
  },[loading,isStudent,user,courseId,pathId,subjectId,page,revision,scope]);
  const start = useCallback(async (row:LearnerAssessmentPlacement) => {
    if (startRef.current || !row.accessAllowed || !row.canStart || !user) return;
    startRef.current=true; setStarting(row.placementId); setError('');
    const currentScope=scope;
    try {
      const storageKey=`course-placement-start:${user.id}:${row.placementId}`;
      let key=sessionStorage.getItem(storageKey);
      if (!key) { key=crypto.randomUUID(); sessionStorage.setItem(storageKey,key); }
      const result=await assessmentPlacementClient.start(row.placementId,key,await getCsrfToken());
      if (scopeRef.current !== currentScope) return;
      if (!result.attempt?.id || !sameId(result.attempt.assessmentId,row.assessmentId)) throw new Error('تعذر التحقق من الاختبار الذي بدأ.');
      sessionStorage.removeItem(storageKey);
      navigate(`/assessment-attempts/${encodeURIComponent(result.attempt.id)}?returnTo=${encodeURIComponent(returnTo)}`);
    } catch (cause) { if (scopeRef.current === currentScope) setError(cause instanceof Error ? cause.message : 'تعذر بدء الاختبار.'); }
    finally { startRef.current=false; if (scopeRef.current === currentScope) setStarting(''); }
  },[user,scope,getCsrfToken,navigate,returnTo]);
  const missing=(Array.isArray(previews) ? previews : []).filter(preview => !visibleRows.some(row => typeof preview.quizId === 'string' && sameId(row.assessmentId,preview.quizId)));
  if (loading) return <p className="p-4 text-sm">جارٍ التحقق من الجلسة...</p>;
  if (user && !isStudent) return <p className="p-4 text-sm font-bold text-slate-600">ابدأ الاختبار من حساب طالب.</p>;
  if (!pathId || !subjectId) return <p role="alert" className="p-4 text-sm font-bold text-rose-700">تعذر تحديد مسار ومادة الدورة. أعد تحميل الصفحة.</p>;
  return <div className="space-y-3">
    {!user && <p className="text-sm font-bold text-slate-600">تظهر الاختبارات المتاحة هنا؛ سجّل الدخول بحساب طالب للبدء. <Link className="text-indigo-700 underline" to={`/login?returnTo=${encodeURIComponent(returnTo)}`}>تسجيل الدخول</Link></p>}
    {error && <div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error} <button type="button" onClick={()=>setRevision(value=>value+1)} className="font-black underline">إعادة المحاولة</button></div>}
    {visibleRows.map(row => <article key={row.placementId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
      <div><h4 className="font-black">{row.title}</h4><p className="mt-1 text-xs text-slate-500">{row.accessAllowed ? (row.canStart ? 'متاح' : 'استُنفدت المحاولات') : 'مغلق ويحتاج صلاحية'}</p></div>
      {!user && row.accessAllowed ? <Link to={`/login?returnTo=${encodeURIComponent(returnTo)}`} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white">تسجيل الدخول للبدء</Link> : <button type="button" disabled={!row.accessAllowed || !row.canStart || Boolean(starting)} onClick={()=>void start(row)} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50">{starting===row.placementId?'جاري البدء...':row.accessAllowed ? 'بدء الاختبار' : 'مغلق'}</button>}
    </article>)}
    {!busy && !error && loadedScope===scope && visibleRows.length===0 && <p className="p-3 text-sm text-slate-500">لا توجد اختبارات مفعّلة لهذا الموضع حاليًا.</p>}
    {!busy && !error && loadedScope===scope && !hasMore && missing.map((item,index)=><div key={item.id || index} className="rounded-xl border border-amber-200 p-3 text-sm"><span className="font-bold">{item.title || 'اختبار الدورة'}</span> <span className="text-amber-700">— لم يُفعّل موضعه في الدورة</span></div>)}
    {busy && <p role="status" className="p-3 text-sm">جاري تحميل الاختبارات...</p>}
    {hasMore && !busy && <button type="button" onClick={()=>setPage(value=>value+1)} className="rounded-xl border px-4 py-2 text-sm font-bold">عرض المزيد</button>}
  </div>;
}
