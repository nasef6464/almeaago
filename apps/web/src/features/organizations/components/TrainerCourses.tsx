import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { contentClient } from '../../content/api/content-client';
import type { ContentWorkflowStatus, CourseSummary } from '../../content/api/content-types';

const labels: Record<ContentWorkflowStatus, string> = {draft:'مسودة',pending_review:'بانتظار المراجعة',approved:'معتمدة',rejected:'تحتاج تعديل',archived:'مؤرشفة'};

export function TrainerCourses({ actorId }: { actorId: string }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{scope:string; items:CourseSummary[]; hasMore:boolean; error:string} | null>(null);
  const scope = JSON.stringify([actorId,page,query,retry]);
  const current = result?.scope === scope ? result : null;

  useEffect(() => {
    if (!actorId) return;
    const controller = new AbortController();
    contentClient.courses({page,limit:30,search:query},controller.signal).then(data => {
      if (controller.signal.aborted) return;
      if (data.page !== page || !Array.isArray(data.items) || typeof data.hasMore !== 'boolean') throw new Error('تعذر التحقق من قائمة الدورات.');
      setResult({scope,items:data.items,hasMore:data.hasMore,error:''});
    }).catch(reason => { if (!controller.signal.aborted) setResult({scope,items:[],hasMore:false,error:reason instanceof Error ? reason.message : 'تعذر تحميل الدورات.'}); });
    return () => controller.abort();
  },[actorId,page,query,retry,scope]);

  return <section className="mt-6 space-y-5" aria-label="دوراتي الفعلية">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black text-slate-900">دوراتي الفعلية</h2><p className="mt-1 text-xs text-slate-500">الدورات التي يتيحها حسابك للإدارة.</p></div><Link to="/admin-dashboard/content?tab=courses" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white">إدارة وإنشاء الدورات</Link></div>
    <form onSubmit={event => {event.preventDefault();setPage(1);setQuery(search.trim());}} className="flex gap-2"><input aria-label="بحث دوراتي" value={search} onChange={event => setSearch(event.target.value)} maxLength={160} className="min-w-0 flex-1 rounded-xl border p-3 text-sm" placeholder="ابحث عن دورة"/><button className="rounded-xl border px-4 text-sm font-bold">بحث</button></form>
    {!current ? <p role="status" className="rounded-xl bg-white p-4 text-sm">جارٍ تحميل الدورات...</p> : current.error ? <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{current.error} <button type="button" onClick={() => setRetry(n => n+1)} className="font-bold underline">إعادة المحاولة</button></div> : current.items.length === 0 ? <p className="rounded-xl bg-white p-4 text-sm">لا توجد دورات مطابقة لحسابك والبحث الحالي.</p> : <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{current.items.map(course => <article key={course.id} className="flex flex-col gap-3 rounded-3xl border bg-white p-5"><div className="flex items-center justify-between gap-2"><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">{labels[course.workflowStatus] || 'غير محددة'}</span><span className="text-xs text-slate-500">{course.isPublished && course.isVisible ? 'ظاهرة للطلاب' : 'غير ظاهرة للطلاب'}</span></div><h3 className="font-black text-slate-900">{course.title}</h3><div className="mt-auto flex flex-wrap gap-2"><Link className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white" to={`/admin-dashboard/content?tab=courses&editCourse=${encodeURIComponent(course.id)}`}>إدارة الدورة والمناقشات</Link>{course.workflowStatus === 'approved' && course.isPublished && course.isVisible && <Link className="rounded-xl border px-3 py-2 text-xs font-bold text-indigo-700" to={`/course/${encodeURIComponent(course.id)}`}>عرض الدورة</Link>}</div></article>)}</div>}
    {current && !current.error && <div className="flex items-center justify-center gap-3"><button type="button" disabled={page===1} onClick={() => setPage(value => value-1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">السابق</button><span className="text-sm">صفحة {page}</span><button type="button" disabled={!current.hasMore} onClick={() => setPage(value => value+1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">التالي</button></div>}
  </section>;
}
