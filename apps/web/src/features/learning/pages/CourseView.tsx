import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react';

import { useAuth } from '../../auth/state/AuthProvider';
import { contentClient } from '../../content/api/content-client';
import type { LearnerCourse, CourseDetail, CourseModule } from '../../content/api/content-types';
import { CourseOverview, type CourseOverviewData, type TabType } from '../components/CourseOverview';
import { CourseLearningPage } from './CourseLearningPage';

export function CourseView() {
  const { courseId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const isPlaying = searchParams.get('learn') === '1';
  const requestedTab = (searchParams.get('tab') as TabType) || 'syllabus';

  const [courseData, setCourseData] = useState<CourseOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isStaffViewer = Boolean(
    user && (user.roles?.includes('admin' as any) || user.roles?.includes('platform_trainer' as any) || user.roles?.includes('school_teacher' as any)),
  );

  useEffect(() => {
    if (isPlaying) {
      // If directly playing, we don't necessarily need to block on overview loading
      return;
    }
    if (!courseId) {
      setLoading(false);
      setError('معرف الدورة غير صالح.');
      return;
    }

    let mounted = true;
    const controller = new AbortController();
    setLoading(true);
    setError('');

    async function loadCourse() {
      try {
        // Try learner course endpoint first
        const res = await contentClient.learnerCourse(courseId, controller.signal);
        if (!mounted) return;

        const lc = res.course;
        // Parse presentation metadata if any
        let presentation: any = {};
        try {
          if ((lc as any).presentation) {
            presentation = typeof (lc as any).presentation === 'string'
              ? JSON.parse((lc as any).presentation)
              : (lc as any).presentation;
          }
        } catch {
          // ignore
        }

        const overview: CourseOverviewData = {
          id: lc.id,
          title: lc.title,
          description: lc.description,
          instructorName: lc.instructorName || 'فريق المنصة',
          durationMinutes: lc.durationMinutes,
          level: lc.level,
          thumbnailAssetId: lc.thumbnailAssetId,
          thumbnailUrl: presentation.thumbnailUrl || (lc.thumbnailAssetId ? `/api/v1/assets/${lc.thumbnailAssetId}/raw` : undefined),
          category: presentation.category || 'القدرات العامة',
          certificateEnabled: lc.certificateEnabled,
          dripContentEnabled: lc.dripContentEnabled,
          price: presentation.price ?? 0,
          originalPrice: presentation.originalPrice ?? 0,
          currency: presentation.currency || 'ر.س',
          rating: presentation.rating || 4.9,
          studentsCount: presentation.studentsCount || 55,
          modules: lc.modules.map((m) => ({
            id: m.id,
            title: m.title,
            description: m.description,
            sortOrder: m.sortOrder,
            lessons: m.lessons.map((l) => ({
              id: l.id,
              title: l.title,
              description: l.description,
              type: l.type,
              durationSeconds: l.durationSeconds,
              isLocked: l.isLocked,
              isPreview: l.isPreview,
              commerceLocked: l.commerceLocked,
              sortOrder: l.sortOrder,
            })),
          })),
          files: presentation.files || [],
          assessments: presentation.assessments || [],
          features: presentation.features || [],
          objectives: presentation.objectives || [],
          access: lc.access,
        };

        setCourseData(overview);
      } catch (err: any) {
        // Fallback for staff or unapproved/draft courses preview
        try {
          const [cRes, mRes] = await Promise.all([
            contentClient.course(courseId, controller.signal),
            contentClient.courseModules(courseId, controller.signal),
          ]);
          if (!mounted) return;

          const cd: CourseDetail = cRes.course;
          const mods: CourseModule[] = mRes.modules;

          let presentation: any = {};
          try {
            if (cd.presentation) {
              presentation = typeof cd.presentation === 'string' ? JSON.parse(cd.presentation) : cd.presentation;
            }
          } catch {
            // ignore
          }

          const overview: CourseOverviewData = {
            id: cd.id,
            title: cd.title,
            description: cd.description,
            instructorName: cd.instructorName || 'فريق المنصة',
            durationMinutes: cd.durationMinutes,
            level: cd.level,
            thumbnailAssetId: cd.thumbnailAssetId,
            thumbnailUrl: presentation.thumbnailUrl || (cd.thumbnailAssetId ? `/api/v1/assets/${cd.thumbnailAssetId}/raw` : undefined),
            category: presentation.category || 'القدرات العامة',
            pathId: cd.pathId,
            subjectId: cd.subjectId,
            certificateEnabled: cd.certificateEnabled,
            dripContentEnabled: cd.dripContentEnabled,
            price: presentation.price ?? 0,
            originalPrice: presentation.originalPrice ?? 0,
            currency: presentation.currency || 'ر.س',
            rating: presentation.rating || 4.9,
            studentsCount: presentation.studentsCount || 55,
            modules: mods.map((m) => ({
              id: m.id,
              title: m.title,
              description: m.description,
              sortOrder: m.sortOrder,
              lessons: (m.lessons || []).map((lp, idx) => ({
                id: lp.lessonId,
                title: `درس ${idx + 1}`,
                type: 'video',
                sortOrder: lp.sortOrder,
                isPreview: lp.isPreview,
              })),
            })),
            files: presentation.files || [],
            assessments: presentation.assessments || [],
            features: presentation.features || [],
            objectives: presentation.objectives || [],
            access: {
              allowed: isStaffViewer,
              configured: true,
              reason: isStaffViewer ? 'staff_preview' : 'preview',
            },
          };

          setCourseData(overview);
        } catch (fallbackErr) {
          if (!mounted) return;
          setError('تعذر تحميل تفاصيل الدورة. تأكد من الرابط أو جرّب مرة أخرى.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadCourse();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [courseId, isPlaying, isStaffViewer]);

  // If in learning player mode (?learn=1), render player
  if (isPlaying) {
    return <CourseLearningPage />;
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !courseData) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center bg-slate-50 p-4 text-center" dir="rtl">
        <div className="max-w-md rounded-3xl border border-amber-100 bg-white p-8 shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <AlertCircle size={32} />
          </div>
          <h1 className="mb-3 text-xl sm:text-2xl font-black text-gray-900">لم نتمكن من فتح الدورة</h1>
          <p className="mb-6 text-sm leading-7 text-gray-500">{error || 'الدورة غير متاحة حالياً.'}</p>
          <button
            type="button"
            onClick={() => navigate('/courses')}
            className="w-full rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-black text-white hover:bg-indigo-700 sm:w-auto cursor-pointer"
          >
            العودة إلى قائمة الدورات
          </button>
        </div>
      </div>
    );
  }

  const handleContinue = (lessonId?: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('learn', '1');
    if (lessonId) next.set('lesson', lessonId);
    setSearchParams(next);
  };

  const handleTabChange = (tab: TabType) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'syllabus') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  return (
    <CourseOverview
      course={courseData}
      initialTab={requestedTab}
      onTabChange={handleTabChange}
      onContinue={handleContinue}
      isStaffViewer={isStaffViewer}
    />
  );
}
