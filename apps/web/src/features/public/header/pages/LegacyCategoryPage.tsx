import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Atom,
  Award,
  BookOpen,
  Calculator,
  ChevronRight,
  CreditCard,
  Dna,
  Feather,
  FlaskConical,
  GraduationCap,
  Languages,
  School,
  Sparkles,
  User,
} from 'lucide-react';

import { useStudentExperience, StudentPathAccessPrompt } from '../../../learning/navigation';
import { LearningSpacePage } from '../../../learning/pages/LearningSpacePage';
import { PathPackagesPage } from '../commerce/PathPackagesPage';
import { PathMockExamsPage } from './PathMockExamsPage';
import { getPublicCourses, type PublicCourse } from '../../api/publicCourses';

const normalizeArabic = (value?: string | null) =>
  (value || '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();

const pathAliases: Record<string, string[]> = {
  p_qudrat: ['القدرات', 'قدرات', 'qudrat'],
  p_tahsili: ['التحصيلي', 'تحصيلي', 'tahsili'],
  p_nafes: ['نافس', 'اختبارات نافس', 'اختبارت نافس', 'nafes'],
  p_step: ['ستيب', 'step'],
};

const themeColorMap: Record<string, string> = {
  purple: '#7c3aed',
  violet: '#7c3aed',
  blue: '#2563eb',
  sky: '#0284c7',
  cyan: '#0891b2',
  teal: '#0d9488',
  emerald: '#10b981',
  green: '#16a34a',
  amber: '#f59e0b',
  orange: '#ea580c',
  red: '#dc2626',
  indigo: '#4f46e5',
};

function resolveThemeColor(value?: string, fallback = '#4f46e5'): string {
  if (!value) return fallback;
  if (value.startsWith('#')) return value;
  return themeColorMap[value.toLowerCase()] || fallback;
}

function getSubjectIcon(subject: { name: string; iconUrl?: string }) {
  if (subject.iconUrl) {
    return <img src={subject.iconUrl} alt="" className="h-8 w-8 object-contain" />;
  }
  const norm = normalizeArabic(subject.name);
  if (norm.includes('كمي') || norm.includes('رياضيات') || norm.includes('math')) {
    return <Calculator size={26} />;
  }
  if (norm.includes('لفظي') || norm.includes('قراءه') || norm.includes('لغتي') || norm.includes('عربي')) {
    return <Feather size={26} />;
  }
  if (norm.includes('فيزياء') || norm.includes('علوم') || norm.includes('science')) {
    return <Atom size={26} />;
  }
  if (norm.includes('كيمياء') || norm.includes('chemistry')) {
    return <FlaskConical size={26} />;
  }
  if (norm.includes('احياء') || norm.includes('بيئه') || norm.includes('biology')) {
    return <Dna size={26} />;
  }
  if (norm.includes('انجليزي') || norm.includes('ستيب') || norm.includes('step')) {
    return <Languages size={26} />;
  }
  return <BookOpen size={26} />;
}

function getLevelIcon(level: { name: string; iconUrl?: string }) {
  if (level.iconUrl) {
    return <img src={level.iconUrl} alt="" className="h-8 w-8 object-contain" />;
  }
  const norm = normalizeArabic(level.name);
  if (norm.includes('ابتدائي') || norm.includes('ثالث') || norm.includes('سادس')) {
    return <GraduationCap size={26} />;
  }
  if (norm.includes('متوسط')) {
    return <School size={26} />;
  }
  if (norm.includes('ثانوي')) {
    return <Award size={26} />;
  }
  return <GraduationCap size={26} />;
}

function getSubjectThemeColor(subject: { name: string; color?: string }, fallback: string) {
  if (subject.color) return resolveThemeColor(subject.color, fallback);
  const norm = normalizeArabic(subject.name);
  if (norm.includes('كمي') || norm.includes('رياضيات')) return '#4f46e5'; // Indigo
  if (norm.includes('لفظي') || norm.includes('لغتي') || norm.includes('عربي')) return '#0d9488'; // Teal
  if (norm.includes('فيزياء') || norm.includes('علوم')) return '#7c3aed'; // Purple
  if (norm.includes('كيمياء')) return '#ea580c'; // Orange
  if (norm.includes('احياء') || norm.includes('بيئه')) return '#16a34a'; // Green
  return fallback;
}

export function LegacyCategoryPage() {
  const { pathId: raw = '' } = useParams<{ pathId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const experience = useStudentExperience();
  const [courses, setCourses] = useState<PublicCourse[]>([]);

  useEffect(() => {
    let active = true;
    getPublicCourses()
      .then((items) => {
        if (active) setCourses(items);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const path = experience.paths.find((row) => {
    if (row.id === raw || row.code === raw) return true;
    const aliases = pathAliases[raw] || [];
    const normName = normalizeArabic(row.name);
    return aliases.some((alias) => normName.includes(normalizeArabic(alias)));
  });

  if (experience.loading) {
    return (
      <main dir="rtl" role="status" className="p-16 text-center text-slate-500 font-bold">
        جاري تحميل المسار...
      </main>
    );
  }

  if (experience.error) {
    return (
      <main dir="rtl" role="alert" className="p-16 text-center text-rose-600 font-bold">
        {experience.error}
      </main>
    );
  }

  if (!path) {
    return (
      <main dir="rtl" role="alert" className="p-16 text-center">
        <h1 className="text-xl font-black text-slate-900">المسار غير موجود أو غير متاح.</h1>
        <p className="mt-2 text-sm text-slate-500 font-bold">تحقق من صحة الرابط أو اختر مساراً من القائمة العلوية.</p>
        <Link to="/" className="mt-5 inline-flex rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white">
          العودة للرئيسية
        </Link>
      </main>
    );
  }

  if (!experience.scope.pathVisible(path)) {
    return <StudentPathAccessPrompt path={path} />;
  }

  // Sub-views based on URL query
  if (params.get('tab') === 'packages') {
    return <PathPackagesPage pathId={path.id} />;
  }

  if (params.get('tab') === 'mock-exams') {
    return <PathMockExamsPage pathId={path.id} />;
  }

  const selectedSubjectId = params.get('subject') || params.get('subjectId');
  if (selectedSubjectId) {
    return <LearningSpacePage />;
  }

  const pathColor = resolveThemeColor(typeof path.color === 'string' ? path.color : undefined, '#4f46e5');
  const pathLevels = experience.levels.filter((l) => l.pathId === path.id);
  const selectedLevelId = params.get('level');

  const updateLevel = (levelId: string | null) => {
    const nextParams = new URLSearchParams(params);
    if (levelId) {
      nextParams.set('level', levelId);
    } else {
      nextParams.delete('level');
    }
    nextParams.delete('subject');
    nextParams.delete('subjectId');
    navigate(`/category/${encodeURIComponent(path.id)}?${nextParams.toString()}`);
  };

  const selectSubject = (subjectId: string, levelId?: string | null) => {
    const nextParams = new URLSearchParams();
    if (levelId) nextParams.set('level', levelId);
    nextParams.set('subject', subjectId);
    navigate(`/category/${encodeURIComponent(path.id)}?${nextParams.toString()}`);
  };

  const renderMockExamCard = () => (
    <Link
      key="mock-exams-card"
      to={`/category/${encodeURIComponent(path.id)}?tab=mock-exams`}
      className="group relative block min-h-[140px] rounded-3xl bg-indigo-600 p-5 text-center text-white shadow-md transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] overflow-hidden border border-white/15"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_55%)] pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 shadow-xs backdrop-blur-md group-hover:scale-110 group-hover:-rotate-3 group-hover:bg-white/30 transition-all duration-300 border border-white/15">
          <Award size={24} />
        </div>
        <h3 className="mb-1 text-xl font-black leading-tight">اختبارات محاكية</h3>
        <div className="text-xs font-bold text-white/80">تجربة كاملة للمسار</div>
      </div>
    </Link>
  );

  const renderPackageCard = () => (
    <Link
      key="packages-card"
      to={`/category/${encodeURIComponent(path.id)}?tab=packages`}
      className="group relative block min-h-[140px] rounded-3xl bg-emerald-600 p-5 text-center text-white shadow-md transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] overflow-hidden border border-white/15"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_55%)] pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 shadow-xs backdrop-blur-md group-hover:scale-110 group-hover:-rotate-3 group-hover:bg-white/30 transition-all duration-300 border border-white/15">
          <CreditCard size={24} />
        </div>
        <h3 className="mb-1 text-xl font-black leading-tight">عروض وباقات</h3>
        <div className="text-xs font-bold text-white/80">فتح محتوى المسار</div>
      </div>
    </Link>
  );

  // Scene 1: Path has levels, and no level is selected yet (e.g. initial نافس entry)
  if (pathLevels.length > 0 && !selectedLevelId) {
    return (
      <main dir="rtl" className="bg-gray-50 min-h-screen pb-20 font-sans">
        <header className="text-white py-8 sm:py-10 text-center relative overflow-hidden" style={{ backgroundColor: pathColor }}>
          <div className="max-w-7xl mx-auto px-4 relative z-10">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black mb-3 leading-tight break-words">{path.name}</h1>
            <p className="text-white/85 text-base sm:text-lg font-bold">اختر المرحلة الدراسية للبدء</p>
          </div>
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-12 left-8 h-32 w-32 rounded-full bg-white/10" />
        </header>

        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pathLevels.map((level) => (
              <div
                key={level.id}
                role="button"
                tabIndex={0}
                onClick={() => updateLevel(level.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    updateLevel(level.id);
                  }
                }}
                className="group relative block min-h-[140px] rounded-3xl p-5 text-center cursor-pointer text-white shadow-md transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] overflow-hidden border border-white/15"
                style={{ backgroundColor: pathColor }}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_55%)] pointer-events-none" />
                <div className="relative z-10 flex flex-col items-center">
                  <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 shadow-xs backdrop-blur-md group-hover:scale-110 group-hover:-rotate-3 group-hover:bg-white/30 transition-all duration-300 border border-white/15">
                    {getLevelIcon(level)}
                  </div>
                  <h3 className="mb-1 text-xl font-black leading-tight break-words">{level.name}</h3>
                  <div className="text-white/80 text-xs font-bold">مقررات وتأسيس المرحلة</div>
                </div>
              </div>
            ))}

            {renderMockExamCard()}
            {renderPackageCard()}
          </div>
        </div>
      </main>
    );
  }

  // Scene 2: Path has levels, and a specific level is selected
  if (pathLevels.length > 0 && selectedLevelId) {
    const currentLevel = pathLevels.find((l) => l.id === selectedLevelId);
    const levelSubjects = experience.subjects.filter(
      (s) => s.levelId === selectedLevelId && (s.pathId === path.id || !s.pathId),
    );

    return (
      <main dir="rtl" className="bg-gray-50 min-h-screen pb-20 font-sans">
        <header className="text-white py-6 sm:py-8 relative overflow-hidden" style={{ backgroundColor: pathColor }}>
          <div className="max-w-7xl mx-auto px-4 relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center text-[11px] font-bold bg-white/20 text-white px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                  مسار {path.name}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black leading-tight break-words">
                {currentLevel?.name || 'المرحلة المحددة'}
              </h1>
              <p className="text-white/85 text-xs sm:text-sm font-bold mt-1">اختر المادة للبدء في التدريب والتأسيس</p>
            </div>
            <div>
              <button
                type="button"
                onClick={() => updateLevel(null)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/15 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/25 backdrop-blur-sm"
              >
                <ChevronRight size={16} />
                <span>عودة لاختيار المرحلة</span>
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-4 py-12">
          {levelSubjects.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {levelSubjects.map((s) => {
                const sColor = getSubjectThemeColor(s, pathColor);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => selectSubject(s.id, selectedLevelId)}
                    className="group relative block min-h-[140px] rounded-3xl p-5 text-center text-white shadow-md transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] overflow-hidden border border-white/15 text-right cursor-pointer"
                    style={{ backgroundColor: sColor }}
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_55%)] pointer-events-none" />
                    <div className="relative z-10 flex flex-col items-center">
                      <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 shadow-xs backdrop-blur-md group-hover:scale-110 group-hover:-rotate-3 group-hover:bg-white/30 transition-all duration-300 border border-white/15">
                        {getSubjectIcon(s)}
                      </div>
                      <h3 className="mb-1 text-xl font-black leading-tight">{s.name}</h3>
                      <div className="text-white/85 text-xs font-bold flex gap-2 justify-center items-center">
                        <span>تأسيس</span>
                        <span className="text-white/40">•</span>
                        <span>نماذج</span>
                        <span className="text-white/40">•</span>
                        <span>تدريب</span>
                      </div>
                    </div>
                  </button>
                );
              })}

              {renderMockExamCard()}
              {renderPackageCard()}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-12 text-center text-gray-500 font-bold">
              لا توجد مواد منشورة مرتبطة بهذه المرحلة حالياً.
            </div>
          )}
        </div>
      </main>
    );
  }

  // Scene 3: Path does NOT have levels (e.g. القدرات، التحصيلي) -> display all subjects directly
  const pathSubjects = experience.subjects.filter((s) => s.pathId === path.id);

  return (
    <main dir="rtl" className="bg-gray-50 min-h-screen pb-20 font-sans">
      <header className="text-white py-8 sm:py-10 text-center relative overflow-hidden" style={{ backgroundColor: pathColor }}>
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-black text-white backdrop-blur-sm">
            <Sparkles size={13} className="text-amber-300" />
            مسار تعليمي معتمد
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black mb-3 leading-tight break-words">{path.name}</h1>
          <p className="text-white/85 text-base sm:text-lg font-bold">تأسيس شامل، تدريب مكثف، واختبارات محاكية</p>
        </div>
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-12 left-8 h-32 w-32 rounded-full bg-white/10" />
      </header>

      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pathSubjects.map((s) => {
            const sColor = getSubjectThemeColor(s, pathColor);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => selectSubject(s.id)}
                className="group relative block min-h-[140px] rounded-3xl p-5 text-center text-white shadow-md transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] overflow-hidden border border-white/15 text-right cursor-pointer"
                style={{ backgroundColor: sColor }}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_55%)] pointer-events-none" />
                <div className="relative z-10 flex flex-col items-center">
                  <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 shadow-xs backdrop-blur-md group-hover:scale-110 group-hover:-rotate-3 group-hover:bg-white/30 transition-all duration-300 border border-white/15">
                    {getSubjectIcon(s)}
                  </div>
                  <h3 className="mb-1 text-xl font-black leading-tight">{s.name}</h3>
                  <div className="text-white/85 text-xs font-bold flex gap-2 justify-center items-center">
                    <span>تأسيس</span>
                    <span className="text-white/40">•</span>
                    <span>نماذج</span>
                    <span className="text-white/40">•</span>
                    <span>تدريب</span>
                  </div>
                </div>
              </button>
            );
          })}

          {renderMockExamCard()}
          {renderPackageCard()}
        </div>

        {courses.length > 0 && (
          <section className="mt-16 border-t border-gray-200/80 pt-12">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900">أحدث الدورات في {path.name}</h2>
                <p className="text-xs text-slate-500 font-bold mt-0.5">شروحات وتدريبات مباشرة بإشراف نخبة من المدربين</p>
              </div>
              <Link to="/courses" className="text-xs font-black text-indigo-600 hover:text-indigo-700">
                عرض كل الدورات ←
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {courses.slice(0, 3).map((course) => (
                <div
                  key={course.id}
                  className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md"
                >
                  <img src={course.thumbnailUrl} alt={course.title} className="h-36 w-full object-cover" />
                  <div className="p-4">
                    <h3 className="font-black text-sm text-slate-900">{course.title}</h3>
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 font-bold">
                      <User size={13} />
                      <span>{course.instructorName}</span>
                    </div>
                    <Link
                      to={`/course/${encodeURIComponent(course.id)}`}
                      className="mt-4 block w-full rounded-xl bg-slate-100 py-2 text-center text-xs font-black text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition"
                    >
                      معاينة الدورة
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
