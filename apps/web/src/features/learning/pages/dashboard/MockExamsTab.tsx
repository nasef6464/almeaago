import React, { useEffect, useState } from 'react';
import { Activity, Award, CheckCircle2, Clock, FileText, Loader2, Play, ShieldAlert, Star, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { assessmentPlacementClient } from '../../../assessment/api/assessment-placement-client';
import type { LearnerAssessmentPlacement } from '../../../assessment/api/assessment-types';

export const MockExamsTab: React.FC = () => {
  const [exams, setExams] = useState<LearnerAssessmentPlacement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    assessmentPlacementClient
      .available({ page: 1, limit: 30, slot: 'tests', pathId: '', subjectId: '' }, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) {
          setExams(res.items || []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const mockList = exams.length > 0
    ? exams
    : [
        {
          placementId: 'mock-qudrat-1',
          title: 'اختبار محاكاة القدرات العامة (النموذج الشامل 1)',
          slot: 'tests' as const,
          maxAttempts: 3,
          attemptCount: 0,
          assessmentVersion: 1,
          accessAllowed: true,
          canStart: true,
          accessReason: '',
        },
        {
          placementId: 'mock-qudrat-2',
          title: 'اختبار محاكاة القدرات العامة (النموذج الشامل 2)',
          slot: 'tests' as const,
          maxAttempts: 3,
          attemptCount: 1,
          assessmentVersion: 1,
          accessAllowed: true,
          canStart: true,
          accessReason: '',
        },
        {
          placementId: 'mock-tahsili-1',
          title: 'اختبار محاكاة التحصيلي العلمي (شامل المواد الأربع)',
          slot: 'tests' as const,
          maxAttempts: 3,
          attemptCount: 0,
          assessmentVersion: 1,
          accessAllowed: true,
          canStart: true,
          accessReason: '',
        },
      ];

  return (
    <div className="space-y-6 animate-fade-in pb-16 w-full min-w-0" dir="rtl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black">
            <Star size={24} />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">الاختبارات المحاكية (قياس)</h2>
            <p className="text-xs sm:text-sm font-bold text-gray-500 dark:text-slate-400 mt-0.5">
              نماذج تحاكي بيئة اختبار المركز الوطني قياس بدقة مع مؤقت وتوزيع للأقسام.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 px-4 py-2 text-xs font-black text-amber-800 dark:text-amber-300">
          🎯 معايير وتوقيت المركز الوطني
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 font-bold text-gray-500 dark:text-slate-400">
          <Loader2 size={20} className="animate-spin text-amber-600" />
          جارٍ تحميل نماذج المحاكاة...
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {mockList.map((exam) => (
            <article
              key={exam.placementId}
              className="flex flex-col justify-between rounded-3xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs transition hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 px-3 py-1 text-xs font-black">
                    محاكاة رسمية
                  </span>
                  <span className="text-xs font-bold text-gray-400 dark:text-slate-500">
                    المحاولات: {exam.attemptCount} / {exam.maxAttempts}
                  </span>
                </div>

                <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white leading-snug">
                  {exam.title}
                </h3>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-bold text-gray-600 dark:text-slate-300">
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 p-2 border border-slate-100 dark:border-slate-700">
                    <Clock size={14} className="mx-auto mb-1 text-amber-600" />
                    <span>120 دقيقة</span>
                  </div>
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 p-2 border border-slate-100 dark:border-slate-700">
                    <FileText size={14} className="mx-auto mb-1 text-indigo-600" />
                    <span>100 سؤال</span>
                  </div>
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 p-2 border border-slate-100 dark:border-slate-700">
                    <Award size={14} className="mx-auto mb-1 text-emerald-600" />
                    <span>4 أقسام</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800">
                <Link
                  to={`/dashboard?tab=assessments&slot=tests`}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-600 py-3 px-4 text-xs sm:text-sm font-black text-white transition shadow-sm"
                >
                  <Play size={16} />
                  <span>بدء محاكاة الاختبار الآن</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
