import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Filter, Loader2, Search, User } from 'lucide-react';
import { useAuth } from '../../auth/state/AuthProvider';
import { getPublicCourses, type PublicCourse } from '../api/publicCourses';

interface DisplayCourse {
  id: string;
  title: string;
  instructorName: string;
  thumbnailUrl: string;
  category?: string;
  progress?: number;
  lessonsCount?: number;
}

export function CoursesPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'enrolled' | 'active' | 'completed'>('enrolled');
  const [searchQuery, setSearchQuery] = useState('');
  const [courses, setCourses] = useState<DisplayCourse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    async function load() {
      setIsLoading(true);
      try {
        const publicList = await getPublicCourses(controller.signal);
        if (mounted) {
          setCourses(publicList.map((c: PublicCourse) => ({
            id: c.id,
            title: c.title,
            instructorName: c.instructorName,
            thumbnailUrl: c.thumbnailUrl,
            category: 'عام',
            progress: 0,
            lessonsCount: 0,
          })));
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
  }, []);

  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return courses.filter((c) => {
      if (!q) return true;
      return (c.title || '').toLowerCase().includes(q) ||
        (c.category || '').toLowerCase().includes(q) ||
        (c.instructorName || '').toLowerCase().includes(q);
    });
  }, [courses, searchQuery]);

  const displayedCourses = useMemo(() => {
    if (activeTab === 'completed') return filteredCourses.filter((c) => (c.progress || 0) === 100);
    if (activeTab === 'active') return filteredCourses.filter((c) => (c.progress || 0) > 0 && (c.progress || 0) < 100);
    return filteredCourses;
  }, [activeTab, filteredCourses]);

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
          className="bg-white border border-gray-200 text-gray-600 px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors w-full sm:w-auto flex items-center justify-center shadow-xs cursor-pointer"
        >
          <Filter size={20} />
        </button>
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
          الدورات الملتحق بها
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
          الدورات النشطة
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
          الدورات المكتملة
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
          {displayedCourses.map((course) => (
            <div
              key={course.id}
              className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col"
            >
              {course.thumbnailUrl ? (
                <img
                  src={course.thumbnailUrl}
                  alt={course.title}
                  className="w-full h-44 object-cover"
                />
              ) : (
                <div className="w-full h-44 bg-gradient-to-br from-amber-50 to-blue-50 flex items-center justify-center text-amber-500">
                  <BookOpen size={40} />
                </div>
              )}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900 line-clamp-2 leading-snug">
                    {course.title}
                  </h3>
                  {course.instructorName && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                      <User size={14} />
                      <span>{course.instructorName}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">
                    {course.lessonsCount ? `${course.lessonsCount} درس` : 'محتوى متكامل'}
                  </span>
                  <Link
                    to={`/course/${encodeURIComponent(course.id)}`}
                    className="px-3.5 py-1.5 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-lg transition-colors"
                  >
                    عرض الدورة
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
