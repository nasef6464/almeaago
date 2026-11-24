import { BarChart3, Download, Eye, FileText, History, PlusCircle, RefreshCw, Sparkles, Target } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import type { ResultDetail } from '../api/attempt-client';
import { formatResultDuration } from '../relativeDate';
import { ResultDonutChart } from './ResultDonutChart';
import { AssessmentSubjectResults } from './AssessmentSubjectResults';
import { AssessmentSectionResults } from './AssessmentSectionResults';

type Props = {
  detail: ResultDetail;
  navigation: ReactNode;
  full: boolean;
  onToggleFull: () => void;
  onReview: () => void;
  onMoreDetails: () => void;
  onHistory: () => void;
  practiceURL: string;
  retryURL: string;
};

const actionClass = 'inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-center text-xs font-black shadow-sm sm:px-4 sm:text-sm';

export function AssessmentResultSummary({ detail, navigation, full, onToggleFull, onReview, onMoreDetails, onHistory, practiceURL, retryURL }: Props) {
  const { result } = detail;
  const reviewCount = detail.allowQuestionReview ? (detail.questions?.length ?? 0) : 0;
  const tone = result.score >= 85
    ? { title: 'أداء متميز', message: 'حافظ على مستواك وثبّت المهارات التي أتقنتها.', gradient: 'from-emerald-50 to-white', text: 'text-emerald-700', ring: '#10b981' }
    : result.score >= 60
      ? { title: 'أداء جيد', message: 'راجع المهارات التي تحتاج دعمًا، ثم جرّب تدريبًا قصيرًا.', gradient: 'from-amber-50 to-white', text: 'text-amber-700', ring: '#f59e0b' }
      : { title: 'يحتاج مراجعة', message: 'ابدأ بأضعف مهارة، ثم حل تدريبًا قصيرًا.', gradient: 'from-rose-50 to-white', text: 'text-rose-700', ring: '#f43f5e' };
  const timePerQuestion = result.totalQuestions > 0 && Number.isFinite(result.timeSpentSeconds)
    ? `${Math.round(result.timeSpentSeconds / result.totalQuestions)} ث/سؤال`
    : '—';
  const stats = [
    { label: 'عدد الأسئلة', value: result.totalQuestions, color: 'text-slate-800', panel: 'bg-slate-50/80' },
    { label: 'الصحيح', value: result.correctAnswers, color: 'text-emerald-700', panel: 'bg-emerald-50/90' },
    { label: 'الخطأ', value: result.wrongAnswers, color: 'text-rose-700', panel: 'bg-rose-50/90' },
    { label: 'وقت الحل', value: formatResultDuration(result.timeSpentSeconds), color: 'text-slate-800', panel: 'bg-slate-50/80' },
    { label: 'متوسط السرعة', value: timePerQuestion, color: 'text-slate-800', panel: 'bg-slate-50/80' },
  ];
  const compactActionLayout = 'inline-flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-black shadow-sm';
  const distribution = [
    { name: 'صحيحة', value: result.correctAnswers, color: '#10b981' },
    { name: 'خاطئة', value: result.wrongAnswers, color: '#ef4444' },
    { name: 'بدون إجابة', value: result.unanswered, color: '#f59e0b' },
  ];

  return (
    <>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        {navigation}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button type="button" onClick={() => window.print()} className={`${compactActionLayout} border-indigo-100 bg-white text-indigo-700`}>
            <Download size={14} /> تحميل PDF
          </button>
          <button type="button" onClick={onToggleFull} aria-expanded={full} className={`${compactActionLayout} border-slate-200 bg-white text-slate-700`}>
            {full ? <Sparkles size={14} /> : <FileText size={14} />}
            {full ? 'العودة للملخص البسيط' : 'عرض التقرير الكامل'}
          </button>
          <span className={`w-fit rounded-full bg-slate-50 px-3 py-1 text-xs font-black ${tone.text}`}>{tone.title}</span>
        </div>
      </header>

      <section className={`relative overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-br p-3 shadow-sm sm:p-6 ${tone.gradient}`}>
        <div aria-hidden="true" className="pointer-events-none absolute right-0 top-0 h-36 w-36 -translate-y-1/2 translate-x-1/2 rounded-full bg-white/60" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-black text-slate-700 shadow-sm"><Target size={13} /> ملخص النتيجة</span>
              <h2 className="mt-2 break-words text-xl font-black leading-tight text-gray-900 sm:text-2xl">{detail.title}</h2>
              <p className="mt-1 text-sm font-bold leading-relaxed text-gray-600">{tone.message}</p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/95 px-4 py-3 text-center shadow-sm">
              <div className="text-xs font-bold text-gray-500">تاريخ المحاولة</div>
              <div className="mt-1 text-sm font-black text-gray-800">{new Date(result.finalizedAt).toLocaleDateString('ar-SA')}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-[112px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-5">
            <div className="relative flex h-28 items-center justify-center overflow-hidden rounded-2xl border border-white bg-white/90 p-1 sm:h-44 sm:p-3 [&>div]:min-h-0">
              <ResultDonutChart data={distribution} primaryColor={tone.ring} />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-2xl font-black sm:text-4xl ${tone.text}`}>{result.score}%</span>
                <span className="text-xs font-black text-gray-500">درجتك</span>
              </div>
            </div>
            <div className="min-w-0 space-y-3">
              <dl className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-5">
                {stats.map(({ label, value, color, panel }) => <div key={label} className={`min-w-0 rounded-xl p-2 text-start ${panel}`}>
                  <dt className="text-[10px] font-bold text-gray-500 sm:text-xs">{label}</dt>
                  <dd className={`mt-1 break-words text-xs font-black sm:text-sm ${color}`}>{value}</dd>
                </div>)}
              </dl>
              <ul className="flex flex-wrap gap-2 text-[10px] font-bold text-gray-600 sm:text-xs" aria-label="توزيع الإجابات">
                {distribution.map(({ name, value, color }) => <li key={name} className="flex items-center gap-1">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} /> {name}: {value}
                </li>)}
              </ul>
              {result.totalQuestions > 0 && <div className="flex h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
                {distribution.map(({ name, value, color }) => <span key={name} style={{ width: `${100 * value / result.totalQuestions}%`, backgroundColor: name === 'بدون إجابة' ? '#cbd5e1' : color }} />)}
              </div>}
            </div>
          </div>

          <AssessmentSubjectResults detail={detail} />
          <AssessmentSectionResults sections={detail.sectionResults} />
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-200/80 pt-3 sm:flex sm:flex-wrap print:hidden">
            <button type="button" onClick={onReview} disabled={reviewCount === 0} className={`${actionClass} border-emerald-600 bg-emerald-600 text-white disabled:border-gray-200 disabled:bg-gray-200 disabled:text-gray-500`}>
              <Eye size={17} /> {reviewCount ? `مراجعة الأسئلة (${reviewCount})` : 'المراجعة غير متاحة'}
            </button>
            {practiceURL && <Link to={practiceURL} className={`${actionClass} border-indigo-600 bg-indigo-600 text-white`}><PlusCircle size={17} /> اختبار تدريبي إضافي</Link>}
            {retryURL && <Link to={retryURL} className={`${actionClass} border-slate-200 bg-white text-slate-700`}><RefreshCw size={16} /> إعادة الاختبار</Link>}
            <button type="button" onClick={onMoreDetails} className={`${actionClass} border-indigo-200 bg-indigo-50 text-indigo-700`}><BarChart3 size={16} /> تفاصيل أكثر</button>
            <button type="button" onClick={onHistory} className={`${actionClass} border-slate-200 bg-white text-slate-700`}><History size={16} /> المحاولات السابقة</button>
          </div>
        </div>
      </section>
    </>
  );
}
