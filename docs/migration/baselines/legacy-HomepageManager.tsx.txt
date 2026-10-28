import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Image as ImageIcon, Plus, Save, Trash2, Upload, Megaphone, Sparkles, BarChart2, Layers, Star, ArrowLeft } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useStore } from '../../store/useStore';
import { HomepageSettings, HomepageStat, HomepageTestimonial } from '../../types';
import { sanitizeHomepageSettings } from '../../utils/sanitizeMojibakeArabic';
import { StudentSiteExperienceFields, defaultStudentSiteExperience } from './components/StudentExperienceSettings';
import { DEFAULT_AVATAR } from '../../utils/defaultAvatar';

const DEFAULT_HERO_BOY_IMAGE =
    '/images/homepage-hero-boy-platform.webp?v=20260512';

const PLATFORM_PRESET_IMAGES = [
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

const COLOR_SWATCHES = [
    '#111827',
    '#374151',
    '#64748b',
    '#ffffff',
    '#2563eb',
    '#1d4ed8',
    '#4f46e5',
    '#7c3aed',
    '#9333ea',
    '#db2777',
    '#e11d48',
    '#dc2626',
    '#ea580c',
    '#f59e0b',
    '#ca8a04',
    '#84cc16',
    '#16a34a',
    '#059669',
    '#0d9488',
    '#0891b2',
    '#0284c7',
    '#0f172a',
    '#78350f',
    '#14532d',
];

const defaultHomepageSettings: HomepageSettings = {
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

const mergeHomepageSettings = (settings: HomepageSettings): HomepageSettings => {
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

const withCacheBust = (value?: string) => {
    const raw = String(value || '').trim();
    if (!raw) return raw;
    if (raw.startsWith('data:')) return raw;
    const separator = raw.includes('?') ? '&' : '?';
    return `${raw}${separator}v=${Date.now()}`;
};

const normalizeColorPickerValue = (value: string, fallback = '#2563eb') => {
    const raw = String(value || '').trim();
    return /^#([0-9a-f]{6})$/i.test(raw) ? raw : fallback;
};

const createEmptyStat = (): HomepageStat => ({
    id: `stat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label: '',
    mode: 'manual',
    source: 'students',
    manualValue: '',
});

const createEmptyTestimonial = (): HomepageTestimonial => ({
    id: `testimonial_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    degree: '',
    text: '',
    image: '',
});

export const HomepageManager: React.FC = () => {
    const { logout } = useAuth();
    const { paths, courses, lessons, subjects, announcementAds } = useStore();
    const [settings, setSettings] = useState<HomepageSettings>(defaultHomepageSettings);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [courseSearch, setCourseSearch] = useState('');
    const [articleSearch, setArticleSearch] = useState('');
    const activeAdsCount = (announcementAds || []).filter((ad) => ad.isActive).length;

    useEffect(() => {
        let cancelled = false;

        const loadSettings = async () => {
            try {
                const response = await api.getHomepageSettings();
                if (!cancelled && response) {
                    setSettings(mergeHomepageSettings(response as HomepageSettings));
                }
            } catch (loadError) {
                if (!cancelled) {
                    setError(loadError instanceof Error ? loadError.message : 'تعذر تحميل إعدادات الصفحة الرئيسية.');
                    setSettings(defaultHomepageSettings);
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        void loadSettings();

        return () => {
            cancelled = true;
        };
    }, []);

    const availablePaths = useMemo(
        () => paths.filter((path) => path.isActive !== false && path.id && path.name),
        [paths],
    );

    const availableArticleLessons = useMemo(
        () =>
            lessons.filter(
                (lesson) =>
                    (lesson.type === 'text' || Boolean(lesson.content?.trim())) &&
                    lesson.showOnPlatform !== false &&
                    lesson.approvalStatus !== 'pending_review' &&
                    lesson.approvalStatus !== 'rejected' &&
                    lesson.id &&
                    lesson.title,
            ),
        [lessons],
    );

    const availableCourses = useMemo(
        () => courses.filter((course) => !course.isPackage && course.id && course.title),
        [courses],
    );

    const filteredFeaturedCourses = useMemo(() => {
        const query = courseSearch.trim().toLowerCase();
        if (!query) {
            return availableCourses;
        }

        return availableCourses.filter((course) =>
            [course.title, course.description, course.category]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(query)),
        );
    }, [availableCourses, courseSearch]);

    const filteredFeaturedArticleLessons = useMemo(() => {
        const query = articleSearch.trim().toLowerCase();
        if (!query) {
            return availableArticleLessons;
        }

        return availableArticleLessons.filter((lesson) => {
            const subjectName = subjects.find((subject) => subject.id === lesson.subjectId)?.name || '';
            return [lesson.title, lesson.content, subjectName]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(query));
        });
    }, [articleSearch, availableArticleLessons, subjects]);

    const homepageSummary = useMemo(() => {
        const featuredPathsCount = settings.featuredPathIds.length > 0 ? settings.featuredPathIds.length : availablePaths.length;
        const featuredCoursesCount = settings.featuredCourseIds.length > 0 ? settings.featuredCourseIds.length : Math.min(availableCourses.length, 3);
        const featuredArticlesCount =
            (settings.featuredArticleLessonIds?.length || 0) > 0
                ? settings.featuredArticleLessonIds!.length
                : Math.min(availableArticleLessons.length, 3);

        return {
            featuredPathsCount,
            featuredCoursesCount,
            featuredArticlesCount,
            statsCount: settings.stats.filter((item) => item.label.trim().length > 0).length,
            testimonialsCount: settings.testimonials.filter((item) => item.name.trim().length > 0 && item.text.trim().length > 0).length,
        };
    }, [availableArticleLessons.length, availableCourses.length, availablePaths.length, settings.featuredArticleLessonIds, settings.featuredCourseIds, settings.featuredPathIds, settings.stats, settings.testimonials]);

    const updateHeroField = <Field extends keyof HomepageSettings['hero']>(
        field: Field,
        value: HomepageSettings['hero'][Field],
    ) => {
        setSettings((prev) => ({
            ...prev,
            hero: {
                ...prev.hero,
                [field]: value,
            },
        }));
    };

    const updateBrandField = (field: keyof NonNullable<HomepageSettings['brand']>, value: string) => {
        setSettings((prev) => ({
            ...prev,
            brand: {
                ...defaultHomepageSettings.brand,
                ...prev.brand,
                [field]: value,
            },
        }));
    };

    const handleBrandLogoUpload = (file?: File | null) => {
        if (!file) {
            return;
        }

        if (!file.type.startsWith('image/')) {
            setError('اختر ملف صورة فقط.');
            return;
        }

        if (file.size > 300 * 1024) {
            setError('حجم الشعار كبير. الأفضل ضغطه إلى أقل من 300KB قبل الرفع حتى لا يبطئ الهيدر.');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            updateBrandField('logoUrl', String(reader.result || ''));
            setError(null);
            setSuccess('تم تحميل الشعار داخل الإعدادات. اضغط حفظ التعديلات لنشره.');
        };
        reader.onerror = () => setError('تعذر قراءة الشعار. جرّب صورة أخرى.');
        reader.readAsDataURL(file);
    };

    const handleHeroImageUpload = (file?: File | null) => {
        if (!file) {
            return;
        }

        if (!file.type.startsWith('image/')) {
            setError('اختر ملف صورة فقط.');
            return;
        }

        if (file.size > 900 * 1024) {
            setError('حجم صورة البداية كبير. الأفضل ضغطها إلى أقل من 900KB قبل الرفع.');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            updateHeroField('imageUrl', String(reader.result || ''));
            setError(null);
            setSuccess('تم تحميل الصورة داخل الإعدادات. اضغط حفظ التعديلات لنشرها.');
        };
        reader.onerror = () => setError('تعذر قراءة الصورة. جرّب صورة أخرى.');
        reader.readAsDataURL(file);
    };

    const handleGalleryImageUpload = (file?: File | null) => {
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setError('اختر ملف صورة فقط.');
            return;
        }

        if (file.size > 900 * 1024) {
            setError('حجم الصورة كبير. الأفضل ضغطها إلى أقل من 900KB قبل الرفع.');
            return;
        }

        const currentGallery = settings.hero.galleryImages || [];
        if (currentGallery.length >= 8) {
            setError('الحد الأقصى لمعرض صور الهيرو هو 8 صور.');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = String(reader.result || '');
            setSettings((prev) => ({
                ...prev,
                hero: {
                    ...prev.hero,
                    galleryImages: [...(prev.hero.galleryImages || []), dataUrl],
                },
            }));
            setError(null);
            setSuccess('تمت إضافة الصورة إلى معرض صور البداية. اضغط حفظ التعديلات لنشرها.');
        };
        reader.onerror = () => setError('تعذر قراءة الصورة. جرّب صورة أخرى.');
        reader.readAsDataURL(file);
    };

    const removeGalleryImage = (index: number) => {
        setSettings((prev) => ({
            ...prev,
            hero: {
                ...prev.hero,
                galleryImages: (prev.hero.galleryImages || []).filter((_, i) => i !== index),
            },
        }));
    };

    const setGalleryImageAsPrimary = (index: number) => {
        setSettings((prev) => {
            const gallery = [...(prev.hero.galleryImages || [])];
            const selectedImage = gallery[index];
            const oldPrimary = prev.hero.imageUrl || defaultHomepageSettings.hero.imageUrl;

            gallery.splice(index, 1);
            if (oldPrimary && !gallery.includes(oldPrimary)) {
                gallery.unshift(oldPrimary);
            }

            return {
                ...prev,
                hero: {
                    ...prev.hero,
                    imageUrl: selectedImage,
                    galleryImages: gallery,
                },
            };
        });
        setSuccess('تم تعيين الصورة كصورة رئيسية للبداية.');
    };

    const updateSectionField = (field: keyof HomepageSettings['sections'], value: string) => {
        setSettings((prev) => ({
            ...prev,
            sections: {
                ...prev.sections,
                [field]: value,
            },
        }));
    };

    const updateTypographyField = (field: keyof NonNullable<HomepageSettings['typography']>, value: string) => {
        setSettings((prev) => ({
            ...prev,
            typography: {
                ...defaultHomepageSettings.typography,
                ...prev.typography,
                [field]: value,
            },
        }));
    };

    const updateNavigationItem = (id: string, updates: Partial<NonNullable<HomepageSettings['navigation']>['items'][number]>) => {
        setSettings((prev) => {
            const defaults = defaultHomepageSettings.navigation?.items || [];
            const currentItems = prev.navigation?.items?.length ? prev.navigation.items : defaults;
            const nextItems = currentItems.map((item) => (item.id === id ? { ...item, ...updates } : item));
            if (!nextItems.some((item) => item.id === id)) {
                nextItems.push({ id, ...updates });
            }
            return {
                ...prev,
                navigation: {
                    ...defaultHomepageSettings.navigation,
                    ...prev.navigation,
                    items: nextItems,
                },
            };
        });
    };

    const updateNavigationField = (field: keyof NonNullable<HomepageSettings['navigation']>, value: string | boolean) => {
        setSettings((prev) => ({
            ...prev,
            navigation: {
                ...defaultHomepageSettings.navigation,
                ...prev.navigation,
                [field]: value,
                items: prev.navigation?.items?.length ? prev.navigation.items : defaultHomepageSettings.navigation?.items,
            },
        }));
    };

    const updateStat = (index: number, updates: Partial<HomepageStat>) => {
        setSettings((prev) => ({
            ...prev,
            stats: prev.stats.map((stat, statIndex) => (statIndex === index ? { ...stat, ...updates } : stat)),
        }));
    };

    const updateTestimonial = (index: number, updates: Partial<HomepageTestimonial>) => {
        setSettings((prev) => ({
            ...prev,
            testimonials: prev.testimonials.map((item, itemIndex) => (itemIndex === index ? { ...item, ...updates } : item)),
        }));
    };

    const handleTestimonialImageUpload = (index: number, file?: File | null) => {
        if (!file) {
            return;
        }

        if (!file.type.startsWith('image/')) {
            setError('اختر ملف صورة فقط.');
            return;
        }

        if (file.size > 500 * 1024) {
            setError('حجم صورة رأي الطالب كبير. الأفضل ضغطها إلى أقل من 500KB قبل الرفع.');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            updateTestimonial(index, { image: String(reader.result || '') });
            setError(null);
            setSuccess('تم تحميل صورة رأي الطالب داخل الإعدادات. اضغط حفظ التعديلات لنشرها.');
        };
        reader.onerror = () => setError('تعذر قراءة الصورة. جرّب صورة أخرى.');
        reader.readAsDataURL(file);
    };

    const toggleId = (collection: string[], id: string) =>
        collection.includes(id) ? collection.filter((item) => item !== id) : [...collection, id];

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const normalizedTestimonials = settings.testimonials
                .filter((item) => item.name.trim().length > 0 && item.text.trim().length > 0)
                .map((item) => ({
                    ...item,
                    image: withCacheBust(item.image),
                }));
            const payload: HomepageSettings = {
                ...settings,
                brand: { ...defaultHomepageSettings.brand, ...settings.brand, logoUrl: withCacheBust(settings.brand?.logoUrl) },
                hero: {
                    ...settings.hero,
                    imageUrl: withCacheBust(settings.hero.imageUrl),
                    // hero: { ...settings.hero, imageUrl: withCacheBust(settings.hero.imageUrl) }
                    galleryImages: (settings.hero.galleryImages || []).map((img) => withCacheBust(img)),
                },
                sections: { ...settings.sections },
                typography: { ...defaultHomepageSettings.typography, ...settings.typography },
                navigation: { ...defaultHomepageSettings.navigation, ...settings.navigation },
                stats: settings.stats.filter((item) => item.label.trim().length > 0),
                testimonials: normalizedTestimonials,
            };

            const response = await api.updateHomepageSettings(payload);
            setSettings(mergeHomepageSettings(response as HomepageSettings));
            setSuccess('تم حفظ إعدادات الصفحة الرئيسية بنجاح.');
        } catch (saveError) {
            const message = saveError instanceof Error ? saveError.message : 'تعذر حفظ إعدادات الصفحة الرئيسية.';
            if (/Authentication required|Invalid token|Token expired|jwt expired|jwt malformed|unauthorized/i.test(message)) {
                await logout();
                setError('انتهت جلسة الإدارة أو لم تصل صلاحية الحفظ للخادم. تم تسجيل الخروج لحمايتك، سجّل الدخول كمدير ثم أعد الحفظ.');
                return;
            }

            setError(message);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-gray-500">
                جارٍ تحميل إعدادات الصفحة الرئيسية...
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">إدارة الصفحة الرئيسية</h1>
                    <p className="text-sm text-gray-500 mt-1">تحكم في الهيرو والعدادات والدورات والمسارات المميزة وآراء الطلاب بدون تغيير شكل الموقع.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <a
                        href="/"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-amber-100 bg-white text-amber-700 font-bold hover:bg-amber-50 transition-colors"
                    >
                        <ExternalLink size={18} />
                        معاينة الصفحة
                    </a>
                    <button
                        onClick={() => void handleSave()}
                        disabled={isSaving}
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 transition-colors disabled:opacity-60"
                    >
                        <Save size={18} />
                        {isSaving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
                    </button>
                </div>
            </div>

            {error && <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm text-rose-700">{error}</div>}
            {success && <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">{success}</div>}

            {/* Announcement Ads Spotlight Card */}
            <StudentSiteExperienceFields value={settings.studentExperience} disabled={isSaving} onChange={studentExperience => { setSettings(prev => ({ ...prev, studentExperience })); setSuccess(null); }} />
            <div className="rounded-3xl border border-amber-200/90 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-indigo-500/10 p-5 shadow-xs backdrop-blur-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3.5">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/25">
                            <Megaphone size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-black text-gray-950">إعلانات وتنبيهات الصفحة والمنصة</h3>
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-black text-amber-800">
                                    {activeAdsCount} نشط
                                </span>
                            </div>
                            <p className="mt-1 text-xs font-medium text-gray-600 leading-relaxed">
                                تظهر الإعلانات تلقائيًا كـ <strong>شارة تفاعلية في الهيرو</strong> أعلى عنوان الصفحة، <strong>شريط علوي زجاجي</strong> أعلى المنصة، أو <strong>نافذة منبثقة مركزية</strong>.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={() => {
                                window.location.hash = '/admin';
                            }}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 text-xs font-black shadow-md shadow-amber-500/20 transition hover:shadow-lg active:scale-[0.98]"
                        >
                            <span>لوحة إدارة الإعلانات</span>
                            <ArrowLeft size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Navigation Jump Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
                <span className="text-xs font-bold text-gray-400 shrink-0 ml-1">انتقال سريع:</span>
                <button
                    type="button"
                    onClick={() => document.getElementById('brand-section')?.scrollIntoView({ behavior: 'smooth' })}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200/80 text-xs font-bold text-gray-700 shadow-xs transition shrink-0"
                >
                    <Sparkles size={14} className="text-indigo-600" />
                    <span>الهوية والشعار</span>
                </button>
                <button
                    type="button"
                    onClick={() => document.getElementById('hero-section')?.scrollIntoView({ behavior: 'smooth' })}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200/80 text-xs font-bold text-gray-700 shadow-xs transition shrink-0"
                >
                    <Sparkles size={14} className="text-amber-500" />
                    <span>قسم البداية (Hero)</span>
                </button>
                <button
                    type="button"
                    onClick={() => document.getElementById('stats-section')?.scrollIntoView({ behavior: 'smooth' })}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200/80 text-xs font-bold text-gray-700 shadow-xs transition shrink-0"
                >
                    <BarChart2 size={14} className="text-blue-600" />
                    <span>العدادات والأرقام</span>
                </button>
                <button
                    type="button"
                    onClick={() => document.getElementById('testimonials-section')?.scrollIntoView({ behavior: 'smooth' })}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200/80 text-xs font-bold text-gray-700 shadow-xs transition shrink-0"
                >
                    <Star size={14} className="text-amber-500" />
                    <span>آراء الطلاب</span>
                </button>
                <button
                    type="button"
                    onClick={() => document.getElementById('content-section')?.scrollIntoView({ behavior: 'smooth' })}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200/80 text-xs font-bold text-gray-700 shadow-xs transition shrink-0"
                >
                    <Layers size={14} className="text-emerald-600" />
                    <span>المحتوى المميز</span>
                </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
                    <section id="brand-section" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5 scroll-mt-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                <ImageIcon size={18} />
                            </div>
                            <div>
                                <h2 className="font-bold text-gray-900">شعار المنصة</h2>
                                <p className="text-sm text-gray-500">يتحكم في شعار الهيدر ونصه بدون تغيير مكانه أو تصميمه.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 space-y-3">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">صورة الشعار</label>
                                        <p className="text-xs leading-6 text-gray-500">
                                            الأفضل PNG/WebP شفاف أقل من 300KB. اتركها فارغة لو أردت استخدام شعار النص الحالي فقط.
                                        </p>
                                    </div>
                                    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-blue-700 border border-blue-100 hover:bg-blue-50">
                                        <Upload size={16} />
                                        رفع شعار
                                        <input
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                            className="hidden"
                                            onChange={(event) => handleBrandLogoUpload(event.target.files?.[0])}
                                        />
                                    </label>
                                </div>
                                <TextField label="رابط الشعار أو الصورة المرفوعة" value={settings.brand?.logoUrl || ''} onChange={(value) => updateBrandField('logoUrl', value)} />
                                <TextField label="وصف الشعار" value={settings.brand?.logoAlt || ''} onChange={(value) => updateBrandField('logoAlt', value)} />
                                {settings.brand?.logoUrl ? (
                                    <img src={settings.brand.logoUrl} alt="" className="h-16 max-w-[220px] rounded-2xl object-contain border border-white bg-white p-2 shadow-sm" />
                                ) : null}
                            </div>
                            <TextField label="نص الشعار الأول" value={settings.brand?.logoText || ''} onChange={(value) => updateBrandField('logoText', value)} />
                            <TextField label="نص الشعار المميز" value={settings.brand?.logoAccentText || ''} onChange={(value) => updateBrandField('logoAccentText', value)} />
                        </div>
                    </section>

                    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="font-bold text-gray-900">الشريط العلوي</h2>
                                <p className="text-sm text-gray-500">تحكم في ظهور العناصر العامة. المسارات الجديدة تظهر تلقائيًا ويمكن التحكم في كل مسار من إدارة المسارات.</p>
                            </div>
                            <label className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={settings.navigation?.showAutoPaths !== false}
                                    onChange={(event) => updateNavigationField('showAutoPaths', event.target.checked)}
                                />
                                إظهار المسارات تلقائيًا
                            </label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <TextField
                                label="اسم قائمة العناصر الأخرى"
                                value={settings.navigation?.moreLabel || 'أخرى'}
                                onChange={(value) => updateNavigationField('moreLabel', value)}
                            />
                            {(settings.navigation?.items?.length ? settings.navigation.items : defaultHomepageSettings.navigation?.items || []).map((item) => (
                                <div key={item.id} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="text-sm font-black text-gray-800">{item.id}</div>
                                        <label className="inline-flex items-center gap-2 text-xs font-bold text-gray-600">
                                            <input
                                                type="checkbox"
                                                checked={item.visible !== false}
                                                onChange={(event) => updateNavigationItem(item.id, { visible: event.target.checked })}
                                            />
                                            ظاهر
                                        </label>
                                    </div>
                                    <div className="grid grid-cols-[1fr_90px] gap-3">
                                        <TextField
                                            label="الاسم الظاهر"
                                            value={item.label || ''}
                                            onChange={(value) => updateNavigationItem(item.id, { label: value })}
                                        />
                                        <TextField
                                            label="الترتيب"
                                            value={String(item.order ?? 0)}
                                            onChange={(value) => updateNavigationItem(item.id, { order: Number(value || 0) })}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section id="hero-section" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5 scroll-mt-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                <ImageIcon size={18} />
                            </div>
                            <div>
                                <h2 className="font-bold text-gray-900">قسم البداية (Hero)</h2>
                                <p className="text-sm text-gray-500">العنوان الرئيسي، الأزرار، الصورة، والبطاقة العائمة.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <TextField label="الشارة الصغيرة" value={settings.hero.badgeText || ''} onChange={(value) => updateHeroField('badgeText', value)} />
                            <div className="md:col-span-2 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 space-y-3">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">الصورة الرئيسية</label>
                                        <p className="text-xs leading-6 text-gray-500">
                                            الأبعاد المناسبة: 1200×800 أو 3:2، ويفضل WebP/JPG أقل من 900KB حتى تفتح الصفحة بسرعة.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-blue-700 border border-blue-100 hover:bg-blue-50">
                                            <Upload size={16} />
                                            رفع صورة
                                            <input
                                                type="file"
                                                accept="image/png,image/jpeg,image/webp"
                                                className="hidden"
                                                onChange={(event) => handleHeroImageUpload(event.target.files?.[0])}
                                            />
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => updateHeroField('imageUrl', DEFAULT_HERO_BOY_IMAGE)}
                                            className="rounded-xl border border-amber-100 bg-white px-4 py-2 text-sm font-bold text-amber-700 hover:bg-amber-50"
                                        >
                                            صورة ولد افتراضية
                                        </button>
                                    </div>
                                </div>
                                <TextField label="رابط الصورة أو الصورة المرفوعة" value={settings.hero.imageUrl || ''} onChange={(value) => updateHeroField('imageUrl', value)} />
                                <TextField label="وصف الصورة للظهور والبحث" value={settings.hero.imageAlt || ''} onChange={(value) => updateHeroField('imageAlt', value)} />
                                {settings.hero.imageUrl ? (
                                    <img src={settings.hero.imageUrl} alt="" className="h-40 w-full rounded-2xl object-cover border border-white shadow-sm" />
                                ) : null}
                            </div>

                            {/* Hero Multi-Image Gallery Showcase */}
                            <div className="md:col-span-2 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 via-white to-blue-50/40 p-4 sm:p-5 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-indigo-100/80 pb-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                                            <Sparkles size={16} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-gray-900">معرض صور الهيرو المتغيرة (Smart Photo Rotator)</h3>
                                            <p className="text-xs text-gray-500">أضف عدة صور لتبديلها بسلاسة وهدوء وإعطاء حيوية وتنوع للصفحة الرئيسية.</p>
                                        </div>
                                    </div>
                                    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-black text-white hover:bg-indigo-700 transition-colors shadow-xs">
                                        <Plus size={15} />
                                        إضافة صورة للمعرض
                                        <input
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp"
                                            className="hidden"
                                            onChange={(event) => handleGalleryImageUpload(event.target.files?.[0])}
                                        />
                                    </label>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-200/80">
                                        <input
                                            type="checkbox"
                                            id="autoRotateImages"
                                            checked={settings.hero.autoRotateImages !== false}
                                            onChange={(e) => updateHeroField('autoRotateImages', e.target.checked)}
                                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <label htmlFor="autoRotateImages" className="text-xs font-bold text-gray-800 cursor-pointer">
                                            تفعيل التدوير التلقائي للصور (Crossfade)
                                        </label>
                                    </div>

                                    <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-gray-200/80">
                                        <span className="text-xs font-bold text-gray-700">سرعة التبديل:</span>
                                        <select
                                            value={settings.hero.rotateIntervalSeconds || 6}
                                            onChange={(e) => updateHeroField('rotateIntervalSeconds', Number(e.target.value))}
                                            className="text-xs font-bold bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-gray-800 focus:ring-indigo-500"
                                        >
                                            <option value={4}>كل 4 ثوانٍ (سريع)</option>
                                            <option value={6}>كل 6 ثوانٍ (متوازن - موصى به)</option>
                                            <option value={8}>كل 8 ثوانٍ (هادئ)</option>
                                            <option value={12}>كل 12 ثانية (بطيء جداً)</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Gallery Thumbnails Grid */}
                                <div className="space-y-2">
                                    <span className="text-xs font-bold text-gray-600 block">الصور المعروضة حالياً في الهيرو:</span>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {/* Primary Image Slot */}
                                        <div className="relative group rounded-xl overflow-hidden border-2 border-indigo-500 shadow-xs aspect-[4/3] bg-gray-100">
                                            <img
                                                src={settings.hero.imageUrl || DEFAULT_HERO_BOY_IMAGE}
                                                alt="الصورة الرئيسية"
                                                className="w-full h-full object-cover"
                                            />
                                            <span className="absolute top-1.5 right-1.5 bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-xs">
                                                الرئيسية
                                            </span>
                                        </div>

                                        {/* Additional Gallery Images */}
                                        {(settings.hero.galleryImages || []).map((galleryImg, gIdx) => (
                                            <div key={`gallery-thumb-${gIdx}`} className="relative group rounded-xl overflow-hidden border border-gray-200 shadow-xs aspect-[4/3] bg-gray-100">
                                                <img
                                                    src={galleryImg}
                                                    alt={`صورة ${gIdx + 2}`}
                                                    className="w-full h-full object-cover"
                                                />
                                                <span className="absolute top-1.5 right-1.5 bg-slate-900/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                                                    #{gIdx + 2}
                                                </span>
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setGalleryImageAsPrimary(gIdx)}
                                                        className="px-2 py-1 bg-white text-indigo-700 hover:bg-indigo-50 rounded-lg text-[10px] font-black transition-colors"
                                                        title="تعيين كصورة رئيسية"
                                                    >
                                                        رئيسية
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeGalleryImage(gIdx)}
                                                        className="p-1.5 bg-rose-600 text-white hover:bg-rose-700 rounded-lg transition-colors"
                                                        title="حذف من المعرض"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Placeholder if only 1 image */}
                                        {(!settings.hero.galleryImages || settings.hero.galleryImages.length === 0) && (
                                            <label className="border-2 border-dashed border-gray-300 hover:border-indigo-400 rounded-xl aspect-[4/3] flex flex-col items-center justify-center text-center p-3 cursor-pointer bg-white/50 hover:bg-indigo-50/30 transition-all">
                                                <Plus size={20} className="text-gray-400 mb-1" />
                                                <span className="text-[11px] font-bold text-gray-500">إضافة صورة أخرى</span>
                                                <input
                                                    type="file"
                                                    accept="image/png,image/jpeg,image/webp"
                                                    className="hidden"
                                                    onChange={(event) => handleGalleryImageUpload(event.target.files?.[0])}
                                                />
                                            </label>
                                        )}
                                    </div>
                                </div>

                                {/* Presets from Platform Library */}
                                <div className="space-y-2.5 pt-3 border-t border-gray-100">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 text-xs font-black text-indigo-950">
                                            <Sparkles size={14} className="text-amber-500" />
                                            <span>مكتبة صور المنصة الرسمية (13 صورة احترافية للقدرات والتحصيلي):</span>
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const daylightUrls = PLATFORM_PRESET_IMAGES.filter((p) => p.pack === 'daylight').map((p) => p.url);
                                                    setSettings((prev) => ({
                                                        ...prev,
                                                        hero: {
                                                            ...prev.hero,
                                                            galleryImages: daylightUrls,
                                                        },
                                                    }));
                                                }}
                                                className="text-[11px] font-black text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200 transition-colors cursor-pointer"
                                            >
                                                ☀️ تطبيق باقة الاستوديو النهاري (7 صور)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const neonUrls = PLATFORM_PRESET_IMAGES.filter((p) => p.pack === 'neon').map((p) => p.url);
                                                    setSettings((prev) => ({
                                                        ...prev,
                                                        hero: {
                                                            ...prev.hero,
                                                            galleryImages: neonUrls,
                                                        },
                                                    }));
                                                }}
                                                className="text-[11px] font-black text-purple-800 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg border border-purple-200 transition-colors cursor-pointer"
                                            >
                                                🌙 تطبيق النمط السيبراني (6 صور)
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                                        {PLATFORM_PRESET_IMAGES.map((preset) => (
                                            <div key={preset.url} className="rounded-xl border border-gray-200/80 bg-gray-50/60 p-1.5 space-y-1.5 group hover:border-indigo-300 transition-colors">
                                                <div className="relative aspect-[3/2] rounded-lg overflow-hidden border border-gray-200 bg-gray-100 shadow-2xs">
                                                    <img src={preset.url} alt={preset.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                                </div>
                                                <div className="text-[10px] font-black text-gray-800 truncate text-center">{preset.title}</div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateHeroField('imageUrl', preset.url)}
                                                        className="flex-1 py-1 rounded-md bg-white hover:bg-indigo-50 border border-gray-200 text-indigo-700 text-[10px] font-black text-center shadow-2xs transition-colors cursor-pointer"
                                                        title="تعيين كصورة رئيسية"
                                                    >
                                                        رئيسية
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const current = settings.hero.galleryImages || [];
                                                            if (!current.includes(preset.url)) {
                                                                updateHeroField('galleryImages', [...current, preset.url]);
                                                            }
                                                        }}
                                                        className="flex-1 py-1 rounded-md bg-white hover:bg-amber-50 border border-gray-200 text-amber-700 text-[10px] font-black text-center shadow-2xs transition-colors cursor-pointer"
                                                        title="إضافة للمعرض الدوار"
                                                    >
                                                        + معرض
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <TextField label="مقدمة العنوان" value={settings.hero.titlePrefix || ''} onChange={(value) => updateHeroField('titlePrefix', value)} />
                            <TextField label="الكلمة المميزة" value={settings.hero.titleHighlight || ''} onChange={(value) => updateHeroField('titleHighlight', value)} />
                            <TextField label="نهاية العنوان" value={settings.hero.titleSuffix || ''} onChange={(value) => updateHeroField('titleSuffix', value)} />
                            <ColorField label="لون الشارة" value={settings.hero.badgeTextColor || ''} fallback="#2563eb" onChange={(value) => updateHeroField('badgeTextColor', value)} />
                            <ColorField label="لون مقدمة العنوان" value={settings.hero.titlePrefixColor || ''} fallback="#111827" onChange={(value) => updateHeroField('titlePrefixColor', value)} />
                            <ColorField label="لون الكلمة المميزة" value={settings.hero.titleHighlightColor || ''} fallback="#2563eb" onChange={(value) => updateHeroField('titleHighlightColor', value)} />
                            <ColorField label="لون نهاية العنوان" value={settings.hero.titleSuffixColor || ''} fallback="#111827" onChange={(value) => updateHeroField('titleSuffixColor', value)} />
                            <ColorField label="لون الوصف الرئيسي" value={settings.hero.descriptionColor || ''} fallback="#4b5563" onChange={(value) => updateHeroField('descriptionColor', value)} />
                            <TextField label="عنوان البطاقة العائمة" value={settings.hero.floatingCardTitle || ''} onChange={(value) => updateHeroField('floatingCardTitle', value)} />
                            <TextField label="وصف البطاقة العائمة" value={settings.hero.floatingCardSubtitle || ''} onChange={(value) => updateHeroField('floatingCardSubtitle', value)} />
                            <TextField label="نص نسبة التقدم" value={settings.hero.floatingCardProgressValue || ''} onChange={(value) => updateHeroField('floatingCardProgressValue', value)} />
                            <TextField label="زر البداية" value={settings.hero.primaryCtaLabel || ''} onChange={(value) => updateHeroField('primaryCtaLabel', value)} />
                            <TextField label="رابط زر البداية" value={settings.hero.primaryCtaLink || ''} onChange={(value) => updateHeroField('primaryCtaLink', value)} />
                            <ColorField label="لون زر البداية" value={settings.hero.primaryCtaColor || ''} fallback="#f59e0b" onChange={(value) => updateHeroField('primaryCtaColor', value)} />
                            <TextField label="زر ثانوي" value={settings.hero.secondaryCtaLabel || ''} onChange={(value) => updateHeroField('secondaryCtaLabel', value)} />
                            <TextField label="رابط الزر الثانوي" value={settings.hero.secondaryCtaLink || ''} onChange={(value) => updateHeroField('secondaryCtaLink', value)} />
                            <ColorField label="لون الزر الثانوي" value={settings.hero.secondaryCtaColor || ''} fallback="#374151" onChange={(value) => updateHeroField('secondaryCtaColor', value)} />
                            <TextField label="زر ثالث" value={settings.hero.tertiaryCtaLabel || ''} onChange={(value) => updateHeroField('tertiaryCtaLabel', value)} />
                            <TextField label="رابط الزر الثالث" value={settings.hero.tertiaryCtaLink || ''} onChange={(value) => updateHeroField('tertiaryCtaLink', value)} />
                            <ColorField label="لون الزر الثالث" value={settings.hero.tertiaryCtaColor || ''} fallback="#4f46e5" onChange={(value) => updateHeroField('tertiaryCtaColor', value)} />
                        </div>

                        <TextAreaField label="الوصف الرئيسي" value={settings.hero.description || ''} onChange={(value) => updateHeroField('description', value)} rows={4} />
                    </section>

                    <section id="stats-section" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5 scroll-mt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="font-bold text-gray-900">العدادات العلوية</h2>
                                <p className="text-sm text-gray-500">يمكنك الاعتماد على البيانات الحقيقية أو إدخال رقم يدوي.</p>
                            </div>
                            <button
                                onClick={() => setSettings((prev) => ({ ...prev, stats: [...prev.stats, createEmptyStat()] }))}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50"
                            >
                                <Plus size={16} />
                                إضافة عداد
                            </button>
                        </div>

                        <div className="space-y-4">
                            {settings.stats.map((stat, index) => (
                                <div key={stat.id} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                        <TextField label="عنوان العداد" value={stat.label} onChange={(value) => updateStat(index, { label: value })} />
                                        <SelectField
                                            label="نوع القيمة"
                                            value={stat.mode}
                                            onChange={(value) => updateStat(index, { mode: value as HomepageStat['mode'] })}
                                            options={[
                                                { value: 'dynamic', label: 'ديناميكي' },
                                                { value: 'manual', label: 'يدوي' },
                                            ]}
                                        />
                                        <SelectField
                                            label="المصدر"
                                            value={stat.source}
                                            onChange={(value) => updateStat(index, { source: value as HomepageStat['source'] })}
                                            options={[
                                                { value: 'students', label: 'الطلاب' },
                                                { value: 'courses', label: 'الدورات' },
                                                { value: 'assets', label: 'المواد' },
                                                { value: 'rating', label: 'التقييم' },
                                            ]}
                                        />
                                        <TextField
                                            label="القيمة اليدوية"
                                            value={stat.manualValue || ''}
                                            onChange={(value) => updateStat(index, { manualValue: value })}
                                            disabled={stat.mode !== 'manual'}
                                        />
                                    </div>
                                    <div className="flex justify-end">
                                        <button
                                            onClick={() => setSettings((prev) => ({ ...prev, stats: prev.stats.filter((_, statIndex) => statIndex !== index) }))}
                                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold text-rose-600 hover:bg-rose-50"
                                        >
                                            <Trash2 size={15} />
                                            حذف
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section id="testimonials-section" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5 scroll-mt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="font-bold text-gray-900">آراء الطلاب</h2>
                                <p className="text-sm text-gray-500">ثلاث بطاقات بسيطة تكفي وتناسب الصفحة الرئيسية.</p>
                            </div>
                            <button
                                onClick={() => setSettings((prev) => ({ ...prev, testimonials: [...prev.testimonials, createEmptyTestimonial()] }))}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50"
                            >
                                <Plus size={16} />
                                إضافة رأي
                            </button>
                        </div>

                        <div className="space-y-4">
                            {settings.testimonials.map((testimonial, index) => (
                                <div key={testimonial.id} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <TextField label="اسم الطالب" value={testimonial.name} onChange={(value) => updateTestimonial(index, { name: value })} />
                                        <TextField label="النتيجة/الشارة" value={testimonial.degree || ''} onChange={(value) => updateTestimonial(index, { degree: value })} />
                                        <div className="space-y-2">
                                            <TextField label="الصورة" value={testimonial.image || ''} onChange={(value) => updateTestimonial(index, { image: value })} />
                                            <div className="flex items-center gap-2">
                                                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-blue-700 border border-blue-100 hover:bg-blue-50">
                                                    <Upload size={14} />
                                                    رفع صورة
                                                    <input
                                                        type="file"
                                                        accept="image/png,image/jpeg,image/webp"
                                                        className="hidden"
                                                        onChange={(event) => handleTestimonialImageUpload(index, event.target.files?.[0])}
                                                    />
                                                </label>
                                                {testimonial.image ? (
                                                    <img src={testimonial.image} alt="" className="h-9 w-9 rounded-full border border-white object-cover shadow-sm" />
                                                ) : null}
                                            </div>
                                            <p className="text-[11px] text-gray-400">الأفضل صورة مربعة أقل من 500KB.</p>
                                        </div>
                                    </div>
                                    <TextAreaField label="النص" value={testimonial.text} onChange={(value) => updateTestimonial(index, { text: value })} rows={3} />
                                    <div className="flex justify-end">
                                        <button
                                            onClick={() => setSettings((prev) => ({ ...prev, testimonials: prev.testimonials.filter((_, itemIndex) => itemIndex !== index) }))}
                                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold text-rose-600 hover:bg-rose-50"
                                        >
                                            <Trash2 size={15} />
                                            حذف
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                <div className="space-y-6">
                    <HeroLivePreview settings={settings} />

                    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                        <h2 className="font-bold text-gray-900">ملخص الواجهة الحالية</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <SummaryCard label="مسارات ظاهرة في الصفحة" value={homepageSummary.featuredPathsCount} tone="blue" />
                            <SummaryCard label="دورات مميزة" value={homepageSummary.featuredCoursesCount} tone="amber" />
                            <SummaryCard label="مقالات مميزة" value={homepageSummary.featuredArticlesCount} tone="emerald" />
                            <SummaryCard label="عدادات فعالة" value={homepageSummary.statsCount} tone="slate" />
                            <SummaryCard label="آراء طلاب جاهزة" value={homepageSummary.testimonialsCount} tone="violet" />
                        </div>
                        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-7 text-gray-600">
                            ما تضبطه هنا يظهر للزائر فقط إذا كان المحتوى نفسه معتمدًا ومفتوحًا على المنصة. هذا يمنع ظهور عناصر ما زالت تحت التجهيز.
                        </div>
                    </section>

                    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                        <h2 className="font-bold text-gray-900">خطوط الصفحة الرئيسية</h2>
                        <p className="text-sm text-gray-500">الافتراضي هو خط المنصة الحالي. غيّرها فقط لو أردت تجربة خط آخر في الصفحة الرئيسية.</p>
                        <SelectField
                            label="خط العناوين"
                            value={settings.typography?.headingFont || 'tajawal'}
                            onChange={(value) => updateTypographyField('headingFont', value)}
                            options={[
                                { value: 'tajawal', label: 'Tajawal - خط المنصة' },
                                { value: 'system', label: 'خط النظام' },
                                { value: 'serif', label: 'خط رسمي' },
                            ]}
                        />
                        <SelectField
                            label="خط النصوص"
                            value={settings.typography?.bodyFont || 'tajawal'}
                            onChange={(value) => updateTypographyField('bodyFont', value)}
                            options={[
                                { value: 'tajawal', label: 'Tajawal - خط المنصة' },
                                { value: 'system', label: 'خط النظام' },
                                { value: 'serif', label: 'خط رسمي' },
                            ]}
                        />
                        <SelectField
                            label="ثقل العنوان الرئيسي"
                            value={settings.typography?.headingWeight || 'black'}
                            onChange={(value) => updateTypographyField('headingWeight', value)}
                            options={[
                                { value: 'black', label: 'قوي مثل الحالي' },
                                { value: 'bold', label: 'أخف قليلًا' },
                            ]}
                        />
                    </section>

                    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                        <h2 className="font-bold text-gray-900">عناوين الأقسام</h2>
                        <TextField label="عنوان الدورات" value={settings.sections.featuredCoursesTitle || ''} onChange={(value) => updateSectionField('featuredCoursesTitle', value)} />
                        <TextAreaField label="وصف الدورات" value={settings.sections.featuredCoursesSubtitle || ''} onChange={(value) => updateSectionField('featuredCoursesSubtitle', value)} rows={2} />
                        <TextField label="عنوان المقالات" value={settings.sections.featuredArticlesTitle || ''} onChange={(value) => updateSectionField('featuredArticlesTitle', value)} />
                        <TextAreaField label="وصف المقالات" value={settings.sections.featuredArticlesSubtitle || ''} onChange={(value) => updateSectionField('featuredArticlesSubtitle', value)} rows={2} />
                        <TextField label="عنوان لماذا نحن" value={settings.sections.whyChooseTitle || ''} onChange={(value) => updateSectionField('whyChooseTitle', value)} />
                        <TextAreaField label="وصف لماذا نحن" value={settings.sections.whyChooseDescription || ''} onChange={(value) => updateSectionField('whyChooseDescription', value)} rows={4} />
                        <TextField label="عنوان الآراء" value={settings.sections.testimonialsTitle || ''} onChange={(value) => updateSectionField('testimonialsTitle', value)} />
                        <TextAreaField label="وصف الآراء" value={settings.sections.testimonialsSubtitle || ''} onChange={(value) => updateSectionField('testimonialsSubtitle', value)} rows={2} />
                    </section>

                    <section id="content-section" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4 scroll-mt-6">
                        <h2 className="font-bold text-gray-900">المسارات المميزة</h2>
                        <p className="text-sm text-gray-500">إذا لم تحدد شيئًا، ستظهر كل المسارات المفعلة في الصفحة الرئيسية.</p>
                        <div className="space-y-2 max-h-72 overflow-y-auto">
                            {availablePaths.map((path) => (
                                <label key={path.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        aria-label={`إظهار المسار المميز ${path.name}`}
                                        title={`إظهار المسار المميز ${path.name}`}
                                        checked={settings.featuredPathIds.includes(path.id)}
                                        onChange={() =>
                                            setSettings((prev) => ({
                                                ...prev,
                                                featuredPathIds: toggleId(prev.featuredPathIds, path.id),
                                            }))
                                        }
                                        className="accent-amber-500"
                                    />
                                    <span className="font-medium text-gray-800">{path.name}</span>
                                </label>
                            ))}
                        </div>
                    </section>

                    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                        <h2 className="font-bold text-gray-900">الدورات المميزة</h2>
                        <p className="text-sm text-gray-500">حدد الدورات التي تريد إبرازها أولًا في الواجهة العامة.</p>
                        <TextField label="بحث في الدورات" value={courseSearch} onChange={setCourseSearch} />
                        <div className="space-y-2 max-h-72 overflow-y-auto">
                            {filteredFeaturedCourses.map((course) => (
                                <label key={course.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        aria-label={`إظهار الدورة المميزة ${course.title}`}
                                        title={`إظهار الدورة المميزة ${course.title}`}
                                        checked={settings.featuredCourseIds.includes(course.id)}
                                        onChange={() =>
                                            setSettings((prev) => ({
                                                ...prev,
                                                featuredCourseIds: toggleId(prev.featuredCourseIds, course.id),
                                            }))
                                        }
                                        className="accent-amber-500"
                                    />
                                    <span className="font-medium text-gray-800">{course.title}</span>
                                </label>
                            ))}
                            {filteredFeaturedCourses.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                                    لا توجد دورات مطابقة للبحث الحالي.
                                </div>
                            ) : null}
                        </div>
                    </section>

                    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                        <h2 className="font-bold text-gray-900">المقالات المميزة</h2>
                        <p className="text-sm text-gray-500">اختر المقالات أو الشروحات النصية التي تريد إبرازها للزائر في الصفحة الرئيسية.</p>
                        <TextField label="بحث في المقالات والدروس النصية" value={articleSearch} onChange={setArticleSearch} />
                        <div className="space-y-2 max-h-72 overflow-y-auto">
                            {filteredFeaturedArticleLessons.map((lesson) => {
                                const subjectName = subjects.find((subject) => subject.id === lesson.subjectId)?.name;
                                return (
                                    <label key={lesson.id} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            aria-label={`إظهار المقال أو الدرس النصي ${lesson.title}`}
                                            title={`إظهار المقال أو الدرس النصي ${lesson.title}`}
                                            checked={(settings.featuredArticleLessonIds || []).includes(lesson.id)}
                                            onChange={() =>
                                                setSettings((prev) => ({
                                                    ...prev,
                                                    featuredArticleLessonIds: toggleId(prev.featuredArticleLessonIds || [], lesson.id),
                                                }))
                                            }
                                            className="accent-amber-500 mt-1"
                                        />
                                        <div>
                                            <div className="font-medium text-gray-800">{lesson.title}</div>
                                            <div className="text-xs text-gray-500 mt-1">{subjectName || 'شرح عام'}</div>
                                        </div>
                                    </label>
                                );
                            })}
                            {filteredFeaturedArticleLessons.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                                    لا توجد مقالات أو دروس نصية مطابقة للبحث الحالي.
                                </div>
                            ) : null}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

const HeroLivePreview: React.FC<{ settings: HomepageSettings }> = ({ settings }) => {
    const hero = { ...defaultHomepageSettings.hero, ...settings.hero };
    const badgeTextColor = normalizeColorPickerValue(hero.badgeTextColor || '', '#2563eb');
    const titlePrefixColor = normalizeColorPickerValue(hero.titlePrefixColor || '', '#111827');
    const titleHighlightColor = normalizeColorPickerValue(hero.titleHighlightColor || '', '#2563eb');
    const titleSuffixColor = normalizeColorPickerValue(hero.titleSuffixColor || '', '#111827');
    const descriptionColor = normalizeColorPickerValue(hero.descriptionColor || '', '#4b5563');
    const primaryCtaColor = normalizeColorPickerValue(hero.primaryCtaColor || '', '#f59e0b');
    const secondaryCtaColor = normalizeColorPickerValue(hero.secondaryCtaColor || '', '#374151');
    const tertiaryCtaColor = normalizeColorPickerValue(hero.tertiaryCtaColor || '', '#4f46e5');
    const tertiaryLabel = hero.tertiaryCtaLabel?.trim();

    return (
        <section className="bg-white rounded-2xl border border-amber-100 shadow-sm p-6 space-y-4">
            <div>
                <h2 className="font-bold text-gray-900">معاينة حية قبل الحفظ</h2>
                <p className="text-sm text-gray-500 mt-1">جرّب النصوص والألوان هنا أولًا، ثم احفظ عندما تكون النتيجة مناسبة.</p>
            </div>

            <div className="rounded-3xl border border-gray-100 bg-gradient-to-br from-white via-amber-50/40 to-blue-50/50 p-5 overflow-hidden">
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3 py-2 text-xs font-bold shadow-sm" style={{ color: badgeTextColor }}>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: badgeTextColor }} />
                    {hero.badgeText || defaultHomepageSettings.hero.badgeText}
                </div>

                <h3 className="mt-4 text-3xl font-black leading-tight">
                    <span style={{ color: titlePrefixColor }}>{hero.titlePrefix || defaultHomepageSettings.hero.titlePrefix}</span>{' '}
                    <span style={{ color: titleHighlightColor }}>{hero.titleHighlight || defaultHomepageSettings.hero.titleHighlight}</span>{' '}
                    <span style={{ color: titleSuffixColor }}>{hero.titleSuffix || defaultHomepageSettings.hero.titleSuffix}</span>
                </h3>

                <p className="mt-3 text-sm leading-7" style={{ color: descriptionColor }}>
                    {hero.description || defaultHomepageSettings.hero.description}
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                    <span className="rounded-xl px-4 py-3 text-sm font-bold text-white shadow-sm" style={{ backgroundColor: primaryCtaColor }}>
                        {hero.primaryCtaLabel || defaultHomepageSettings.hero.primaryCtaLabel}
                    </span>
                    <span className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold" style={{ color: secondaryCtaColor }}>
                        {hero.secondaryCtaLabel || defaultHomepageSettings.hero.secondaryCtaLabel}
                    </span>
                    {tertiaryLabel ? (
                        <span className="rounded-xl px-4 py-3 text-sm font-bold text-white shadow-sm" style={{ backgroundColor: tertiaryCtaColor }}>
                            {tertiaryLabel}
                        </span>
                    ) : null}
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px] sm:items-end">
                    <div className="rounded-2xl border border-white bg-white/85 p-4 shadow-sm">
                        <div className="text-sm font-bold text-gray-900">{hero.floatingCardTitle || defaultHomepageSettings.hero.floatingCardTitle}</div>
                        <div className="mt-1 text-xs text-gray-500">{hero.floatingCardSubtitle || defaultHomepageSettings.hero.floatingCardSubtitle}</div>
                        <div className="mt-3 h-2 rounded-full bg-gray-100">
                            <div className="h-2 rounded-full" style={{ width: hero.floatingCardProgressValue || '75%', backgroundColor: primaryCtaColor }} />
                        </div>
                    </div>
                    {hero.imageUrl ? (
                        <img src={hero.imageUrl} alt="" className="h-28 w-full rounded-2xl border border-white object-cover shadow-sm sm:h-32" />
                    ) : null}
                </div>
            </div>
        </section>
    );
};

const TextField: React.FC<{
    label: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}> = ({ label, value, onChange, disabled }) => (
    <label className="block">
        <span className="block text-sm font-bold text-gray-700 mb-2">{label}</span>
        <input
            aria-label={label}
            title={label}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-200 disabled:bg-gray-100 disabled:text-gray-400"
        />
    </label>
);

const ColorField: React.FC<{
    label: string;
    value: string;
    fallback: string;
    onChange: (value: string) => void;
}> = ({ label, value, fallback, onChange }) => {
    const pickerValue = normalizeColorPickerValue(value, fallback);

    return (
        <label className="block">
            <span className="block text-sm font-bold text-gray-700 mb-2">{label}</span>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-2 focus-within:ring-2 focus-within:ring-amber-200">
                <input
                    type="color"
                    value={pickerValue}
                    onChange={(event) => onChange(event.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-gray-200 bg-white p-1"
                    aria-label={label}
                    title={label}
                />
                <input
                    aria-label={`${label} كنص`}
                    title={`${label} كنص`}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    dir="ltr"
                    placeholder={fallback}
                    className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none"
                />
                <button
                    type="button"
                    onClick={() => onChange('')}
                    className="rounded-lg px-2 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100"
                >
                    افتراضي
                </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5" aria-label={`${label} خيارات ألوان جاهزة`}>
                {COLOR_SWATCHES.map((color) => (
                    <button
                        key={`${label}-${color}`}
                        type="button"
                        onClick={() => onChange(color)}
                        className={`h-7 w-7 rounded-full border shadow-sm transition-transform hover:scale-110 ${
                            value.toLowerCase() === color.toLowerCase() ? 'border-gray-900 ring-2 ring-amber-300' : 'border-gray-200'
                        }`}
                        style={{ backgroundColor: color }}
                        aria-label={`${label} ${color}`}
                        title={color}
                    />
                ))}
            </div>
            <p className="mt-1 text-[11px] text-gray-400">اختر من اللوحة أو استخدم مربع اللون، وسيظهر كود اللون هنا للحفظ.</p>
        </label>
    );
};

const TextAreaField: React.FC<{
    label: string;
    value: string;
    onChange: (value: string) => void;
    rows?: number;
}> = ({ label, value, onChange, rows = 3 }) => (
    <label className="block">
        <span className="block text-sm font-bold text-gray-700 mb-2">{label}</span>
        <textarea
            aria-label={label}
            title={label}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={rows}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-200 resize-y"
        />
    </label>
);

const SelectField: React.FC<{
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
}> = ({ label, value, onChange, options }) => (
    <label className="block">
        <span className="block text-sm font-bold text-gray-700 mb-2">{label}</span>
        <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-200"
        >
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    </label>
);

const SummaryCard: React.FC<{
    label: string;
    value: number;
    tone?: 'blue' | 'amber' | 'emerald' | 'slate' | 'violet';
}> = ({ label, value, tone = 'slate' }) => {
    const tones = {
        blue: 'bg-blue-50 text-blue-700 border-blue-100',
        amber: 'bg-amber-50 text-amber-700 border-amber-100',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        slate: 'bg-slate-50 text-slate-700 border-slate-200',
        violet: 'bg-violet-50 text-violet-700 border-violet-100',
    };

    return (
        <div className={`rounded-2xl border px-4 py-4 ${tones[tone]}`}>
            <div className="text-xs font-bold opacity-80">{label}</div>
            <div className="mt-2 text-2xl font-black">{value}</div>
        </div>
    );
};
