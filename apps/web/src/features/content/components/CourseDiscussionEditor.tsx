import { useEffect, useMemo, useState } from 'react';
import { contentClient } from '../api/content-client';
import type { CourseDetail, CourseModule } from '../api/content-types';
import { CourseLessonDiscussion } from '../../learning/components/CourseLessonDiscussion';

export function CourseDiscussionEditor({ course, modules, getCsrfToken }: { course: CourseDetail; modules: CourseModule[]; getCsrfToken: () => Promise<string> }) {
  const [lessons, setLessons] = useState<Array<{id:string;title:string}>>([]);
  const [lessonId, setLessonId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const ready = course.workflowStatus === 'approved' && course.isPublished && course.isVisible;
  const allowedIds = useMemo(() => JSON.stringify([...new Set(modules.filter(module => module.status === 'active').flatMap(module => module.lessons.map(item => item.lessonId)))].sort()), [modules]);

  useEffect(() => {
    setLessonId(''); setLessons([]); setError('');
    if (!ready) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    contentClient.learnerCourse(course.id, controller.signal).then(({course: visible}) => {
      if (controller.signal.aborted) return;
      if (visible.id !== course.id || visible.pathId !== course.pathId || visible.subjectId !== course.subjectId || !Array.isArray(visible.modules)) throw new Error('تعذر التحقق من دروس هذه الدورة.');
      const permitted = new Set<string>(JSON.parse(allowedIds));
      const unique = new Map<string, {id:string;title:string}>();
      for (const module of visible.modules) for (const lesson of module.lessons) if (permitted.has(lesson.id)) unique.set(lesson.id, {id:lesson.id,title:lesson.title});
      setLessons([...unique.values()]);
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'تعذر تحميل دروس الدورة.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [course.id, course.pathId, course.subjectId, ready, allowedIds, retry]);

  if (!ready) return <p className="rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-800">تتاح مناقشات الدروس بعد اعتماد الدورة ونشرها وإظهارها.</p>;
  return <section className="space-y-4 rounded-2xl border bg-white p-5" aria-label="إدارة مناقشات الدروس">
    <div><h2 className="font-black text-gray-900">مناقشات الدروس</h2><p className="mt-1 text-xs text-gray-600">اختر درسًا منشورًا للاطلاع على مشاركات طلابه والرد عليها.</p></div>
    {loading ? <p className="text-sm text-gray-500">جارٍ تحميل دروس الدورة...</p> : error ? <div role="alert" className="text-sm text-rose-700">{error} <button type="button" className="underline" onClick={() => setRetry(value => value + 1)}>إعادة المحاولة</button></div> : lessons.length === 0 ? <p className="text-sm text-gray-500">لا توجد دروس منشورة متاحة للمناقشة في هذه الدورة.</p> : <>
      <label htmlFor="discussion-lesson" className="block text-sm font-bold">الدرس</label>
      <select id="discussion-lesson" value={lessonId} onChange={event => setLessonId(event.target.value)} className="w-full rounded-xl border p-3 text-sm"><option value="">اختر الدرس</option>{lessons.map(lesson => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}</select>
      {lessonId && <CourseLessonDiscussion key={`${course.id}:${lessonId}`} courseId={course.id} lessonId={lessonId} isDarkMode={false} getCsrfToken={getCsrfToken} />}
    </>}
  </section>;
}
