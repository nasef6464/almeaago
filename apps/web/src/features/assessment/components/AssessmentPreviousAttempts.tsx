import { ArrowRight, ChevronDown, History } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { attemptClient, type ResultListItem, type ResultPage } from '../api/attempt-client';

function scoreColor(score: number) {
  return score >= 75 ? 'bg-emerald-100 text-emerald-700' : score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700';
}

function ScoreTrend({ scores }: { scores: number[] }) {
  const points = [...scores].reverse().map((score, index) => ({
    x: 4 + index * 112 / Math.max(1, scores.length - 1), y: 32 - score * 0.28,
  }));
  const last = points.at(-1);
  return (
    <span className="hidden w-[120px] shrink-0 text-center text-[10px] font-bold text-gray-400 sm:block">
      {points.length < 2 || !last ? 'محاولة واحدة' : (
        <svg viewBox="0 0 120 36" className="h-9 w-full text-indigo-500" aria-hidden="true">
          <polyline points={points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <circle cx={last.x} cy={last.y} r="3.5" fill="currentColor" />
        </svg>
      )}
    </span>
  );
}

function AttemptGroup({ title, attempts }: { title: string; attempts: ResultListItem[] }) {
  const [open, setOpen] = useState(false);
  const latest = attempts[0];
  const scores = attempts.filter(attempt => attempt.showResultsReport).map(attempt => attempt.score);
  const best = scores.length ? Math.max(...scores) : null;
  const delta = scores.length > 1 ? scores[0] - scores[scores.length - 1] : null;
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-gray-50">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-black ${latest.showResultsReport ? scoreColor(latest.score) : 'bg-slate-100 text-slate-500'}`}>
          {latest.showResultsReport ? `${latest.score}%` : '—'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-black text-gray-900">{title}</span>
          <span className="flex flex-wrap gap-2 text-[11px] font-bold text-gray-500">
            <span>{attempts.length} محاولة</span>
            {best !== null && <span>أعلى: {best}%</span>}
            {delta !== null && <span className={delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-500' : 'text-gray-500'}>{delta > 0 ? '▲' : delta < 0 ? '▼' : '─'} {Math.abs(delta)}%</span>}
          </span>
        </span>
        {scores.length > 0 && <ScoreTrend scores={scores} />}
        <ChevronDown size={16} className={open ? 'shrink-0 rotate-180 text-gray-400' : 'shrink-0 text-gray-400'} />
      </button>
      {open && <div className="divide-y divide-gray-50 border-t border-gray-100">
        {attempts.map((attempt, index) => {
          const url = `/assessment-results/${encodeURIComponent(attempt.attemptId)}`;
          return <div key={attempt.attemptId} className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 ${index === 0 ? 'bg-indigo-50/40' : ''}`}>
            <div className="flex items-center gap-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-black ${attempt.showResultsReport ? scoreColor(attempt.score) : 'bg-slate-100 text-slate-500'}`}>
                {attempt.showResultsReport ? `${attempt.score}%` : '—'}
              </span>
              <div className="text-xs font-bold text-gray-700">
                <time dateTime={attempt.finalizedAt}>{new Date(attempt.finalizedAt).toLocaleDateString('ar-SA')}</time>
                {index === 0 && <span className="ms-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] text-indigo-700">الأحدث</span>}
                {attempt.showResultsReport && <p className="mt-1 text-[11px] text-gray-500">{Math.floor(attempt.timeSpentSeconds / 60)} د {attempt.timeSpentSeconds % 60} ث · {attempt.totalQuestions} سؤال</p>}
              </div>
            </div>
            <div className="flex gap-1.5">
              <Link to={url} className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-black text-white">تحليل</Link>
              {attempt.showResultsReport && <Link to={`${url}?view=review`} className="rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-black text-emerald-700">مراجعة</Link>}
            </div>
          </div>;
        })}
      </div>}
    </section>
  );
}

export function AssessmentPreviousAttempts({ onBack }: { onBack: () => void }) {
  const [attempts, setAttempts] = useState<ResultListItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void attemptClient.results(page, 20).then(({ items, hasMore }: ResultPage) => {
      if (!active) return;
      setAttempts(current => [...new Map([...current, ...(items || [])].map(item => [item.attemptId, item])).values()]);
      setHasMore(hasMore);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'تعذر تحميل المحاولات السابقة');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [page, retry]);

  const groups = new Map<string, ResultListItem[]>();
  for (const attempt of attempts) {
    const title = attempt.title || attempt.assessmentId;
    const group = groups.get(title) || [];
    group.push(attempt);
    groups.set(title, group);
  }

  return (
    <main dir="rtl" className="mx-auto max-w-5xl space-y-4 px-3 pb-16 pt-5 sm:px-6">
      <header className="mb-4 flex items-center gap-3">
        <button type="button" onClick={onBack} aria-label="العودة للملخص" className="text-gray-500"><ArrowRight /></button>
        <div>
          <h1 className="text-lg font-black">محاولاتك السابقة</h1>
          {attempts.length > 0 && <p className="mt-0.5 text-xs font-bold text-gray-500">{attempts.length} محاولة في {groups.size} اختبار</p>}
        </div>
      </header>
      {Array.from(groups, ([title, group]) => <AttemptGroup key={title} title={title} attempts={group} />)}
      {loading && <p role="status" className="p-4 text-sm font-bold text-gray-600">جاري تحميل المحاولات السابقة...</p>}
      {error && <div role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{error} <button type="button" className="underline" onClick={() => setRetry(value => value + 1)}>إعادة المحاولة</button></div>}
      {!loading && !error && attempts.length === 0 && <section className="rounded-2xl border-2 border-dashed bg-white p-6 text-center">
        <History className="mx-auto text-emerald-600" />
        <h2 className="mt-4 font-black">لا توجد محاولات بعد</h2>
        <p className="mt-2 text-sm font-bold text-gray-500">بعد أول اختبار ستظهر محاولاتك هنا مرتبة حسب الاختبار.</p>
        <div className="mt-4 flex justify-center gap-2 text-sm font-black">
          <Link to="/quiz" className="rounded-xl bg-indigo-600 px-3 py-2 text-white">ابدأ اختبار</Link>
          <Link to="/assessments" className="rounded-xl border px-3 py-2 text-slate-700">مركز الاختبارات</Link>
        </div>
      </section>}
      {!loading && !error && hasMore && <button type="button" className="rounded-xl border bg-white px-4 py-2 text-sm font-black" onClick={() => setPage(value => value + 1)}>عرض المزيد</button>}
    </main>
  );
}
