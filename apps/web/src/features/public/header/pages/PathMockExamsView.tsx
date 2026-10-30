import {Link} from 'react-router-dom';
import {Award,ChevronRight,ChevronLeft,FileQuestion,Clock,Layers} from 'lucide-react';
import {Card} from './Card';
import {LearningCatalogCounters} from './LearningCatalogCounters';
import type {pathMockCatalog} from './path-mocks';
const themeColorMap: Record<string, string> = {
    purple: '#7c3aed',
    violet: '#7c3aed',
    blue: '#2563eb',
    sky: '#0284c7',
    cyan: '#0891b2',
    teal: '#0d9488',
    emerald: '#10b981',
    green: '#16a34a',
    lime: '#65a30d',
    yellow: '#ca8a04',
    amber: '#f59e0b',
    orange: '#ea580c',
    red: '#dc2626',
    rose: '#f43f5e',
    pink: '#db2777',
    fuchsia: '#c026d3',
    indigo: '#4f46e5',
    slate: '#475569',
    gray: '#6b7280',
};

const resolveThemeColor = (value?: string, fallback = '#4f46e5') => {
    if (!value) return fallback;
    if (value.startsWith('#')) return value;
    return themeColorMap[value.toLowerCase()] || fallback;
};

export type PathMockViewProps={path:{id:string;name:string;color?:string};subjects:{id:string;name:string}[];catalogView:ReturnType<typeof pathMockCatalog>;guest:boolean;isStudent:boolean;returnTo:string;starting:string;startError:string;onStart:(id:string)=>void;onBack:()=>void};
export function PathMockExamsView({path,subjects,catalogView,guest,isStudent,returnTo,starting,startError,onStart,onBack}:PathMockViewProps){
 const style={color:resolveThemeColor(path.color)};
        return (
            <div className="bg-gray-50 min-h-screen pb-20">
                <header className="text-white pt-12 pb-8 sm:pt-16 sm:pb-11 text-center relative overflow-hidden" style={{ backgroundColor: style.color }}>
                    <div className="max-w-7xl mx-auto px-4 relative z-10">
                        <button onClick={onBack} className="flex items-center gap-2 justify-center mx-auto text-white/80 hover:text-white mb-6 transition-colors">
                            <ChevronRight size={20} /> عودة للمسار
                        </button>
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-white">
                            <Award size={28} />
                        </div>
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black mb-4 leading-tight break-words">الاختبارات المحاكية - {path.name}</h1>
                        <p className="mx-auto max-w-2xl text-white/80 text-base sm:text-lg leading-8">
                            تجربة كاملة على مستوى المسار، منفصلة عن اختبارات كل مادة.
                        </p>
                    </div>
                </header>
                <div className="max-w-5xl mx-auto px-4 py-8">
                    {startError ? <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">{startError}</p> : null}
                    {catalogView.totals.count > 0 ? (
                        <div className="space-y-4">
                            <LearningCatalogCounters label="إحصاءات الاختبارات المحاكية" items={[
                                {label:'اختبار منشور',compactLabel:'الاختبارات',value:catalogView.totals.count},
                                {label:'سؤال داخل المحاكيات',compactLabel:'الأسئلة',value:catalogView.totals.questions},
                                {label:catalogView.totals.sections?'قسم اختبار':'دقيقة تقريبًا',compactLabel:catalogView.totals.sections?'الأقسام':'الدقائق',value:catalogView.totals.sections||catalogView.totals.minutes,tone:'amber'},
                            ]}/>
                            {catalogView.items.map((quiz) => {
                                const quizSubject = subjects.find((subject) => subject.id === quiz.subjectId);
                                const sectionCount = quiz.sectionCount;
                                return (
                                    <Card key={quiz.id} className="p-5 sm:p-6 border border-slate-200/90 rounded-2xl shadow-xs hover:border-indigo-300 hover:shadow-md transition-all bg-white">
                                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                            <div className="flex items-start sm:items-center gap-4">
                                                <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100/80 shadow-2xs">
                                                    <Award size={26} />
                                                </div>
                                                <div>
                                                    <h2 className="text-base sm:text-lg font-black leading-snug">
                                                        <span className="inline-block px-3 py-1 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-amber-950 dark:text-amber-100 font-extrabold shadow-2xs">
                                                            {quiz.title}
                                                        </span>
                                                    </h2>
                                                    <div className="mt-2.5 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                                                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100/90 border border-slate-200/60 px-2.5 py-1 text-slate-700">
                                                            <FileQuestion size={13} className="text-slate-500" />
                                                            {quiz.questionCount} سؤال
                                                        </span>
                                                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100/90 border border-slate-200/60 px-2.5 py-1 text-slate-700">
                                                            <Clock size={13} className="text-slate-500" />
                                                            {quiz.timeLimitSeconds / 60} دقيقة
                                                        </span>
                                                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 border border-indigo-100 px-2.5 py-1 text-indigo-700 font-black">
                                                            <Layers size={13} className="text-indigo-500" />
                                                            {sectionCount > 1 ? `${sectionCount} أقسام` : (quizSubject?.name || 'مسار كامل')}
                                                        </span>
                                                    </div>

                                                </div>
                                            </div>
                                            <div className="shrink-0 flex items-center gap-2 self-end md:self-center">
                                                {guest ? <Link to={`${returnTo}&auth=login`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 px-6 py-3 text-sm font-black text-white shadow-xs hover:shadow-md transition-all cursor-pointer">تسجيل الدخول لبدء الاختبار<ChevronLeft size={16}/></Link> : isStudent ? (
                                                    <button
                                                        type="button"
                                                        disabled={Boolean(starting) || !quiz.id}
                                                        onClick={() => onStart(quiz.id || '')}
                                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 px-6 py-3 text-sm font-black text-white shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-50"
                                                    >
                                                        <span>{starting === quiz.id ? 'جاري بدء الاختبار...' : 'ابدأ الاختبار'}</span>
                                                        <ChevronLeft size={16} />
                                                    </button>
                                                ) : <p className="text-sm font-bold text-gray-500">بدء الاختبار متاح لحساب الطالب.</p>}
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    ) : (
                        <Card className="p-8 text-center border-dashed border-2 border-gray-200">
                            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                                <Award size={26} />
                            </div>
                            <h2 className="text-xl font-black text-gray-900">لا توجد اختبارات محاكية منشورة بعد</h2>
                            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-gray-500">
                                عند إنشاء مركز المحاكيات المنفصل سيتم عرض اختبارات المسار هنا مباشرة.
                            </p>
                        </Card>
                    )}
                </div>
            </div>
        );

}
