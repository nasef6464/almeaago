import { BarChart3 } from 'lucide-react';
import { useId } from 'react';
import { Link } from 'react-router-dom';

import type { ResultDetail } from '../api/attempt-client';
import { resultFoundationPath } from '../navigation/resultFoundationPath';
import { AssessmentFoundationVideoAction } from './AssessmentFoundationVideoAction';

const actionClass = 'inline-flex rounded-xl border px-3 py-1.5 text-xs font-black sm:text-sm';

export function AssessmentFollowUpSkills({ detail, openAnalysis }: { detail: ResultDetail; openAnalysis: () => void }) {
  const heading = useId();
  const measured = detail.skillAnalysis?.complete ? detail.skillAnalysis.items : [];
  const focus = measured.filter(skill => skill.status !== 'strong').sort((a, b) => a.mastery - b.mastery);
  const reviewCount = detail.allowQuestionReview ? detail.questions?.length ?? 0 : 0;

  return (
    <section aria-labelledby={heading} className="rounded-3xl border border-gray-100 bg-white p-4 sm:p-5">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 id={heading} className="text-lg font-black text-gray-800">مهارات تحتاج متابعة</h2>
        <span className="self-start rounded-full bg-slate-50 px-3 py-1 text-xs font-black text-gray-500">{reviewCount} سؤال للمراجعة</span>
      </header>

      <div className="mt-4 grid gap-3">
        {focus.length > 0 ? focus.slice(0, 3).map(skill => {
          const topic = skill.pathId && skill.subjectId ? skill.foundationTopics?.[0] : undefined;
          const actionText = topic && skill.level === 'sub'
            ? topic.hasLesson && topic.hasPractice
              ? 'ابدأ بالشرح أولًا ثم نفّذ اختبارًا قصيرًا لقياس التحسن.'
              : topic.hasLesson
                ? 'هذه المهارة تحتاج مراجعة شرحها قبل أي تدريب إضافي.'
                : 'افتح موضوع التأسيس المرتبط بالمهارة ثم انتقل إلى تدريب المهارة الفرعية الجاهز.'
            : topic?.hasPractice
              ? 'ابدأ بالتدريب الجاهز المرتبط بهذه المهارة ثم أعد القياس.'
              : topic?.hasSupport
                ? 'راجع الملف الداعم ثم ارجع للتدريب المرتبط بنفس المهارة.'
                : 'أعد المحاولة عبر اختبار ساهر مخصص لهذه المهارة.';
          const priority = skill.mastery >= 60
            ? { label: 'راجعها اليوم', level: 'يحتاج بعض المراجعة', badge: 'bg-amber-50 text-amber-700', bar: 'bg-amber-500' }
            : { label: 'ابدأ هنا', level: 'يحتاج تركيزًا أكبر', badge: 'bg-rose-50 text-rose-700', bar: 'bg-rose-500' };
          return (
            <article key={`${skill.pathId}:${skill.subjectId}:${skill.skillId}`} className="rounded-2xl border border-gray-100 bg-white p-3 sm:p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${priority.badge}`}>{priority.label}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${priority.badge}`}>{priority.level} - {skill.mastery}%</span>
                {skill.questionCount > 1 && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{skill.questionCount} أسئلة</span>}
              </div>
              <h3 className="text-base font-black text-gray-900">{skill.skillName}</h3>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-black">
                {skill.subjectName && <span className="rounded-full bg-gray-50 px-3 py-1 text-gray-600">{skill.subjectName}</span>}
                {skill.sectionName && <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-600">{skill.sectionName}</span>}
              </div>
              <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2">
                <div className="text-[11px] font-black text-slate-500">الخطوة التالية</div>
                <p className="mt-1 text-xs font-bold leading-6 text-gray-600">{actionText}</p>
              </div>
              {(topic?.hasLesson || topic?.videoLessonId || topic?.hasPractice || topic?.hasSupport) && (
                <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-bold">
                  {topic.hasLesson && <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700">شرح مرتبط</span>}
                  {topic.videoLessonId && <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">فيديو شرح</span>}
                  {topic.hasPractice && <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">تدريب قصير</span>}
                  {topic.hasSupport && <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">ملف داعم</span>}
                </div>
              )}
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
                <div className={`h-full rounded-full ${priority.bar}`} style={{ width: `${skill.mastery}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {topic && (
                  <>
                    <Link to={resultFoundationPath(skill, topic.id, 'lessons')} className={`${actionClass} border-indigo-100 bg-indigo-50 text-indigo-700 hover:bg-indigo-100`}>راجع الشرح</Link>
                    {topic.videoLessonId && <AssessmentFoundationVideoAction key={`${topic.id}:${topic.videoLessonId}`} topicId={topic.id} lessonId={topic.videoLessonId} skillName={skill.skillName} />}
                    <Link to={resultFoundationPath(skill, topic.id, 'quizzes')} className={`${actionClass} border-amber-100 bg-amber-50 text-amber-700 hover:bg-amber-100`}>تدريب مناسب</Link>
                    {topic.hasSupport && <Link to={resultFoundationPath(skill, topic.id, 'support')} className={`${actionClass} border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100`}>ملف داعم</Link>}
                  </>
                )}
                <Link
                  to={`/reports?${new URLSearchParams({
                    ...(skill.pathId ? { pathId: skill.pathId } : {}),
                    ...(skill.subjectId ? { subjectId: skill.subjectId } : {}),
                    skillId: skill.skillId,
                  }).toString()}`}
                  className={`${actionClass} border-indigo-100 bg-white text-indigo-700 hover:bg-indigo-50`}
                >
                  تقرير المهارة
                </Link>
                <Link
                  to={`/book-session?${new URLSearchParams({
                    skillId: skill.skillId,
                    skillName: skill.skillName,
                    ...(skill.pathId ? { pathId: skill.pathId } : {}),
                    ...(skill.subjectId ? { subjectId: skill.subjectId } : {}),
                    ...(skill.subjectName ? { subjectName: skill.subjectName } : {}),
                    ...(skill.sectionName ? { sectionName: skill.sectionName } : {}),
                    source: 'quiz-result',
                  }).toString()}`}
                  className={`${actionClass} border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100`}
                >
                  احجز حصة للمهارة
                </Link>
              </div>
            </article>
          );
        }) : (
          <p className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
            {measured.length ? 'المهارات المقاسة متقنة؛ لا توجد أولوية تحسين في هذه المحاولة.' : 'لا توجد تفاصيل مهارية محفوظة لهذه المحاولة بعد.'}
          </p>
        )}
      </div>

      {focus.length > 3 && (
        <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-gray-100 bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-bold text-gray-600">توجد مهارات إضافية. نعرض أهم 3 فقط هنا.</p>
          <button type="button" onClick={openAnalysis} className="inline-flex items-center gap-1.5 self-start rounded-xl border border-indigo-100 bg-white px-3 py-1.5 text-xs font-black text-indigo-700"><BarChart3 size={14} /> عرض الكل</button>
        </div>
      )}
    </section>
  );
}
