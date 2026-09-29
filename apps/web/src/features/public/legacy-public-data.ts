export interface PlatformShowcaseItem {
  id:string;
  title:string;
  subtitle:string;
  url:string;
  alt:string;
  badge:string;
  badgeColor:string;
  link:string;
  cta:string;
  description:string;
  pack:'daylight'|'neon';
}

export interface PublicArticle {
  id:string;
  title:string;
  summary:string;
  category:string;
  readTime:string;
  authorName:string;
  authorRole:string;
  content:string[];
  keyTakeaway:string;
}

export interface PublicTestimonial {
  id:string;
  name:string;
  degree:string;
  text:string;
  image:string;
}

export const LEGACY_HERO_GALLERY = [
  {url:'/images/homepage-hero-boy-platform.webp',alt:'طالب يستخدم منصة المئة'},
  {url:'/images/smart-learning-tablet.webp',alt:'طالب منصة المئة يتدرب على التابلت مع مؤشرات حية'},
  {url:'/images/daylight-qudrat-math.webp',alt:'إتقان القدرات العامة والمسائل الكمية - منصة المئة'},
  {url:'/images/daylight-tahsili-science.webp',alt:'مختبر التحصيلي العلمي - منصة المئة'},
  {url:'/images/daylight-mock-simulation.webp',alt:'محاكاة اختبارات قياس الحقيقية - منصة المئة'},
  {url:'/images/daylight-ai-tutor.webp',alt:'المعلم الآلي الذكي وحل الأسئلة - منصة المئة'},
  {url:'/images/daylight-celebration-100.webp',alt:'فرحة تحقيق الـ 100% والتفوق - منصة المئة'},
  {url:'/images/daylight-school-arena.webp',alt:'حلبة التنافس المدرسي والفصول الذكية - منصة المئة'},
] as const;

export const PLATFORM_DAYLIGHT_IMAGES:PlatformShowcaseItem[] = [
  {
    id:'daylight-tablet',title:'استوديو التعلم والإنطلاق الذكي',subtitle:'بيئة تدريب تفاعلية متطورة',
    url:'/images/smart-learning-tablet.webp',alt:'طالب منصة المئة يتدرب على التابلت مع مؤشرات حية',
    badge:'بيئة التعلم',badgeColor:'bg-blue-50 text-blue-700 border-blue-200',link:'/learning',cta:'ابدأ جلستك التدريبية',
    description:'واجهة تفاعلية تجمع بين حل الأسئلة، تتبع مؤشرات الأداء، والانطلاق السريع نحو أهدافك.',pack:'daylight',
  },
  {
    id:'daylight-qudrat',title:'إتقان القدرات والمسائل الكمية',subtitle:'شروحات وحلول ذهبية للمئة',
    url:'/images/daylight-qudrat-math.webp',alt:'إتقان القدرات العامة والمسائل الكمية - منصة المئة',
    badge:'مسار القدرات',badgeColor:'bg-indigo-50 text-indigo-700 border-indigo-200',link:'/learning',cta:'ابدأ تدريب القدرات',
    description:'نماذج ثلاثية الأبعاد واستراتيجيات حل المسائل الحسابية والهندسية بلمح البصر دون تعقيد.',pack:'daylight',
  },
  {
    id:'daylight-tahsili',title:'مختبر التحصيلي العلمي',subtitle:'فيزياء، كيمياء، أحياء، رياضيات',
    url:'/images/daylight-tahsili-science.webp',alt:'مختبر التحصيلي العلمي - منصة المئة',
    badge:'مسار التحصيلي',badgeColor:'bg-emerald-50 text-emerald-700 border-emerald-200',link:'/learning',cta:'استكشف التحصيلي',
    description:'تبسيط تجارب العلوم والمفاهيم المعقدة من خلال شروحات مرئية تفاعلية ترسخ الفهم في الذاكرة.',pack:'daylight',
  },
  {
    id:'daylight-mock',title:'محاكاة اختبارات قياس بالوقت',subtitle:'بيئة قياس الفعلية بالثانية',
    url:'/images/daylight-mock-simulation.webp',alt:'محاكاة اختبارات قياس الحقيقية - منصة المئة',
    badge:'محاكاة قياس',badgeColor:'bg-amber-50 text-amber-700 border-amber-200',link:'/assessments',cta:'خُض الاختبار التجريبي',
    description:'مؤقت دقيق، تصحيح فوري لكل قسم، ومحاكاة تامة لضغط ووقت الاختبار الحقيقي لتعتاد عليه.',pack:'daylight',
  },
  {
    id:'daylight-ai',title:'المعلم الآلي الذكي AI',subtitle:'معك لحظة بلحظة خطوة بخطوة',
    url:'/images/daylight-ai-tutor.webp',alt:'المعلم الآلي الذكي وحل الأسئلة - منصة المئة',
    badge:'معلم AI ذكي',badgeColor:'bg-purple-50 text-purple-700 border-purple-200',link:'/dashboard',cta:'جرّب المعلم الآلي',
    description:'روبوت تعليمي يحلل طريقة تفكيرك، يقترح لك حلولاً بديلة، ويقدم تلميحات ذكية حتى تصل للحل بنفسك.',pack:'daylight',
  },
  {
    id:'daylight-celebration',title:'التتويج بدرجة الـ 100%',subtitle:'الكأس الذهبي والقبول الجامعي',
    url:'/images/daylight-celebration-100.webp',alt:'فرحة تحقيق الـ 100% والتفوق - منصة المئة',
    badge:'طريق الـ 100%',badgeColor:'bg-amber-50 text-amber-700 border-amber-200',link:'/learning',cta:'انضم لرحلة التفوق',
    description:'احتفل بالنتيجة التي تستحقها وافتح أبواب كليات الطب والهندسة والعلوم المتقدمة بثقة كاملة.',pack:'daylight',
  },
  {
    id:'daylight-arena',title:'صالة التنافس المدرسي والفصول',subtitle:'تحديات فرق ومدارس الرياض والمملكة',
    url:'/images/daylight-school-arena.webp',alt:'حلبة التنافس المدرسي والفصول الذكية - منصة المئة',
    badge:'الفصول والمدارس',badgeColor:'bg-cyan-50 text-cyan-700 border-cyan-200',link:'/classroom/join',cta:'الفصول الذكية',
    description:'لوحات تفاعلية تجمع الطلاب في تحديات حماسية ترفع مستوى التحصيل لكافة الفصل والمدرسة.',pack:'daylight',
  },
];

