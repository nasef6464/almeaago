import React from 'react';
import { GraduationCap, School, Backpack } from 'lucide-react';

export type EducationalStageKey = 'high' | 'middle' | 'primary';

export interface FeatureComparisonRow {
  name: string;
  description?: string;
  category: string;
  free: boolean | string;
  standard: boolean | string;
  pro: boolean | string;
}

export interface StageComparisonData {
  id: EducationalStageKey;
  label: string;
  targetAudience: string;
  decisionMakerNote: string;
  icon: React.ReactNode;
  tagline: string;
  tiers: {
    free: { title: string; price: string; subtitle: string };
    standard: { title: string; price: string; subtitle: string; popular?: boolean };
    pro: { title: string; price: string; subtitle: string; popular?: boolean; badge?: string };
  };
  features: FeatureComparisonRow[];
}

export const comparisonDataByStage: Record<EducationalStageKey, StageComparisonData> = {
  high: {
    id: 'high',
    label: 'المرحلة الثانوية',
    targetAudience: '15 - 18 سنة (قدرات • تحصيلي)',
    decisionMakerNote: 'مصمم لطلاب الثانوية لتحقيق أعلى درجات القبول الجامعي (90%+).',
    icon: React.createElement(GraduationCap, { className: 'w-5 h-5' }),
    tagline: 'تركيز صارم على قياس، استراتيجيات الحل السريع، وتوقيت الاختبارات الحقيقي',
    tiers: {
      free: {
        title: 'باقة التجربة المجانية',
        price: '0 ر.س',
        subtitle: 'تصفح عينات التأسيس ونموذج اختبار مصغر',
      },
      standard: {
        title: 'باقة التأسيس والتدريب',
        price: '99 ر.س',
        subtitle: 'شروحات تأسيسية كاملة وبنوك تدريبات مصنفة',
      },
      pro: {
        title: 'باقة التميز الشاملة (القدرات + التحصيلي)',
        price: '189 ر.س',
        subtitle: 'تأهيل كامل لمحاكاة قياس والتجميعات الحديثة',
        popular: true,
        badge: 'الأكثر طلباً للثانوي',
      },
    },
    features: [
      {
        category: 'المحتوى والتأسيس',
        name: 'شروحات التأسيس الشاملة (الكمي واللفظي)',
        description: 'شروحات تفصيلية لجميع القوانين والمفاهيم خطوة بخطوة',
        free: 'عينات مختارة',
        standard: true,
        pro: true,
      },
      {
        category: 'المحتوى والتأسيس',
        name: 'شروحات التحصيلي العلمي والأدبي',
        description: 'تغطية مناهج الرياضيات، الفيزياء، الكيمياء، والأحياء',
        free: false,
        standard: 'حسب المسار',
        pro: true,
      },
      {
        category: 'التدريب وبنوك الأسئلة',
        name: 'بنوك أسئلة وتدريبات تفاعلية مصنفة بالمهارة',
        description: 'تدرب على كل مهارة وقانون بشكل منفصل مع مؤشر إتقان',
        free: '50 سؤال تجريبي',
        standard: 'تدريب غير محدود',
        pro: 'تدريب غير محدود + ذكي',
      },
      {
        category: 'التدريب وبنوك الأسئلة',
        name: 'التجميعات الحديثة ونماذج 1446 - 1447هـ',
        description: 'تجميعات منقحة ومحدثة دورياً مع شرح الحلول',
        free: false,
        standard: 'تجميعات أساسية',
        pro: 'أحدث التجميعات الحصرية',
      },
      {
        category: 'محاكاة قياس والاختبارات',
        name: 'محاكيات قياس بالوقت الفعلي ونفس شاشة الاختبار',
        description: 'تجربة محاكاة تحاكي تماماً اختبار قياس الرسمي بالدقيقة',
        free: 'نموذج واحد مصغر',
        standard: '3 اختبارات تجريبية',
        pro: 'اختبارات محاكية كاملة وغير محدودة',
      },
      {
        category: 'محاكاة قياس والاختبارات',
        name: 'استراتيجيات الحل في أقل من دقيقة وسرعة الإنجاز',
        description: 'طرق الاستبعاد والتخمين الذكي والحل السريع',
        free: false,
        standard: true,
        pro: true,
      },
      {
        category: 'الذكاء الاصطناعي والدعم',
        name: 'تشخيص نقاط الضعف وتوقع النسبة المئوية',
        description: 'خوارزمية ذكية تقيم مستواك وتحدد المهارات المطلوب تقويتها',
        free: false,
        standard: 'تقرير إحصائي عام',
        pro: 'تشخيص تفصيلي فوري بالذكاء الاصطناعي',
      },
      {
        category: 'الذكاء الاصطناعي والدعم',
        name: 'خطة مذاكرة وجدول زمني شخصي حتى يوم الاختبار',
        description: 'خطة مقترحة بحسب موعد اختبارك المسجل في قياس',
        free: false,
        standard: false,
        pro: true,
      },
    ],
  },
  middle: {
    id: 'middle',
    label: 'المرحلة المتوسطة',
    targetAudience: '12 - 14 سنة (تأسيس • نافس)',
    decisionMakerNote: 'بناء متين في الرياضيات والعلوم واللغة، مع استعداد رسمي لاختبارات نافس الوطنية.',
    icon: React.createElement(School, { className: 'w-5 h-5' }),
    tagline: 'سد الفجوات التعليمية وتأسيس المهارات التراكمية لاجتياز نافس والتفوق المدرسي',
    tiers: {
      free: {
        title: 'الباقة المجانية الأساسية',
        price: '0 ر.س',
        subtitle: 'تصفح عينات الشروحات وتمارين استكشافية',
      },
      standard: {
        title: 'باقة المهارات والمواد الدراسية',
        price: '79 ر.س',
        subtitle: 'شروحات وتمارين تغطي المناهج والمهارات الأساسية',
      },
      pro: {
        title: 'باقة التفوق الوطني واختبارات نافس',
        price: '149 ر.س',
        subtitle: 'تأسيس متكامل + محاكاة نافس الوطنية لثالث متوسط',
        popular: true,
        badge: 'الأمثل لاختبار نافس',
      },
    },
    features: [
      {
        category: 'المحتوى والتأسيس',
        name: 'شروحات مبسطة لمفاهيم الرياضيات والعلوم',
        description: 'تفكيك المسائل الصعبة بطريقة بصرية تفاعلية',
        free: 'دروس تمهيدية',
        standard: true,
        pro: true,
      },
      {
        category: 'المحتوى والتأسيس',
        name: 'تأسيس القواعد ومهارات الفهم القرائي',
        description: 'بناء استيعاب المقروء وقواعد اللغة الأساسية',
        free: 'عينات محدودة',
        standard: true,
        pro: true,
      },
      {
        category: 'التدريب وبنوك الأسئلة',
        name: 'تمارين تفاعلية وواجبات تصحيح ذاتي فوري',
        description: 'تغذية راجعة فورية للطالب مع شرح أسباب الإجابة الصحيحة',
        free: '30 سؤال',
        standard: 'شامل لكل الدروس',
        pro: 'شامل + بنك الأسئلة المعيارية',
      },
      {
        category: 'محاكاة قياس والاختبارات',
        name: 'نماذج محاكاة اختبارات نافس الوطنية (الصف الثالث متوسط)',
        description: 'مطابقة لمعايير هيئة تقويم التعليم والتدريب',
        free: false,
        standard: 'نموذج تدريبي واحد',
        pro: 'نماذج نافس الوزارية الكاملة',
      },
      {
        category: 'محاكاة قياس والاختبارات',
        name: 'اختبارات تقييمية قبل الامتحانات المدرسية',
        description: 'مراجعات نهائية مركزة ليلة الاختبارات الفصلية',
        free: false,
        standard: true,
        pro: true,
      },
      {
        category: 'الذكاء الاصطناعي والدعم',
        name: 'تقارير متابعة أسبوعية لمستوى إنجاز الطالب',
        description: 'ملخص مرئي يوضح الوقت المستغرق والمعدل المكتسب',
        free: false,
        standard: 'تقرير إنجاز شهري',
        pro: 'تقارير أسبوعية تفصيلية لولي الأمر',
      },
      {
        category: 'الذكاء الاصطناعي والدعم',
        name: 'شارات تشجيعية ومكافآت الاستمرار',
        description: 'تحفيز مستمر للطالب للالتزام بالخطة دون ملل',
        free: 'شارات أساسية',
        standard: true,
        pro: true,
      },
    ],
  },
  primary: {
    id: 'primary',
    label: 'المرحلة الابتدائية',
    targetAudience: '6 - 11 سنة (براعم • نافس • أولياء الأمور)',
    decisionMakerNote: 'موجهة لولي الأمر والطفل معاً: بيئة آمنة محفزة، تحبب الطفل في التعلم وتؤسس قراءته وحسابه.',
    icon: React.createElement(Backpack, { className: 'w-5 h-5' }),
    tagline: 'تأسيس ممتع ومحفز للطفل، مع لوحة متابعة مريحة وشفافة لولي الأمر',
    tiers: {
      free: {
        title: 'باقة الاكتشاف المجانية',
        price: '0 ر.س',
        subtitle: 'ألعاب تعليمية تجريبية وأنشطة مبسطة',
      },
      standard: {
        title: 'باقة التأسيس الممتع',
        price: '69 ر.س',
        subtitle: 'تأسيس القراءة والحساب بأسلوب كرتوني وتفاعلي',
      },
      pro: {
        title: 'باقة براعم المئة الشاملة (تأسيس + نافس)',
        price: '129 ر.س',
        subtitle: 'كل التأسيس + تدريبات نافس للصفين 3 و 6 + بوابة ولي الأمر',
        popular: true,
        badge: 'الخيار المفضل لأولياء الأمور',
      },
    },
    features: [
      {
        category: 'بيئة التعلم والأمان',
        name: 'بيئة تعليمية آمنة 100% وخالية تماماً من المشتتات والإعلانات',
        description: 'واجهة نظيفة مناسبة لتركيز الأطفال دون أي محتوى خارجي',
        free: true,
        standard: true,
        pro: true,
      },
      {
        category: 'المحتوى والتأسيس',
        name: 'شروحات كرتونية وقصصية مبسطة للطفل',
        description: 'تبسيط ممتع لجدول الضرب والعمليات الحسابية واللغة',
        free: 'قصص تجريبية',
        standard: true,
        pro: true,
      },
      {
        category: 'المحتوى والتأسيس',
        name: 'دعم صوتي وتفاعلي لقراءة الأسئلة للأعمار المبكرة',
        description: 'مساعدة الأطفال الصغار على الاستماع للسؤال وحله بنقرة',
        free: false,
        standard: true,
        pro: true,
      },
      {
        category: 'التدريب وبنوك الأسئلة',
        name: 'ألعاب تعليمية ومكافآت ونقاط تميز تشجيعية',
        description: 'تحويل الواجبات والتمارين إلى تحديات تحفز حب التعلم',
        free: 'ألعاب محدودة',
        standard: 'مستوى الألعاب الكامل',
        pro: 'مستوى الألعاب الكامل + جوائز التميز',
      },
      {
        category: 'محاكاة قياس والاختبارات',
        name: 'نماذج اختبارات نافس الوطنية (الصف الثالث والسادس ابتدائي)',
        description: 'تدريب الطفل مسبقاً على أسئلة الفهم والرياضيات والعلوم',
        free: false,
        standard: false,
        pro: 'شامل نماذج نافس 3 و 6 ابتدائي',
      },
      {
        category: 'المتابعة وولي الأمر',
        name: 'بوابة متابعة ولي الأمر وتنبيهات التقدم على الجوال',
        description: 'معرفة مدى تقدم طفلك والنقاط التي تحتاج مساعدة منزلية',
        free: false,
        standard: 'إشعارات تقدم أساسية',
        pro: 'بوابة متابعة متكاملة وإشعار أسبوعي للوالدين',
      },
      {
        category: 'المتابعة وولي الأمر',
        name: 'شهادات تقدير وبطاقات إنجاز ملونة قابلة للطباعة',
        description: 'شهادات باسم الطفل عند إتمام كل مستوى لتعزيز ثقته بنفسه',
        free: false,
        standard: true,
        pro: true,
      },
    ],
  },
};
