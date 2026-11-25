import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, ChevronDown, ChevronUp, Filter, Loader2, Search, User } from 'lucide-react';
import { useAuth } from '../../auth/state/AuthProvider';
import {
  lessonProgressSummaryClient,
  type LearnerCourseModulePreview,
} from '../../learning/api/learning-client';
import { getPublicCourses, type PublicCourse } from '../api/publicCourses';

interface DisplayCourse {
  id: string;
  title: string;
  description?: string;
  instructorName: string;
  thumbnailUrl: string;
  category?: string;
  progress: number;
  lessonsCount: number;
  completedLessonsCount: number;
  isEnrolled: boolean;
  modules: LearnerCourseModulePreview[];
}

export function CoursesPage() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'enrolled' | 'active' | 'completed'>('enrolled');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [courses, setCourses] = useState<DisplayCourse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    let mounted = true;
    const controller = new AbortController();

    async function load() {
      setIsLoading(true);
      try {
        if (user && user.roles.includes('student')) {
          try {
            const res = await lessonProgressSummaryClient.coursesSummary(controller.signal);
            if (mounted && (res.courses?.length ?? 0) > 0) {
              setCourses(
                res.courses.map((c) => ({
                  id: c.id,
                  title: c.title,
                  description: c.description,
                  instructorName: c.instructorName,
                  thumbnailUrl: c.thumbnailUrl,
                  category: c.category || c.subjectName || c.pathName || '',
                  progress: c.progress,
                  lessonsCount: c.lessonsCount,
                  completedLessonsCount: c.completedLessonsCount,
                  isEnrolled: c.isEnrolled,
                  modules: c.modules || [],
                })),
              );
              return;
            }
          } catch {
            // Fall through to public courses when summary endpoint is unavailable
          }
        }
        const publicList = await getPublicCourses(controller.signal);
        if (mounted) {
          setCourses(
            publicList.map((c: PublicCourse) => ({
              id: c.id,
              title: c.title,
              instructorName: c.instructorName,
              thumbnailUrl: c.thumbnailUrl,
              category: '',
              progress: 0,
              lessonsCount: 0,
              completedLessonsCount: 0,
              isEnrolled: false,
              modules: [],
            })),
          );
        }
      } catch {
        if (mounted) setCourses([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [authLoading, user]);

  const categories = useMemo(
    () => Array.from(new Set(courses.map((c) => c.category).filter(Boolean) as string[])),
    [courses],
  );

  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return courses.filter((c) => {
      if (categoryFilter && c.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        (c.title || '').toLowerCase().includes(q) ||
        (c.category || '').toLowerCase().includes(q) ||
        (c.instructorName || '').toLowerCase().includes(q)
      );
    });
  }, [categoryFilter, courses, searchQuery]);

  const enrolledBase = useMemo(
    () =>
      user && user.roles.includes('student')
        ? filteredCourses.filter((c) => c.isEnrolled)
        : filteredCourses,
    [filteredCourses, user],
  );
  const activeCount = useMemo(
    () => enrolledBase.filter((c) => c.progress > 0 && c.progress < 100).length,
    [enrolledBase],
  );
  const completedCount = useMemo(
    () => enrolledBase.filter((c) => c.progress === 100 && c.lessonsCount > 0).length,
    [enrolledBase],
  );

  const displayedCourses = useMemo(() => {
    if (activeTab === 'completed') {
      return enrolledBase.filter((c) => c.progress === 100 && c.lessonsCount > 0);
    }
    if (activeTab === 'active') {
      return enrolledBase.filter((c) => c.progress > 0 && c.progress < 100);
    }
    return enrolledBase;
  }, [activeTab, enrolledBase]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6 pb-20 font-sans" dir="rtl">
      {/* Header */}
      <header className="flex items-start gap-3 sm:gap-4">
        <Link to="/" className="text-gray-500 hover:text-gray-700 p-1" aria-label="الرجوع للرئيسية">
          <ArrowRight size={24} />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 leading-tight">دوراتي</h1>
          <p className="text-sm text-gray-500">متابعة تقدمك في الدورات المسجلة</p>
        </div>
      </header>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث في دوراتي..."
            aria-label="البحث في الدورات"
            className="w-full pr-10 pl-4 py-3 rounded-xl border border-gray-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all text-sm"
          />
        </div>
        <button
          type="button"
          aria-label="خيارات فلترة الدورات"
          title="فلترة الدورات"
          onClick={() => setCategoryFilter('')}
          className="bg-white border border-gray-200 text-gray-600 px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors w-full sm:w-auto flex items-center justify-center shadow-xs cursor-pointer"
        >
          <Filter size={20} />
        </button>
        {categories.length > 0 && (
          <select
            aria-label="فلترة الدورات حسب التصنيف"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-white border border-gray-200 text-gray-700 px-4 py-3 rounded-xl text-sm font-bold shadow-xs"
          >
            <option value="">كل التصنيفات</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('enrolled')}
          className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'enrolled'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          الدورات الملتحق بها ({enrolledBase.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'active'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          الدورات النشطة ({activeCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('completed')}
          className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'completed'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          الدورات المكتملة ({completedCount})
        </button>
      </div>

      {/* Course List / Grid */}
      {displayedCourses.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-2xl border border-gray-100 p-8 space-y-3">
          <BookOpen className="mx-auto text-gray-300" size={48} />
          <h3 className="text-base font-bold text-gray-700">لا توجد دورات حالياً</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            {searchQuery ? 'لم يتم العثور على دورات تطابق كلمة البحث.' : 'لم تقم بالاشتراك في أي دورة بعد. يمكنك تصفح الدورات المتاحة على المنصة.'}
          </p>
          <Link
            to="/"
            className="inline-block mt-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm transition-colors shadow-xs"
          >
            تصفح المنصة
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedCourses.map((course) => {
            const isExpanded = expandedCourseId === course.id;
            return (
              <div
                key={course.id}
                onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}
                className={`bg-white rounded-2xl border overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col cursor-pointer ${
                  isExpanded ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-gray-200'
                }`}
              >
                {/* Image & Category */}
                <div className="relative h-44 bg-slate-900 group">
                  {course.thumbnailUrl ? (
                    <img
                      src={course.thumbnailUrl}
                      alt={course.title}
                      className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-950 to-slate-900 flex items-center justify-center text-amber-400">
                      <BookOpen size={44} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  {course.category && (
                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
                      <span className="rounded-full bg-black/60 backdrop-blur-xs px-2.5 py-1 text-[11px] font-bold text-amber-300">
                        {course.category}
                      </span>
                    </div>
                  )}
                  <div className="absolute top-3 left-3 text-white/80 bg-black/40 p-1 rounded-full">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                  {course.lessonsCount > 0 && (
                    <div className="absolute bottom-3 right-3 left-3 flex items-center justify-between text-xs text-white">
                      <span className="font-bold text-[11px]">
                        {course.completedLessonsCount} / {course.lessonsCount} درس
                      </span>
                      <span className="font-black text-amber-300 text-[11px]">{course.progress}%</span>
                    </div>
                  )}
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-base font-black text-gray-900 line-clamp-2 leading-snug">
                      {course.title}
                    </h3>
                    {course.instructorName && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-gray-500">
                        <User size={14} className="text-gray-400" />
                        <span>{course.instructorName}</span>
                      </div>
                    )}
                    {course.lessonsCount > 0 && (
                      <div className="mt-3 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full bg-amber-500" style={{ width: `${course.progress}%` }} />
                      </div>
                    )}
                  </div>

                  {/* Accordion Expanded Preview */}
                  {isExpanded && (
                    <div className="pt-3 border-t border-gray-100 text-xs text-gray-600 space-y-2 animate-fadeIn">
                      {course.modules.length > 0 ? (
                        <>
                          <p className="font-bold text-gray-800">محاور الدورة ({course.modules.length}):</p>
                          <ul className="space-y-1 list-disc pr-4 text-[11px] text-gray-600">
                            {course.modules.slice(0, 4).map((m) => (
                              <li key={m.id}>
                                {m.title} ({m.lessons.length} دروس)
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : course.description ? (
                        <p className="text-[11px] text-gray-600 leading-relaxed">{course.description}</p>
                      ) : (
                        <p className="text-[11px] text-gray-500">تفاصيل المنهج متاحة داخل صفحة الدورة.</p>
                      )}
                    </div>
                  )}

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500">
                      {course.lessonsCount > 0 ? `${course.lessonsCount} درس` : 'دورة معتمدة'}
                    </span>
                    <Link
                      to={`/course/${encodeURIComponent(course.id)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-colors shadow-xs"
                    >
                      {course.progress && course.progress > 0 ? 'مواصلة التعلم' : 'عرض تفاصيل الدورة'}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