export const PLATFORM_SHOWCASE_IMAGES:PlatformShowcaseItem[] = [
  {
    id:'qudrat',title:'بطل القدرات العامة',subtitle:'تأسيس وتدريب كمي ولفظي',
    url:'/images/qudrat-champion.webp',alt:'بطل القدرات العامة - منصة المئة',
    badge:'مسار القدرات',badgeColor:'bg-indigo-50 text-indigo-700 border-indigo-200',link:'/learning',cta:'ابدأ تدريب القدرات',
    description:'شروحات استراتيجيات الحل السريع للمسائل الكمية واستيعاب المقروء والتناظر اللفظي بأعلى دقة.',pack:'neon',
  },
  {
    id:'tahsili',title:'شعلة التحصيلي العلمي',subtitle:'فيزياء، كيمياء، أحياء، رياضيات',
    url:'/images/tahsili-excellence.webp',alt:'شعلة التحصيلي العلمي - منصة المئة',
    badge:'مسار التحصيلي',badgeColor:'bg-emerald-50 text-emerald-700 border-emerald-200',link:'/learning',cta:'استكشف التحصيلي',
    description:'تغطية شاملة ومفاهيم مركزة تضمن إتقان مقررات المرحلة الثانوية العلمية وتحقيق أعلى الدرجات.',pack:'neon',
  },
  {
    id:'mock-exams',title:'محاكاة قياس المحوسبة',subtitle:'بيئة اختبار حقيقية بالوقت والتصحيح',
    url:'/images/mock-exam-simulation.webp',alt:'محاكاة اختبارات قياس الحقيقية - منصة المئة',
    badge:'محاكاة قياس',badgeColor:'bg-blue-50 text-blue-700 border-blue-200',link:'/assessments',cta:'خُض الاختبار التجريبي',
    description:'اختبارات محاكاة ذكية بمؤقت زمني دقيق، وتحليل فوري للدرجات.',pack:'neon',
  },
  {
    id:'ai-tutor',title:'المساعد الذكي الفوري',subtitle:'ذكاء اصطناعي متخصص في القياس',
    url:'/images/ai-smart-tutor.webp',alt:'المساعد الذكي وحل المسائل - منصة المئة',
    badge:'ذكاء اصطناعي AI',badgeColor:'bg-purple-50 text-purple-700 border-purple-200',link:'/dashboard',cta:'جرّب المساعد الذكي',
    description:'حل المسائل خطوة بخطوة، توضيح فوري للأخطاء، وتوصيات مخصصة لسد الفجوات التعليمية.',pack:'neon',
  },
  {
    id:'score-100',title:'تتويج الـ 100% والقمة',subtitle:'القبول الجامعي في كبرى التخصصات',
    url:'/images/score-celebration.webp',alt:'تتويج الـ 100% والقبول الجامعي - منصة المئة',
    badge:'طريق الـ 100%',badgeColor:'bg-amber-50 text-amber-700 border-amber-200',link:'/learning',cta:'انضم لرحلة التفوق',
    description:'برامج مكثفة ومتابعة نوعية حتى تكسر حاجز الدرجات الاستثنائية وتضمن مقعدك في أرقى الجامعات.',pack:'neon',
  },
  {
    id:'classroom',title:'حلبة الفصول التفاعلية',subtitle:'تنافس مدرسي وبطولات تفاعلية',
    url:'/images/classroom-arena.webp',alt:'حلبة الفصول التفاعلية ومسابقات القدرات - منصة المئة',
    badge:'الفصول الذكية',badgeColor:'bg-cyan-50 text-cyan-700 border-cyan-200',link:'/classroom/join',cta:'استكشف الفصول الذكية',
    description:'مسابقات مباشرة بين الطلاب والفصول، لوحات شرف حية، وروح تنافسية تشعل الحماس.',pack:'neon',
  },
];

