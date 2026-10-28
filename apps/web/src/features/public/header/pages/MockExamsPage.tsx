import { useStudentExperience } from '../../../learning/navigation/StudentNavigationProvider';
import { usePublicMocks } from './public-metadata';
import { mockPathSummary, visibleMockPaths } from './destination-model';
import { resolveIconComponent } from './educationalIcons';
import React from 'react';
import { Link } from 'react-router-dom';
import { Award, BookOpen, CheckCircle2, Clock, ListChecks, Target } from 'lucide-react';
import { Card } from './Card';

const renderPathIcon = (path: any) => {
  if (path?.icon || path?.iconUrl) {
    return path.iconUrl ? <img src={path.iconUrl} alt={path.name || 'مسار'} className="w-7 h-7 object-contain"/> : resolveIconComponent(path.icon, 'w-7 h-7 object-contain', '📚');
  }
  return (path?.name || '').includes('تحصيلي') ? <BookOpen size={28} /> : <Target size={28} />;
};

export const MockExamsPage: React.FC = () => {
  const experience = useStudentExperience();
  const {user,scope} = experience;
  const catalog = usePublicMocks();
  const paths = experience.paths.filter(scope.pathVisible);
  const mocks = catalog.items.filter(scope.matchesContent);
  const mockPaths = visibleMockPaths(paths, user.role);
  if(experience.loading || catalog.loading) return <div role="status" className="p-8 text-center">جاري تحميل المحاكيات...</div>;
  if(catalog.error || experience.error) return <div role="alert" className="p-8 text-center"><p>{catalog.error || experience.error}</p><button type="button" onClick={()=>experience.error?window.location.reload():catalog.reload()} className="mt-3 rounded-xl border px-4 py-2">إعادة المحاولة</button></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-indigo-600 px-4 py-8 text-center text-white sm:py-10">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
          <Award size={30} />
        </div>
        <h1 className="text-2xl font-black leading-tight sm:text-3xl">الاختبارات المحاكية</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm font-bold leading-6 text-indigo-100">
          اختر المسار المناسب، وستدخل لنفس صفحة المحاكيات الموجودة داخل المسار.
        </p>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        {mockPaths.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2">
            {mockPaths.map((path) => {
              const summary = mockPathSummary(mocks, path.id);
              const {totalQuestions,totalSections,nearestTime} = summary;
              const isReady = summary.count > 0;

              return (
                <Card key={path.id} className="h-full border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                        {renderPathIcon(path)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h2 className="text-xl font-black text-gray-900">{path.name}</h2>
                          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${isReady ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            <CheckCircle2 size={14} />
                            {isReady ? 'جاهز' : 'قريبًا'}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-bold text-gray-500">
                          {isReady ? 'محاكيات منشورة حسب المسار' : 'سيظهر هنا عند نشر أول محاكاة'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <Link
                        to={`/category/${path.id}?tab=mock-exams`}
                        className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white hover:bg-indigo-700"
                      >
                        فتح المحاكيات
                      </Link>
                      <details className="w-full sm:w-auto">
                        <summary className="cursor-pointer list-none rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-black text-gray-700 hover:bg-gray-50">
                          استعراض أكثر
                        </summary>
                        <div className="mt-2 rounded-2xl border border-gray-100 bg-gray-50 p-3">
                          <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-2xl bg-gray-50 p-3">
                        <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm">
                          <Award size={16} />
                        </div>
                        <div className="text-lg font-black text-gray-900">{summary.count}</div>
                        <div className="text-[11px] font-bold text-gray-500">اختبار</div>
                      </div>
                      <div className="rounded-2xl bg-gray-50 p-3">
                        <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm">
                          <ListChecks size={16} />
                        </div>
                        <div className="text-lg font-black text-gray-900">{totalQuestions}</div>
                        <div className="text-[11px] font-bold text-gray-500">سؤال</div>
                      </div>
                      <div className="rounded-2xl bg-gray-50 p-3">
                        <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-xl bg-white text-amber-600 shadow-sm">
                          <Clock size={16} />
                        </div>
                        <div className="text-lg font-black text-gray-900">{nearestTime || totalSections}</div>
                        <div className="text-[11px] font-bold text-gray-500">{nearestTime ? 'دقيقة' : 'قسم'}</div>
                      </div>
                          </div>
                        </div>
                      </details>
                    </div>
                  </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <h2 className="text-xl font-black text-gray-900">لا توجد مسارات محاكاة منشورة بعد</h2>
            <p className="mt-2 text-sm font-bold text-gray-500">
              عند تفعيل مسارات القدرات أو التحصيلي ستظهر هنا مباشرة.
            </p>
          </Card>
        )}
      </main>
    </div>
  );
};

export default MockExamsPage;
