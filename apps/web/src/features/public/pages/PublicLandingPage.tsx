import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  GraduationCap,
  Radio,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import { dashboardPathFor } from '../../auth/utils/dashboard-path';

const showcase = [
  {
    title: 'استوديو التعلم والانطلاق الذكي',
    description: 'مساحة موحدة للدورات والتأسيس وملفات الدعم المعتمدة، مع انتقال مباشر من التعلم إلى القياس والمراجعة.',
    image: '/images/smart-learning-tablet.webp',
    alt: 'طالب منصة المئة يتدرب على التابلت مع مؤشرات حية',
    href: '/learning',
    label: 'مساحة التعلم',
  },
  {
    title: 'إتقان القدرات والمسائل الكمية',
    description: 'تأسيس وتدريب منظم حسب المسار والمادة، مع قياس يحافظ على مرجعية السؤال والمهارة.',
    image: '/images/daylight-qudrat-math.webp',
    alt: 'إتقان القدرات العامة والمسائل الكمية - منصة المئة',
    href: '/learning',
    label: 'مسار القدرات',
  },
  {
    title: 'مختبر التحصيلي العلمي',
    description: 'مساحة تعلم للرياضيات والفيزياء والكيمياء والأحياء مرتبطة بالمحتوى والاختبارات والمراجعة.',
    image: '/images/daylight-tahsili-science.webp',
    alt: 'مختبر التحصيلي العلمي - منصة المئة',
    href: '/learning',
    label: 'مسار التحصيلي',
  },
  {
    title: 'محاكاة الاختبارات والقياس',
    description: 'اختبارات ومحاولات ونتائج ومراجعة في رحلة واحدة، مع تصحيح ودرجة مصدرهما الخادم.',
    image: '/images/daylight-mock-simulation.webp',
    alt: 'محاكاة اختبارات قياس - منصة المئة',
    href: '/assessments',
    label: 'الاختبارات',
  },
];

const capabilities = [
  { icon: BookOpen, title: 'تعلم منظم', text: 'دورات، تأسيس، مكتبة، وخطة دراسة مرتبطة بالمسار والمادة.' },
  { icon: Target, title: 'قياس ومراجعة', text: 'اختبارات، نتائج، أخطاء محفوظة، وإعادة تدريب مبنية على الأدلة.' },
  { icon: BrainCircuit, title: 'تعلم تكيفي', text: 'جاهزية وخطوة تالية منطقية دون السماح للذكاء الاصطناعي بتغيير الدرجات.' },
  { icon: Radio, title: 'فصل ذكي', text: 'PIN وQR وأسئلة مباشرة وحضور وتحديات زمنية للمدارس المخولة.' },
  { icon: BarChart3, title: 'تقارير واضحة', text: 'تقارير حسب الدور والنطاق مع إبقاء حقائق النتائج في مصادرها الأصلية.' },
  { icon: ShieldCheck, title: 'صلاحيات دقيقة', text: 'كل قراءة وكتابة حساسة محكومة بالخادم وليس بإخفاء عناصر الواجهة.' },
];

