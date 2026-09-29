import {
  BarChart3,
  Bell,
  BookOpen,
  BrainCircuit,
  ChevronLeft,
  CircleDollarSign,
  HelpCircle,
  Radio,
  ShieldCheck,
  Tags,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';

const sections = [
  { to: '/admin-dashboard/content', title: 'المحتوى التعليمي', text: 'الدورات والدروس والتأسيس والمكتبة.', icon: BookOpen, tone: 'bg-indigo-50 text-indigo-700' },
  { to: '/admin-dashboard/taxonomy', title: 'المسارات والتصنيف', text: 'المسارات والمستويات والمواد والمهارات.', icon: Tags, tone: 'bg-blue-50 text-blue-700' },
  { to: '/admin-dashboard/questions', title: 'بنك الأسئلة', text: 'تأليف ومراجعة وتغطية واستيراد الأسئلة.', icon: HelpCircle, tone: 'bg-amber-50 text-amber-700' },
  { to: '/admin-dashboard/assessments', title: 'الاختبارات', text: 'التعريفات والإصدارات والنشر والتوزيع.', icon: BarChart3, tone: 'bg-purple-50 text-purple-700' },
  { to: '/admin-dashboard/commerce', title: 'التجارة والصلاحيات', text: 'المنتجات والدفع والاستحقاقات والأكواد.', icon: CircleDollarSign, tone: 'bg-emerald-50 text-emerald-700' },
  { to: '/admin-dashboard/notifications', title: 'الإشعارات', text: 'القوالب والحملات وحالة التسليم.', icon: Bell, tone: 'bg-rose-50 text-rose-700' },
  { to: '/admin-dashboard/classroom', title: 'الفصل الذكي', text: 'العقود والوحدات وتشغيل Realtime.', icon: Radio, tone: 'bg-cyan-50 text-cyan-700' },
  { to: '/admin-dashboard/ai', title: 'إدارة الذكاء الاصطناعي', text: 'الموفرون والجاهزية والاستخدام والتشخيص.', icon: BrainCircuit, tone: 'bg-violet-50 text-violet-700' },
  { to: '/admin-dashboard/reports', title: 'التقارير', text: 'التحليلات والتصدير حسب النطاق.', icon: BarChart3, tone: 'bg-sky-50 text-sky-700' },
  { to: '/admin-dashboard/operations', title: 'العمليات والتدقيق', text: 'جاهزية الإصدار والتدقيق والأدلة التشغيلية.', icon: ShieldCheck, tone: 'bg-slate-100 text-slate-700' },
];

export function AdminOverviewPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return <main dir="rtl" className="p-10 text-center font-black">جاري تحميل لوحة الإدارة...</main>;
  }
  if (!user || !user.roles.includes('admin')) {
    return <main dir="rtl" className="p-10 text-center font-black text-rose-700">هذه الصفحة مخصصة لمدير المنصة.</main>;
  }

  return (
    <main dir="rtl" className="space-y-5">
      <header className="rounded-[2rem] bg-gradient-to-l from-slate-950 via-slate-900 to-indigo-950 p-5 text-white shadow-xl sm:p-7">
        <div className="text-xs font-black text-amber-300">PLATFORM ADMIN</div>
        <h1 className="mt-2 text-2xl font-black sm:text-3xl">مركز إدارة منصة المئة</h1>
        <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-slate-300">
          مدخل موحد للأقسام المنقولة فعليًا. كل بطاقة تفتح وظيفة حقيقية وتبقى صلاحيات القراءة والكتابة محكومة بالخادم.
        </p>
      </header>

      <section aria-label="أقسام الإدارة" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map(({ to, title, text, icon: Icon, tone }) => (
          <Link key={to} to={to} className="group rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <div className={'flex h-11 w-11 items-center justify-center rounded-2xl ' + tone}><Icon size={21}/></div>
            <h2 className="mt-4 font-black text-slate-900">{title}</h2>
            <p className="mt-2 min-h-12 text-xs font-bold leading-6 text-slate-500">{text}</p>
            <div className="mt-4 inline-flex items-center gap-1 text-xs font-black text-indigo-700">فتح القسم <ChevronLeft size={15}/></div>
          </Link>
        ))}
      </section>

      <section className="rounded-3xl border border-amber-100 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 shrink-0 text-amber-700" size={20}/>
          <p className="text-sm font-bold leading-7 text-amber-950">
            الأقسام التي لا تملك مسار واجهة فعليًا بعد تظل ظاهرة في القائمة الجانبية تحت «أقسام قيد النقل» بدل فتح شاشة وهمية أو ادعاء اكتمالها.
          </p>
        </div>
      </section>
    </main>
  );
}
