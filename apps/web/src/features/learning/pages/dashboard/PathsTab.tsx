import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  CheckCircle,
  Route as RouteIcon,
  ShoppingCart,
  Star,
  Target,
} from 'lucide-react';

import { Card } from '../../../public/header/pages/Card';
import { EmptyState } from '../../../public/header/commerce/EmptyState';
import { ProgressBar } from '../../components/ProgressBar';
import {
  PathEnrollmentButton,
  PathEnrollmentDialog,
  useStudentExperience,
} from '../../navigation';
import {
  resolvePathProgress,
  type DashboardCourse,
  type DashboardExamResult,
  type DashboardPath,
} from './pathProgressProjection';

const INITIAL_PATHS = [
  {
    id: '018f0000-0000-7000-8000-000000000030',
    code: 'QUDRAT',
    name: 'مسار القدرات العامة',
    description: 'تأسيس وتدريب شامل لاختبار القدرات العامة (كمي ولفظي)',
    isActive: true,
  },
  {
    id: 'd242dd63-2c42-54e1-81da-37322e5234a7',
    code: 'TAHSILI',
    name: 'مسار التحصيلي العلمي',
    description: 'تأسيس واختبارات محاكية لاختبار التحصيلي لطلاب العلمي',
    isActive: true,
  },
  {
    id: 'a5d9b9ec-625e-5eb1-87b9-0cd8f6073a44',
    code: 'NAFES',
    name: 'مسار اختبار نافس الوطني',
    description: 'اختبارات محاكية ومراجعات لمعايير الاختبارات الوطنية نافس',
    isActive: true,
  },
];

export interface PathsTabProps {
  paths?: Array<{
    id: string;
    name: string;
    code?: string;
    description?: string;
    isActive?: boolean;
    showInHome?: boolean;
    showInNavbar?: boolean;
  }>;
  courses?: DashboardCourse[];
  completedLessons?: string[];
  examResults?: DashboardExamResult[];
  className?: string;
}

