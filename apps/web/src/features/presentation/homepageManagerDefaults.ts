import type { HomepageSettings } from './homepage-types';
import { defaultStudentSiteExperience } from './StudentExperienceSettings';
import { DEFAULT_AVATAR } from './defaultAvatar';
import { sanitizeHomepageSettings } from './homepageSanitizer';

const DEFAULT_HERO_BOY_IMAGE =
    '/images/homepage-hero-boy-platform.webp?v=20260512';

export const PLATFORM_PRESET_IMAGES = [
    // باقة استوديو المئة النهاري 3D
    { title: 'استوديو التابلت الذكي', pack: 'daylight', url: '/images/smart-learning-tablet.webp' },
    { title: 'بطل القدرات والكمي', pack: 'daylight', url: '/images/daylight-qudrat-math.webp' },
    { title: 'مختبر التحصيلي العلمي', pack: 'daylight', url: '/images/daylight-tahsili-science.webp' },
    { title: 'محاكاة قياس بالوقت', pack: 'daylight', url: '/images/daylight-mock-simulation.webp' },
    { title: 'المعلم الآلي الذكي AI', pack: 'daylight', url: '/images/daylight-ai-tutor.webp' },
    { title: 'فرحة الـ 100% والتفوق', pack: 'daylight', url: '/images/daylight-celebration-100.webp' },
    { title: 'حلبة التنافس المدرسي', pack: 'daylight', url: '/images/daylight-school-arena.webp' },

    // النمط السيبراني الليلي
    { title: 'بطل القدرات السيبراني', pack: 'neon', url: '/images/qudrat-champion.webp' },
    { title: 'شعلة التحصيلي العلمي', pack: 'neon', url: '/images/tahsili-excellence.webp' },
    { title: 'محاكاة قياس المحوسبة', pack: 'neon', url: '/images/mock-exam-simulation.webp' },
    { title: 'المساعد الذكي الفوري', pack: 'neon', url: '/images/ai-smart-tutor.webp' },
    { title: 'تتويج الـ 100% والقمة', pack: 'neon', url: '/images/score-celebration.webp' },
    { title: 'حلبة الفصول التفاعلية', pack: 'neon', url: '/images/classroom-arena.webp' },
];