export function PublicLandingPage({
  onAuth,
}: {
  onAuth(mode: 'login' | 'signup'): void;
}) {
  const { user } = useAuth();
  const startHref = user ? dashboardPathFor(user) : '';

  return (
    <main data-testid="public-landing" dir="rtl" className="overflow-x-hidden bg-white text-slate-900">
      <section className="relative isolate overflow-hidden bg-gradient-to-b from-amber-50 via-white to-indigo-50/50">
        <div className="pointer-events-none absolute -right-32 top-12 h-72 w-72 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-indigo-200/30 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-20">
          <div className="order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/90 px-3 py-1.5 text-xs font-black text-amber-700 shadow-sm">
              <Sparkles size={15} />
              المنصة الأولى للقدرات والتحصيلي
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.3] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              حقق <span className="text-amber-500">المئة</span> في اختباراتك
            </h1>
            <p className="mt-5 max-w-2xl text-base font-medium leading-8 text-slate-600 sm:text-lg">
              رحلة تعليمية ذكية تجمع بين التدريب المكثف، الشروحات التفاعلية، والتحليل الدقيق لنقاط ضعفك لضمان أعلى الدرجات.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              {user ? (
                <Link to={startHref} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-700">
                  افتح لوحتك
                  <ArrowLeft size={18} />
                </Link>
              ) : (
                <button type="button" onClick={() => onAuth('signup')} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-700">
                  ابدأ التدريب مجانًا
                  <ArrowLeft size={18} />
                </button>
              )}
              <Link to="/learning" className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-black text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700">
                تصفح مساحة التعلم
              </Link>
            </div>
            <div className="mt-7 grid max-w-xl grid-cols-2 gap-3 text-xs font-black text-slate-600 sm:grid-cols-3">
              {['تعلّم حسب المسار', 'اختبارات ومراجعة', 'متجاوب على كل الأجهزة'].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <div className="relative mx-auto max-w-xl">
              <div className="absolute inset-5 rounded-[2.5rem] bg-gradient-to-tr from-indigo-500/20 to-amber-400/30 blur-2xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-white bg-white p-2 shadow-2xl shadow-slate-200">
                <img
                  src={'/images/homepage-hero-boy-platform.webp'}
                  alt="طالب يستخدم منصة المئة"
                  className="aspect-[4/3] w-full rounded-[1.6rem] object-cover object-center"
                />
              </div>
              <div className="absolute -bottom-4 left-2 rounded-2xl border border-amber-100 bg-white px-4 py-3 shadow-xl sm:left-5">
                <div className="flex items-center gap-2">
                  <Trophy size={22} className="text-amber-500" />
                  <div>
                    <div className="text-sm font-black">منصة المئة</div>
                    <div className="text-[11px] font-bold text-slate-500">تعلم · قياس · مراجعة · تقدم</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="tracks" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-black text-indigo-600">رحلتك في مكان واحد</div>
          <h2 className="mt-2 text-3xl font-black text-slate-950 sm:text-4xl">من التأسيس إلى يوم الاختبار</h2>
          <p className="mt-3 text-sm font-medium leading-7 text-slate-500 sm:text-base">
            الواجهة تحافظ على هوية منصة المئة، بينما تستخدم المحركات الجديدة للمحتوى والاختبارات والمراجعة والفصل الذكي.
          </p>
        </div>
        <div className="mt-9 grid gap-5 sm:grid-cols-2">
          {showcase.map((item) => (
            <article key={item.title} className="group overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <div className="aspect-[16/9] overflow-hidden bg-slate-100">
                <img src={item.image} alt={item.alt} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
              </div>
              <div className="p-5 sm:p-6">
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-black text-indigo-700">{item.label}</span>
                <h3 className="mt-3 text-xl font-black">{item.title}</h3>
                <p className="mt-2 text-sm font-medium leading-7 text-slate-500">{item.description}</p>
                <Link to={item.href} className="mt-4 inline-flex items-center gap-1 text-sm font-black text-indigo-700">
                  استكشف الآن <ArrowLeft size={16} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="why" className="border-y border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[.85fr_1.15fr] lg:items-start">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-black text-emerald-700"><GraduationCap size={17}/>لماذا منصة المئة؟</div>
              <h2 className="mt-3 text-3xl font-black leading-tight">لماذا يختار الطلاب منصة المئة؟</h2>
              <p className="mt-4 text-sm font-medium leading-8 text-slate-600">
                نحن لا نقدم مجرد دورات، بل نقدم نظامًا تعليميًا متكاملًا يساعدك على الفهم العميق، التدريب المستمر، وتحليل الأداء بطريقة بسيطة وفعالة.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {capabilities.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><Icon size={20}/></div>
                  <h3 className="mt-3 font-black">{title}</h3>
                  <p className="mt-1 text-xs font-bold leading-6 text-slate-500">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-black text-amber-600">تجارب الطلاب</div>
          <h2 className="mt-2 text-3xl font-black text-slate-950">قصص نجاح نعتز بها</h2>
          <p className="mt-2 text-sm font-bold text-slate-500">انضم لآلاف الطلاب الذين حققوا أحلامهم معنا</p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { name: 'سارة العتيبي', degree: '98% قدرات', text: 'المنصة غيرت طريقة مذاكرتي تمامًا. تحليل نقاط الضعف ساعدني أركز جهدي في المكان الصح.' },
            { name: 'فهد الشمري', degree: '96% تحصيلي', text: 'الشروحات والتدريبات كانت مرتبة جدًا وواضحة، وحسيت فعلًا أن عندي خطة كاملة وليست مجرد دروس.' },
            { name: 'نورة السالم', degree: '99% قدرات', text: 'الاختبارات المحاكية كانت قريبة جدًا من الاختبار الحقيقي، وهذا رفع ثقتي قبل يوم الاختبار.' },
          ].map((item) => (
            <article key={item.name} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="text-4xl font-black leading-none text-indigo-100">“</div>
              <p className="mt-2 text-sm font-bold leading-7 text-slate-600">{item.text}</p>
              <div className="mt-5 border-t border-slate-100 pt-4">
                <div className="font-black text-slate-900">{item.name}</div>
                <div className="mt-1 text-xs font-black text-amber-600">{item.degree}</div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14 text-center sm:px-6">
        <div className="rounded-[2rem] bg-slate-950 px-5 py-10 text-white shadow-2xl sm:px-10">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 text-slate-950"><Trophy size={25}/></div>
          <h2 className="mt-4 text-3xl font-black">ابدأ رحلتك نحو المئة</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm font-medium leading-7 text-slate-300">
            افتح مساحة التعلم، قِس مستواك، وارجع للمراجعة والخطة من نفس الحساب.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            {user ? (
              <Link to={startHref} className="rounded-xl bg-amber-400 px-6 py-3 text-sm font-black text-slate-950">اذهب إلى لوحتي</Link>
            ) : (
              <>
                <button type="button" onClick={() => onAuth('signup')} className="rounded-xl bg-amber-400 px-6 py-3 text-sm font-black text-slate-950">إنشاء حساب جديد</button>
                <button type="button" onClick={() => onAuth('login')} className="rounded-xl border border-white/20 px-6 py-3 text-sm font-black">تسجيل الدخول</button>
              </>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-7 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <div className="font-black"><span className="text-blue-900">منصة</span> <span className="text-amber-500">المئة</span></div>
            <div className="mt-1 text-xs font-bold text-slate-400">قدرات & تحصيلي</div>
          </div>
          <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-500">
            <Link to="/about" className="hover:text-indigo-700">من نحن</Link>
            <Link to="/faq" className="hover:text-indigo-700">الأسئلة الشائعة</Link>
            <Link to="/contact" className="hover:text-indigo-700">تواصل معنا</Link>
            <Link to="/privacy" className="hover:text-indigo-700">سياسة الخصوصية</Link>
            <Link to="/terms" className="hover:text-indigo-700">شروط الاستخدام</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
