import React, { useEffect, useState } from 'react';
import { BookOpen, ChevronLeft, GraduationCap, Loader2, PlayCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { contentClient } from '../../../content/api/content-client';
import type { LearnerCourseSummary } from '../../../content/api/content-types';

export const MyCoursesTab: React.FC = () => {
  const [courses, setCourses] = useState<LearnerCourseSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    contentClient
      .taxonomyCore(controller.signal)
      .then(async (tax) => {
        if (controller.signal.aborted) return;
        const allCourses: LearnerCourseSummary[] = [];
        for (const p of tax.paths.slice(0, 3)) {
          try {
            const space = await contentClient.learningSpace(p.id, '', 10, controller.signal);
            allCourses.push(...space.courses.items);
          } catch {}
        }
        setCourses(allCourses);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in pb-16 w-full min-w-0" dir="rtl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-violet-50 dark:bg-violet-950/70 text-violet-600 dark:text-violet-400 flex items-center justify-center font-black">
            <BookOpen size={24} />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">دوراتي التعليمية</h2>
            <p className="text-xs sm:text-sm font-bold text-gray-500 dark:text-slate-400 mt-0.5">
              الدورات والمحاضرات المسجل بها لمتابعة الدروس والتدريبات خطوة بخطوة.
            </p>
          </div>
        </div>

        <Link
          to="/dashboard?tab=paths"
          className="inline-flex items-center gap-1.5 rounded-2xl bg-violet-600 hover:bg-violet-700 px-5 py-2.5 text-xs sm:text-sm font-black text-white transition shadow-xs"
        >
          استعراض كل المسارات
          <ChevronLeft size={16} />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 font-bold text-gray-500 dark:text-slate-400">
          <Loader2 size={20} className="animate-spin text-violet-600" />
          جارٍ تحميل دوراتك...
        </div>
      ) : courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 dark:bg-violet-950/70 text-violet-500 mb-4">
            <GraduationCap size={32} />
          </div>
          <h3 className="text-base font-black text-gray-900 dark:text-white">لم تسجل في دورات بعد</h3>
          <p className="mt-1 text-xs font-bold text-gray-500 dark:text-slate-400 max-w-sm leading-6">
            سجل في مسار القدرات أو التحصيلي لتظهر دوراتك ومحاضراتك هنا فوراً.
          </p>
          <Link
            to="/dashboard?tab=paths"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 px-5 py-2.5 text-xs font-bold text-white transition shadow-xs"
          >
            اختر مسارك الآن
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <article
              key={course.id}
              className="flex flex-col rounded-3xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs transition hover:shadow-md hover:border-violet-200 dark:hover:border-slate-700"
            >
              <div className="relative h-44 bg-slate-100 dark:bg-slate-800 overflow-hidden">
                {course.thumbnailAssetId ? (
                  <img
                    src={`/api/v1/assets/${course.thumbnailAssetId}`}
                    alt={course.title}
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-950 dark:to-slate-900 text-violet-600 dark:text-violet-300">
                    <BookOpen size={48} className="opacity-40" />
                  </div>
                )}
                <div className="absolute top-3 right-3 rounded-full bg-black/60 backdrop-blur-xs px-3 py-1 text-[11px] font-bold text-white">
                  دورة تدريبية
                </div>
              </div>

              <div className="p-5 flex flex-col flex-1 justify-between">
                <div>
                  <h3 className="text-base font-black text-gray-900 dark:text-white leading-snug line-clamp-2">
                    {course.title}
                  </h3>
                  {course.description && (
                    <p className="mt-2 text-xs font-bold text-gray-500 dark:text-slate-400 line-clamp-2">
                      {course.description}
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-gray-100 dark:border-slate-800">
                  <Link
                    to={`/courses/${course.id}`}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 py-2.5 px-4 text-xs font-black text-white transition shadow-xs"
                  >
                    <PlayCircle size={16} />
                    <span>متابعة الدورة</span>
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