export const defaultHomepageSettings: HomepageSettings = {
    key: 'default',
    studentExperience: defaultStudentSiteExperience,
    brand: {
        logoUrl: '',
        logoAlt: 'شعار منصة المئة',
        logoText: 'منصة',
        logoAccentText: 'المئة',
    },
    hero: {
        badgeText: 'المنصة الأولى للقدرات والتحصيلي',
        titlePrefix: 'حقق',
        titleHighlight: 'المئة',
        titleSuffix: 'في اختباراتك',
        description: 'رحلة تعليمية ذكية تجمع بين التدريب المكثف، الشروحات التفاعلية، والتحليل الدقيق لنقاط ضعفك لضمان أعلى الدرجات.',
        primaryCtaLabel: 'ابدأ التدريب مجانًا',
        primaryCtaLink: '/dashboard',
        secondaryCtaLabel: 'تصفح الدورات',
        secondaryCtaLink: '/courses',
        tertiaryCtaLabel: '',
        tertiaryCtaLink: '',
        badgeTextColor: '',
        titlePrefixColor: '',
        titleHighlightColor: '',
        titleSuffixColor: '',
        descriptionColor: '',
        primaryCtaColor: '',
        secondaryCtaColor: '',
        tertiaryCtaColor: '',
        imageUrl: DEFAULT_HERO_BOY_IMAGE,
        imageAlt: 'طالب يستخدم منصة المئة',
        galleryImages: [],
        autoRotateImages: true,
        rotateIntervalSeconds: 6,
        floatingCardTitle: 'منصة المئة',
        floatingCardSubtitle: 'مستواك: متقدم',
        floatingCardProgressLabel: 'التقدم',
        floatingCardProgressValue: '75%',
    },
    stats: [
        { id: 'students', label: 'طالب وطالبة', mode: 'dynamic', source: 'students', manualValue: '' },
        { id: 'courses', label: 'دورة تدريبية', mode: 'dynamic', source: 'courses', manualValue: '' },
        { id: 'assets', label: 'مادة تعليمية', mode: 'dynamic', source: 'assets', manualValue: '' },
        { id: 'rating', label: 'تقييم عام', mode: 'dynamic', source: 'rating', manualValue: '' },
    ],
    sections: {
        featuredCoursesTitle: 'الدورات الأكثر طلبًا',
        featuredCoursesSubtitle: 'اختر دورتك وابدأ رحلة التفوق اليوم',
        featuredArticlesTitle: 'مقالات ومراجعات مهمة',
        featuredArticlesSubtitle: 'اختر مجموعة مبسطة من المقالات والشروحات النصية لتظهر للزائر في الصفحة الرئيسية.',
        whyChooseTitle: 'لماذا يختار الطلاب منصة المئة؟',
        whyChooseDescription: 'نحن لا نقدم مجرد دورات، بل نقدم نظامًا تعليميًا متكاملًا يساعدك على الفهم العميق، التدريب المستمر، وتحليل الأداء بطريقة بسيطة وفعالة.',
        testimonialsTitle: 'قصص نجاح نعتز بها',
        testimonialsSubtitle: 'انضم لآلاف الطلاب الذين حققوا أحلامهم معنا',
    },
    typography: {
        headingFont: 'tajawal',
        bodyFont: 'tajawal',
        headingWeight: 'black',
    },
    navigation: {
        showAutoPaths: true,
        moreLabel: 'أخرى',
        items: [
            { id: 'home', label: 'الرئيسية', visible: true, order: 0 },
            { id: 'mock-exams', label: 'اختبارات محاكية', visible: true, order: 20 },
            { id: 'pricing', label: 'العضويات', visible: true, order: 90 },
            { id: 'blog', label: 'المدونة', visible: true, order: 100 },
        ],
    },
    testimonials: [
        { id: 't1', name: 'سارة العتيبي', degree: '98% قدرات', text: 'المنصة غيرت طريقة مذاكرتي تمامًا.', image: DEFAULT_AVATAR },
        { id: 't2', name: 'فهد الشمري', degree: '96% تحصيلي', text: 'الشروحات والتدريبات كانت مرتبة جدًا.', image: DEFAULT_AVATAR },
        { id: 't3', name: 'نورة السالم', degree: '99% قدرات', text: 'الاختبارات المحاكية كانت قريبة من الاختبار الحقيقي.', image: DEFAULT_AVATAR },
    ],
    featuredPathIds: [],
    featuredCourseIds: [],
    featuredArticleLessonIds: [],
};

export const mergeHomepageSettings = (settings: HomepageSettings): HomepageSettings => {
    const sanitized = sanitizeHomepageSettings(settings);
    return {
        ...defaultHomepageSettings,
        ...sanitized,
        studentExperience: { ...defaultStudentSiteExperience, ...sanitized.studentExperience },
        brand: { ...defaultHomepageSettings.brand, ...sanitized.brand },
        hero: { ...defaultHomepageSettings.hero, ...sanitized.hero },
        sections: { ...defaultHomepageSettings.sections, ...sanitized.sections },
        typography: { ...defaultHomepageSettings.typography, ...sanitized.typography },
        navigation: {
            ...defaultHomepageSettings.navigation,
            ...sanitized.navigation,
            items: sanitized.navigation?.items?.length ? sanitized.navigation.items : defaultHomepageSettings.navigation?.items,
        },
        stats: sanitized.stats?.length ? sanitized.stats : defaultHomepageSettings.stats,
        testimonials: sanitized.testimonials?.length ? sanitized.testimonials : defaultHomepageSettings.testimonials,
        featuredPathIds: sanitized.featuredPathIds || [],
        featuredCourseIds: sanitized.featuredCourseIds || [],
        featuredArticleLessonIds: sanitized.featuredArticleLessonIds || [],
    };
};
