import {
  BarChart3,
  Bell,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  ChevronLeft,
  ClipboardCheck,
  Radio,
  Target,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';

const actions = [
  { to: '/learning', title: 'مساحة التعلم', text: 'الدورات والتأسيس والمكتبة حسب المسار والمادة.', icon: BookOpen, tone: 'bg-indigo-50 text-indigo-700' },
  { to: '/assessments', title: 'الاختبارات', text: 'الاختبارات المتاحة ومحاولات القياس المسموح بها.', icon: ClipboardCheck, tone: 'bg-blue-50 text-blue-700' },
  { to: '/review', title: 'المراجعة والإتقان', text: 'أخطاؤك ومحفوظاتك والخطوة التالية من أدلة تعلمك.', icon: BrainCircuit, tone: 'bg-purple-50 text-purple-700' },
  { to: '/plan', title: 'الخطة الدراسية', text: 'خطة يومية مرتبطة بالمحتوى والاختبارات الفعلية.', icon: CalendarDays, tone: 'bg-amber-50 text-amber-700' },
  { to: '/assessment-results', title: 'نتائجي', text: 'النتائج والتفاصيل المسموح بها بعد إنهاء المحاولة.', icon: Target, tone: 'bg-emerald-50 text-emerald-700' },
  { to: '/reports', title: 'تقريري', text: 'نظرة مجمعة على أدائك والمهارات التي تحتاج متابعة.', icon: BarChart3, tone: 'bg-cyan-50 text-cyan-700' },
  { to: '/classroom/join', title: 'الفصل الذكي', text: 'انضم للحصة بالرمز أو QR عندما يفتحها المعلم.', icon: Radio, tone: 'bg-rose-50 text-rose-700' },
  { to: '/notifications', title: 'الإشعارات', text: 'تابع ما وصلك من تنبيهات المنصة ضمن حسابك.', icon: Bell, tone: 'bg-slate-100 text-slate-700' },
];

export function StudentDashboardPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return <main dir="rtl" className="p-10 text-center font-black">جاري تحميل لوحة الطالب...</main>;
  }
  if (!user || !user.roles.includes('student')) {
    return <main dir="rtl" className="p-10 text-center font-black text-rose-700">هذه الصفحة مخصصة للطالب.</main>;
  }

  return (
    <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-slate-50 px-3 py-5 sm:px-6 sm:py-7">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="overflow-hidden rounded-[2rem] bg-gradient-to-l from-indigo-700 via-indigo-600 to-blue-600 p-5 text-white shadow-xl sm:p-8">
          <div className="text-xs font-black text-indigo-100">لوحة الطالب</div>
          <h1 className="mt-2 text-2xl font-black sm:text-4xl">أهلًا {user.name}</h1>
          <p className="mt-3 max-w-2xl text-sm font-bold leading-7 text-indigo-100">
            مساحتك التعليمية تجمع التعلم والاختبارات والمراجعة والخطة والتقارير من نفس الحساب، بدون نسخ حقيقة الدرجة أو الإتقان داخل الواجهة.
          </p>
        </header>

        <section aria-label="اختصارات الطالب" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map(({ to, title, text, icon: Icon, tone }) => (
            <Link key={to} to={to} className="group rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-indigo-100 hover:shadow-lg">
              <div className={'flex h-11 w-11 items-center justify-center rounded-2xl ' + tone}><Icon size={21}/></div>
              <h2 className="mt-4 font-black text-slate-900">{title}</h2>
              <p className="mt-2 min-h-12 text-xs font-bold leading-6 text-slate-500">{text}</p>
              <div className="mt-4 inline-flex items-center gap-1 text-xs font-black text-indigo-700">فتح <ChevronLeft size={15}/></div>
            </Link>
          ))}
        </section>

        <section className="rounded-3xl border border-amber-100 bg-amber-50 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <Target className="mt-0.5 shrink-0 text-amber-700" size={20}/>
            <div>
              <h2 className="font-black text-amber-950">ابدأ من المكان المناسب لك</h2>
              <p className="mt-1 text-sm font-bold leading-7 text-amber-900/70">
                لو أنت جديد ابدأ من مساحة التعلم. بعد أول قياس ستظهر لك النتائج والمراجعة والخطة من بياناتك الحقيقية.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
