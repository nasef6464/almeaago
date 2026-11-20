import { CheckCircle2, CreditCard, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { assessmentPlacementClient, type SubjectAccessGuide as GuideData } from '../../assessment/api/assessment-placement-client';
import { useAuth } from '../../auth/state/AuthProvider';
import { subjectPackagesURL } from '../../commerce/navigation/subjectPackages';

const labels: Record<string, string> = { foundation: 'التأسيس', banks: 'التدريب', tests: 'الاختبارات', library: 'المكتبة', courses: 'الدورات' };
type State = { scope: string; guide: GuideData | null; error: string };

export function SubjectAccessGuide({ pathId, subjectId }: { pathId: string; subjectId: string }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const scope = JSON.stringify([user?.id || '', pathId, subjectId]);
  const [state, setState] = useState<State | null>(null);
  const [retry, setRetry] = useState(0);
  const current = !loading && state?.scope === scope ? state : null;

  useEffect(() => {
    if (loading || !pathId || !subjectId) return;
    const controller = new AbortController();
    setState(null);
    assessmentPlacementClient.subjectAccessGuide(pathId, subjectId, controller.signal).then(guide => {
      if (controller.signal.aborted) return;
      if (!guide || guide.pathId !== pathId || guide.subjectId !== subjectId || !Array.isArray(guide.categories) || !Array.isArray(guide.unavailable) || typeof guide.complete !== 'boolean' || guide.complete !== (guide.unavailable.length === 0) || guide.unavailable.some(type => typeof type !== 'string') || guide.categories.some(row => !row || !['foundation', 'banks', 'tests', 'library', 'courses'].includes(row.type) || ['hasContent', 'hasFree', 'hasOpen', 'hasLocked', 'hasRestricted'].some(key => typeof row[key as keyof typeof row] !== 'boolean'))) throw new Error('invalid guide');
      setState({ scope, guide, error: '' });
    }).catch(() => { if (!controller.signal.aborted) setState({ scope, guide: null, error: 'تعذر التحقق من حالة الوصول للمادة.' }); });
    return () => controller.abort();
  }, [loading, pathId, subjectId, scope, retry]);

  if (!current) return <div role="status" className="mb-6 rounded-2xl border border-slate-100 bg-white p-4 text-xs font-bold text-slate-500">جاري التحقق من حالة الوصول للمادة...</div>;
  if (current.error || !current.guide) return <div role="alert" className="mb-6 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-xs font-bold text-rose-700">{current.error} <button type="button" onClick={() => setRetry(value => value + 1)} className="underline">إعادة المحاولة</button></div>;
  const order = ['courses', 'foundation', 'banks', 'tests', 'library'];
  const rows = current.guide.categories.filter(row => row.hasContent && !current.guide!.unavailable.includes(row.type)).sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  const locked = rows.filter(row => row.hasLocked);
  const returnTo = location.pathname + location.search + location.hash;
  const packagesURL = locked.length === 1 && locked[0].type !== 'courses' ? subjectPackagesURL(pathId, subjectId, locked[0].type, returnTo) : `/category/${encodeURIComponent(pathId)}?${new URLSearchParams({ tab: 'packages', returnTo })}`;
  const unavailable = current.guide.unavailable.map(type => labels[type] || type).join('، ');

  return <section aria-label="حالة الوصول لهذه المادة" className="mb-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="text-xs font-black text-slate-500">حالة الوصول لهذه المادة</div>
        {rows.length > 0 ? <div className="mt-2 flex flex-wrap gap-2">{rows.map(row => {
          const status = [row.hasOpen ? (user ? 'مفتوح' : 'متاح بعد تسجيل الدخول') : '', row.hasLocked ? (row.type === 'courses' ? 'يحتاج شراء أو اشتراك' : 'يحتاج باقة') : '', row.hasRestricted ? 'محتوى موجّه' : '', row.hasFree ? 'يوجد مجاني' : ''].filter(Boolean).join('، ');
          return <span key={row.type} className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black ${row.hasLocked || row.hasRestricted ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
            {row.hasLocked || row.hasRestricted ? <Lock size={14} /> : <CheckCircle2 size={14} />}{labels[row.type]} <span className="font-bold opacity-75">{status || 'غير متاح حاليًا'}</span>
          </span>;
        })}</div> : <p className="mt-2 text-xs text-slate-500">لا يوجد محتوى في الفئات التي تم التحقق منها حاليًا.</p>}
        {!current.guide.complete && <p className="mt-3 text-xs font-bold text-slate-500">{unavailable ? `لم تُحسب حالة ${unavailable} بعد.` : 'بعض حالات الوصول لم تُحسب بعد.'}</p>}
      </div>
      {locked.length > 0 && <Link to={packagesURL} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-amber-100 hover:bg-amber-600"><CreditCard size={18} />عرض الباقات</Link>}
    </div>
  </section>;
}