export const DEFAULT_PUBLIC_TESTIMONIALS:PublicTestimonial[] = [
  {id:'t1',name:'سارة العتيبي',degree:'98% قدرات',text:'المنصة غيرت طريقة مذاكرتي تمامًا. تحليل نقاط الضعف ساعدني أركز جهدي في المكان الصح.',image:'https://i.pravatar.cc/100?img=5'},
  {id:'t2',name:'فهد الشمري',degree:'96% تحصيلي',text:'الشروحات والتدريبات كانت مرتبة جدًا وواضحة، وحسيت فعلًا أن عندي خطة كاملة وليست مجرد دروس.',image:'https://i.pravatar.cc/100?img=11'},
  {id:'t3',name:'نورة السالم',degree:'99% قدرات',text:'الاختبارات المحاكية كانت قريبة جدًا من الاختبار الحقيقي، وهذا رفع ثقتي قبل يوم الاختبار.',image:'https://i.pravatar.cc/100?img=9'},
];

export const DEFAULT_PUBLIC_ARTICLES:PublicArticle[] = [
  {
    id:'article-qudrat-foundations',
    title:'أسرار التأسيس في القدرات العامة (الكمي واللفظي) من الصفر حتى 100%',
    summary:'دليلك المتكامل للانطلاق من المفاهيم الأساسية وتجنب فخ الحفظ الأعمى، مع خطة مرحلية تبني استيعابك الرياضي واللغوي خطوة بخطوة.',
    category:'القدرات العامة',readTime:'6 دقائق',authorName:'د. خالد بن فهد',authorRole:'كبير مستشاري القياس والتقويم',
    content:[
      'يقع أغلب الطلاب في خطأ فادح عند بدء الاستعداد لاختبار القدرات العامة: القفز المباشر إلى حل مئات التجميعات ونماذج الاختبارات السابقة دون بناء قاعدة صلبة.',
      'في القسم الكمي، ابدأ بالعمليات الحسابية الذهنية، الكسور والنسب المئوية، الجذور والأسس، وتطبيقات الهندسة الأساسية.',
      'أما في القسم اللفظي، فالسر يكمن في فك شفرة العلاقات في التناظر اللفظي وتطوير مهارة القراءة السريعة المستوعبة.',
    ],
    keyTakeaway:'لا تبدأ في حل النماذج والتجميعات قبل أن تتقن مهارات التأسيس الأساسية.',
  },
  {
    id:'article-time-management-secrets',
    title:'التكنيك الذهبي لإدارة وقت اختبار القدرات المحوسب والورقي',
    summary:'كيف تدير الـ 60 ثانية المخصصة لكل سؤال بذكاء، وتقنية الجولات الثلاث التي تضمن لك الإجابة على كافة الأسئلة ومراجعتها بدقة.',
    category:'استراتيجيات الحل',readTime:'5 دقائق',authorName:'أ. سامي العتيبي',authorRole:'مدرب معتمد لاختبارات قياس',
    content:[
      'الوقت هو الخصم الحقيقي في اختبار القدرات، والدرجة العالية تعكس كفاءتك في إدارة دقيقة واحدة لكل مسألة.',
      'طبّق استراتيجية الجولات الثلاث: الحل الفوري، التفكير الموجه، ثم الاستبعاد الذكي.',
      'تدرب أسبوعياً على اختبارات محاكية مضبوطة بمؤقت حقيقي لتعتاد على ضغط الوقت.',
    ],
    keyTakeaway:'السر في إدارة الوقت هو الشجاعة في تخطي السؤال المعقد والعودة إليه لاحقاً.',
  },
  {
    id:'article-qudrat-vs-tahsili',
    title:'الفروق الجوهرية بين القدرات والتحصيلي: متى تبدأ الاستعداد لكل منهما؟',
    summary:'مقارنة دقيقة وشاملة بين طبيعة قياس المهارات الذهنية في القدرات والمحتوى الأكاديمي في التحصيلي، مع خطة توقيت مثالية للثانوية.',
    category:'التحصيلي العلمي',readTime:'7 دقائق',authorName:'د. منيرة القحطاني',authorRole:'مشرفة التوجيه الأكاديمي والجامعي',
    content:[
      'اختبار القدرات العامة اختبار مهاري تراكمي لا يرتبط بمنهج دراسي معين، بينما التحصيلي اختبار معرفي أكاديمي.',
      'الموعد الأمثل لبدء تأسيس القدرات مبكراً، ثم تكثيف التحصيلي في المرحلة المناسبة.',
      'منصة المئة تفصل بين مسارات مهارات القياس وبين خرائط المفاهيم والمراجعات العلمية.',
    ],
    keyTakeaway:'أنهِ ملف القدرات مبكراً لتتفرغ للتحصيلي ومعدلك التراكمي.',
  },
];