export const PathsTab: React.FC<PathsTabProps> = ({
  paths: propPaths,
  courses = [],
  completedLessons = [],
  examResults = [],
  className = '',
}) => {
  const { paths: experiencePaths, enrolledPaths, unenrollPath, user } = useStudentExperience();
  const [searchParams] = useSearchParams();
  const forceEmpty = searchParams.get('empty') === '1';

  const canSeeHiddenPaths = ['admin', 'teacher', 'supervisor'].includes(user?.role || '');

  const effectivePaths = (propPaths && propPaths.length > 0)
    ? propPaths
    : (experiencePaths && experiencePaths.length > 0)
    ? experiencePaths
    : INITIAL_PATHS;

  const getPathStyle = (pathId: string, code?: string) => {
    const norm = (pathId || '').toLowerCase();
    const c = (code || '').toLowerCase();
    if (norm.includes('qudrat') || c.includes('qudrat') || norm === 'p_qudrat') {
      return { icon: <Target size={24} className="text-purple-500" />, bg: 'bg-purple-50', color: 'purple' };
    }
    if (norm.includes('tahsili') || c.includes('tahsili') || norm === 'p_tahsili') {
      return { icon: <BookOpen size={24} className="text-blue-500" />, bg: 'bg-blue-50', color: 'blue' };
    }
    if (norm.includes('nafes') || c.includes('nafes') || norm === 'p_nafes') {
      return { icon: <Star size={24} className="text-emerald-500" />, bg: 'bg-emerald-50', color: 'emerald' };
    }
    return { icon: <RouteIcon size={24} className="text-indigo-500" />, bg: 'bg-indigo-50', color: 'indigo' };
  };

  const dPaths = useMemo(() => {
    return (effectivePaths || [])
      .filter((p) => canSeeHiddenPaths || p.isActive !== false)
      .filter((p) => typeof p.id === 'string' && p.id.trim().length > 0 && typeof p.name === 'string' && p.name.trim().length > 0)
      .map((p) => {
        const code = typeof p.code === 'string' ? p.code : undefined;
        const description = typeof p.description === 'string' && p.description.trim().length > 0 ? p.description : `مسار ${p.name}`;
        return {
          id: p.id,
          name: p.name,
          code,
          title: p.name,
          description,
          category: p.name,
          ...getPathStyle(p.id, code),
        };
      });
  }, [effectivePaths, canSeeHiddenPaths]);

  const activePaths = useMemo(() => {
    if (forceEmpty) return [];
    const filtered = dPaths.filter((p) => enrolledPaths?.includes(p.id));
    if (filtered.length > 0) return filtered;
    // Default fallback so fresh student sessions retain active track view unless explicitly empty
    return dPaths.slice(0, 1);
  }, [forceEmpty, dPaths, enrolledPaths]);

  const availablePaths = useMemo(() => {
    const activeIds = new Set(activePaths.map((p) => p.id));
    return dPaths.filter((p) => !activeIds.has(p.id));
  }, [dPaths, activePaths]);

  return (
    <div className={`space-y-8 animate-fade-in ${className}`} dir="rtl">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">مساراتي التعليمية والخطط الدراسية</h2>
        <p className="text-gray-500 leading-relaxed">
          تابع تقدمك في مساراتك التعليمية المسجل بها، واستكشف مسارات تدريبية جديدة تناسب أهدافك مع إمكانية متابعة الدروس والاختبارات التأسيسية خطوة بخطوة.
        </p>
      </div>

      {/* Active Paths Section */}
      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <CheckCircle className="text-emerald-500" size={20} />
          المسارات الحالية المسجلة
        </h3>

        {activePaths.length > 0 ? (
          <div className="grid gap-6">
            {activePaths.map((path) => {
              const pathStats = resolvePathProgress(
                path as DashboardPath,
                courses.filter((course) => !course.isPackage),
                completedLessons,
                examResults
              );

              return (
                <Card
                  key={path.id}
                  data-testid={`active-path-card-${path.id}`}
                  className="p-6 border-2 border-transparent hover:border-gray-100 transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 ${path.bg}`}>
                        {path.icon}
                      </div>
                      <div>
                        <Link to={`/category/${path.id}`} className="hover:text-indigo-600 transition block">
                          <h3 className="font-bold text-xl text-gray-900 mb-1 hover:text-indigo-600">{path.title}</h3>
                        </Link>
                        <p className="text-sm text-gray-500">{path.description}</p>
                      </div>
                    </div>
                    <div className="flex-1 max-w-md w-full">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-bold text-gray-700">نسبة الإنجاز</span>
                        <span className="font-bold text-amber-500">{pathStats.progress}%</span>
                      </div>
                      <ProgressBar percentage={pathStats.progress} color="secondary" />
                      <p className="text-xs text-gray-400 mt-2 text-left">
                        {pathStats.coursesCount} دورات · {pathStats.examsCount} اختبارات محسوبة
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col gap-2">
                      <Link
                        to={`/category/${path.id}`}
                        className="bg-gray-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition-colors inline-block text-center w-full md:w-auto"
                      >
                        متابعة المسار
                      </Link>
                      <div data-testid={`unenroll-path-${path.id}`}>
                        <button
                          type="button"
                          data-testid="student-path-unenroll"
                          onClick={() => {
                            if (window.confirm(`هل تريد إلغاء التسجيل في مسار "${path.title}"؟ سيظل بإمكانك التسجيل فيه مرة أخرى لاحقًا.`)) {
                              void unenrollPath(path.id).catch((error) =>
                                window.alert(error instanceof Error ? error.message : 'تعذر حفظ التغيير؛ حاول مرة أخرى.')
                              );
                            }
                          }}
                          className="text-red-500 text-sm font-bold hover:text-red-600 transition-colors text-center w-full"
                        >
                          إلغاء التسجيل
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div data-testid="student-paths-empty-state">
            <EmptyState
              eyebrow="مساراتي"
              title="لم تقم بالتسجيل في أي مسار حالياً"
              description="ابدأ بتسجيل مسار واحد فقط، ثم تابع التأسيس والتدريب والتقارير من نفس المكان."
              icon={<RouteIcon size={22} />}
              primaryAction={{ label: 'استكشف المسارات', href: '/dashboard?tab=paths#available-paths', icon: <Target size={15} /> }}
              secondaryAction={{ label: 'راجع الباقات', href: '/pricing', icon: <ShoppingCart size={15} /> }}
              tone="indigo"
              className="bg-white"
            />
          </div>
        )}
      </div>

      {/* Available Paths Section */}
      {availablePaths.length > 0 && (
        <div id="available-paths">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Target className="text-indigo-500" size={20} />
            جميع المسارات المتاحة للتسجيل
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availablePaths.map((path) => (
              <Card key={path.id} className="p-6 flex flex-col h-full hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${path.bg}`}>
                  {path.icon}
                </div>
                <h3 className="font-bold text-lg text-gray-900 mb-2">{path.title}</h3>
                <p className="text-sm text-gray-500 mb-6 flex-1">{path.description}</p>
                <div data-testid={`enroll-path-btn-${path.id}`}>
                  <PathEnrollmentButton pathId={path.id} />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Modal Dialog for path enrollment selection */}
      <PathEnrollmentDialog />
    </div>
  );
};

export default PathsTab;
