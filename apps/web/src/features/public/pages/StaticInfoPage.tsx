import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, HelpCircle, Mail, ShieldCheck, Users, FileText } from 'lucide-react';

export type StaticInfoPageKind = 'about' | 'contact' | 'faq' | 'privacy' | 'terms';

interface StaticInfoPageProps {
  kind: StaticInfoPageKind;
}

const pageContent: Record<StaticInfoPageKind, {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  sections: Array<{ title: string; body: string }>;
}> = {
  about: {
    title: 'من نحن',
    subtitle: 'منصة المئة تجمع التعلم، التدريب، والاختبارات في تجربة واحدة للقدرات والتحصيلي.',
    icon: <Users size={24} />,
    sections: [
      {
        title: 'مهمتنا',
        body: 'نساعد الطالب على فهم مستواه، اختيار المسار المناسب، والتقدم عبر محتوى منظم واختبارات تقيس الأداء بوضوح.',
      },
      {
        title: 'ما نقدمه',
        body: 'مسارات تعليمية، دورات، اختبارات محاكية، تقارير أداء، ومتابعة ذكية تجعل قرار الدراسة التالي أوضح للطالب وولي الأمر.',
      },
    ],
  },
  contact: {
    title: 'تواصل معنا',
    subtitle: 'نستقبل استفسارات الدعم، الاشتراكات، والملاحظات من هذه الصفحة.',
    icon: <Mail size={24} />,
    sections: [
      {
        title: 'الدعم',
        body: 'يمكنك التواصل مع فريق المنصة من زر واتساب الظاهر في الصفحات العامة عند تفعيله، أو من خلال حسابك داخل المنصة.',
      },
      {
        title: 'طلبات الاشتراك',
        body: 'للاشتراكات والدفع، افتح صفحة العضويات أو السلة، ثم اختر طريقة الدفع المناسبة وسيتم تسجيل الطلب للمتابعة.',
      },
    ],
  },
  faq: {
    title: 'الأسئلة الشائعة',
    subtitle: 'إجابات مختصرة عن أكثر الأسئلة المتكررة حول استخدام المنصة.',
    icon: <HelpCircle size={24} />,
    sections: [
      {
        title: 'هل أحتاج حسابا للبدء؟',
        body: 'يمكنك تصفح الصفحات العامة بدون حساب، أما الاختبارات، التقارير، والدورات الخاصة فتحتاج تسجيل دخول.',
      },
      {
        title: 'كيف أتابع طلب الدفع؟',
        body: 'بعد إنشاء طلب الدفع يظهر في صفحة طلباتي، ويتم تفعيل الوصول بعد مراجعة الطلب واعتماده من الإدارة.',
      },
      {
        title: 'هل تظهر نتائجي تلقائيا؟',
        body: 'نعم، بعد إنهاء الاختبار تظهر النتيجة والتحليل حسب البيانات المتاحة في الاختبار والمسار.',
      },
    ],
  },
  privacy: {
    title: 'سياسة الخصوصية',
    subtitle: 'نوضح هنا نوع البيانات المستخدمة داخل المنصة والغرض منها.',
    icon: <ShieldCheck size={24} />,
    sections: [
      {
        title: 'بيانات الحساب',
        body: 'نستخدم بيانات الحساب لتسجيل الدخول، تخصيص المسارات، وحفظ نتائج الطالب وطلباته داخل المنصة.',
      },
      {
        title: 'بيانات التعلم',
        body: 'تستخدم نتائج الاختبارات والتفاعل مع المحتوى لإظهار التقارير والخطط المقترحة وتحسين تجربة التعلم.',
      },
      {
        title: 'الحماية',
        body: 'يتم تقييد الصفحات الخاصة خلف تسجيل الدخول، ولا تعرض نتائج الطالب أو طلباته للزوار.',
      },
    ],
  },
  terms: {
    title: 'الشروط والأحكام',
    subtitle: 'استخدام المنصة يعني الالتزام بهذه الإرشادات العامة.',
    icon: <FileText size={24} />,
    sections: [
      {
        title: 'استخدام الحساب',
        body: 'الحساب مخصص لصاحبه، ويجب استخدامه للوصول إلى المحتوى والاختبارات بطريقة نظامية.',
      },
      {
        title: 'المحتوى والاشتراكات',
        body: 'الوصول للمحتوى المدفوع أو الخاص يتم حسب الاشتراك أو الموافقة الإدارية على طلب الدفع.',
      },
      {
        title: 'التحديثات',
        body: 'قد يتم تحديث المحتوى، الأسعار، أو آليات الوصول لتحسين الخدمة وإبقاء التجربة مناسبة للطلاب.',
      },
    ],
  },
};

export const StaticInfoPage: React.FC<StaticInfoPageProps> = ({ kind }) => {
  const content = pageContent[kind];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10" dir="rtl">
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-indigo-700">
        <ArrowRight size={18} />
        العودة للرئيسية
      </Link>

      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
          {content.icon}
        </div>
        <h1 className="text-2xl font-black text-gray-950 sm:text-3xl">{content.title}</h1>
        <p className="mt-3 text-sm font-bold leading-7 text-gray-600 sm:text-base">{content.subtitle}</p>

        <div className="mt-8 space-y-4">
          {content.sections.map((section) => (
            <article key={section.title} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
              <h2 className="text-base font-black text-gray-900">{section.title}</h2>
              <p className="mt-2 text-sm font-bold leading-7 text-gray-600">{section.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

