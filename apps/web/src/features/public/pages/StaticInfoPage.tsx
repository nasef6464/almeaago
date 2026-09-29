import {
  ArrowRight,
  FileText,
  HelpCircle,
  Mail,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export type StaticInfoPageKind = 'about' | 'contact' | 'faq' | 'privacy' | 'terms';

const pageContent: Record<StaticInfoPageKind, {
  title: string;
  subtitle: string;
  icon: ReactNode;
  sections: Array<{ title: string; body: string }>;
}> = {
  about: {
    title: 'من نحن',
    subtitle: 'منصة المئة تجمع التعلم، التدريب، والاختبارات في تجربة واحدة للقدرات والتحصيلي.',
    icon: <Users size={24}/>,
    sections: [
      { title: 'مهمتنا', body: 'نساعد الطالب على فهم مستواه، اختيار المسار المناسب، والتقدم عبر محتوى منظم واختبارات تقيس الأداء بوضوح.' },
      { title: 'ما نقدمه', body: 'مسارات تعليمية، دورات، اختبارات محاكية، تقارير أداء، ومتابعة ذكية تجعل قرار الدراسة التالي أوضح للطالب وولي الأمر.' },
    ],
  },
  contact: {
    title: 'تواصل معنا',
    subtitle: 'نستقبل استفسارات الدعم، الاشتراكات، والملاحظات من هذه الصفحة.',
    icon: <Mail size={24}/>,
    sections: [
      { title: 'الدعم', body: 'يمكنك التواصل مع فريق المنصة من قناة الدعم المفعلة، أو من خلال حسابك داخل المنصة.' },
      { title: 'طلبات الاشتراك', body: 'طلبات الوصول والدفع تُسجل داخل مسار Commerce المعتمد، ولا يتم فتح المحتوى من الواجهة مباشرة.' },
    ],
  },
  faq: {
    title: 'الأسئلة الشائعة',
    subtitle: 'إجابات مختصرة عن أكثر الأسئلة المتكررة حول استخدام المنصة.',
    icon: <HelpCircle size={24}/>,
    sections: [
      { title: 'هل أحتاج حسابًا للبدء؟', body: 'يمكنك تصفح الصفحة العامة بدون حساب، أما الاختبارات والتقارير ومساحات التعلم الشخصية فتحتاج تسجيل دخول.' },
      { title: 'كيف أتابع طلب الدفع؟', body: 'بعد إنشاء طلب دفع من المنتج المخول يبقى الوصول خاضعًا لحالة الطلب والاستحقاق الموثق على الخادم.' },
      { title: 'هل تظهر نتائجي تلقائيًا؟', body: 'بعد إنهاء الاختبار تظهر النتيجة والتحليل وفق إعدادات الاختبار وصلاحية العرض المطبقة على الخادم.' },
    ],
  },
  privacy: {
    title: 'سياسة الخصوصية',
    subtitle: 'نوضح هنا نوع البيانات المستخدمة داخل المنصة والغرض منها.',
    icon: <ShieldCheck size={24}/>,
    sections: [
      { title: 'بيانات الحساب', body: 'نستخدم بيانات الحساب لتسجيل الدخول، تخصيص المسارات، وحفظ نتائج الطالب وطلباته داخل المنصة.' },
      { title: 'بيانات التعلم', body: 'تستخدم نتائج الاختبارات والتفاعل مع المحتوى لإظهار التقارير والخطط المقترحة وتحسين تجربة التعلم.' },
      { title: 'الحماية', body: 'يتم تقييد الصفحات الخاصة خلف تسجيل الدخول، ولا تعرض نتائج الطالب أو طلباته للزوار.' },
    ],
  },
  terms: {
    title: 'الشروط والأحكام',
    subtitle: 'استخدام المنصة يعني الالتزام بهذه الإرشادات العامة.',
    icon: <FileText size={24}/>,
    sections: [
      { title: 'استخدام الحساب', body: 'الحساب مخصص لصاحبه، ويجب استخدامه للوصول إلى المحتوى والاختبارات بطريقة نظامية.' },
      { title: 'المحتوى والاشتراكات', body: 'الوصول للمحتوى المدفوع أو الخاص يتم حسب الاستحقاق أو الموافقة الموثقة على طلب الدفع.' },
      { title: 'التحديثات', body: 'قد يتم تحديث المحتوى أو آليات الوصول لتحسين الخدمة وإبقاء التجربة مناسبة للطلاب.' },
    ],
  },
};

export function StaticInfoPage({ kind }: { kind: StaticInfoPageKind }) {
  const content = pageContent[kind];

  return (
    <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-slate-50 px-4 py-8 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <Link to="/" className="mb-5 inline-flex items-center gap-2 text-sm font-black text-slate-500 hover:text-indigo-700">
          <ArrowRight size={18}/>
          العودة للرئيسية
        </Link>
        <section className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">{content.icon}</div>
          <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">{content.title}</h1>
          <p className="mt-3 text-sm font-bold leading-7 text-slate-600 sm:text-base">{content.subtitle}</p>
          <div className="mt-7 space-y-3">
            {content.sections.map((section) => (
              <article key={section.title} className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                <h2 className="font-black text-slate-900">{section.title}</h2>
                <p className="mt-2 text-sm font-bold leading-7 text-slate-600">{section.body}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
