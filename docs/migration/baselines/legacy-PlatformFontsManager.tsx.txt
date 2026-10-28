import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Palette, RotateCcw, Save, Type, Upload } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { PLATFORM_FONT_SETTINGS_UPDATED } from '../../components/PlatformFontBootstrap';
import { PlatformFontFamily, PlatformFontSettings, PlatformFontUpload } from '../../types';
import {
    applyPlatformFontSettings,
    DEFAULT_PLATFORM_FONT_SETTINGS,
    normalizePlatformFontSettings,
    PLATFORM_FONT_OPTIONS,
} from '../../utils/platformFonts';

const MAX_FONT_SIZE_BYTES = 500 * 1024;

type FontTarget = {
    id: 'body' | 'heading' | 'navigation' | 'button';
    title: string;
    description: string;
    fontKey: keyof Pick<PlatformFontSettings, 'bodyFont' | 'headingFont' | 'navigationFont' | 'buttonFont'>;
    sizeKey: keyof Pick<PlatformFontSettings, 'bodySize' | 'headingSize' | 'navigationSize' | 'buttonSize'>;
    weightKey: keyof Pick<PlatformFontSettings, 'bodyWeight' | 'headingWeight' | 'navigationWeight' | 'buttonWeight'>;
    colorKey: keyof Pick<PlatformFontSettings, 'bodyColor' | 'headingColor' | 'navigationColor' | 'buttonColor'>;
    previewClassName: string;
    previewText: string;
};

const FONT_TARGETS: FontTarget[] = [
    {
        id: 'body',
        title: 'النصوص العامة',
        description: 'النصوص الطويلة، وصف الدروس، البطاقات، محتوى الصفحات.',
        fontKey: 'bodyFont',
        sizeKey: 'bodySize',
        weightKey: 'bodyWeight',
        colorKey: 'bodyColor',
        previewClassName: 'text-sm leading-7',
        previewText: 'رحلة تعليمية ذكية تجمع بين التدريب المكثف والتحليل الدقيق لنقاط ضعفك.',
    },
    {
        id: 'heading',
        title: 'العناوين',
        description: 'عناوين الصفحة، العناوين الرئيسية، وعناوين الأقسام المهمة.',
        fontKey: 'headingFont',
        sizeKey: 'headingSize',
        weightKey: 'headingWeight',
        colorKey: 'headingColor',
        previewClassName: 'platform-heading-font text-3xl leading-tight',
        previewText: 'حقق المئة في اختباراتك',
    },
    {
        id: 'navigation',
        title: 'القوائم والتنقل',
        description: 'الشريط العلوي، روابط القائمة، وأزرار التنقل الجانبية.',
        fontKey: 'navigationFont',
        sizeKey: 'navigationSize',
        weightKey: 'navigationWeight',
        colorKey: 'navigationColor',
        previewClassName: 'text-sm',
        previewText: 'الرئيسية   القدرات   التحصيلي   اختباراتي',
    },
    {
        id: 'button',
        title: 'الأزرار',
        description: 'أزرار الدعوة للإجراء، الحفظ، بدء التدريب، وشراء الباقات.',
        fontKey: 'buttonFont',
        sizeKey: 'buttonSize',
        weightKey: 'buttonWeight',
        colorKey: 'buttonColor',
        previewClassName: 'platform-button-font text-sm',
        previewText: 'ابدأ التدريب مجاناً',
    },
];

const FONT_SIZE_OPTIONS = ['', '12px', '13px', '14px', '15px', '16px', '18px', '20px', '24px', '28px', '32px', '36px'];
const FONT_WEIGHT_OPTIONS = ['', '300', '400', '500', '600', '700', '800', '900'];

const readFontFile = (file: File): Promise<PlatformFontUpload> =>
    new Promise((resolve, reject) => {
        if (!['font/woff2', 'font/woff', 'font/ttf', 'font/otf', 'application/font-woff', 'application/x-font-ttf', 'application/octet-stream'].includes(file.type) && !/\.(woff2?|ttf|otf)$/i.test(file.name)) {
            reject(new Error('ارفع ملف خط بصيغة WOFF أو WOFF2 أو TTF أو OTF فقط.'));
            return;
        }

        if (file.size > MAX_FONT_SIZE_BYTES) {
            reject(new Error('حجم الخط كبير. الأفضل أن يكون أقل من 500KB حتى لا يبطئ فتح المنصة.'));
            return;
        }

        const reader = new FileReader();
        reader.onerror = () => reject(new Error('تعذر قراءة ملف الخط.'));
        reader.onload = () => {
            const dataUrl = String(reader.result || '');
            const extension = file.name.split('.').pop()?.toLowerCase();
            const mimeType =
                extension === 'woff2'
                    ? 'font/woff2'
                    : extension === 'ttf'
                        ? 'font/ttf'
                        : extension === 'otf'
                            ? 'font/otf'
                            : 'font/woff';
            resolve({
                name: file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '') || 'PlatformCustomFont',
                dataUrl: dataUrl.replace(/^data:.*?;base64,/, `data:${mimeType};base64,`),
                fileName: file.name,
                mimeType,
                size: file.size,
            });
        };
        reader.readAsDataURL(file);
    });

const getFontLabel = (font?: PlatformFontFamily) =>
    PLATFORM_FONT_OPTIONS.find((option) => option.id === font)?.label || PLATFORM_FONT_OPTIONS[0].label;

export const PlatformFontsManager: React.FC = () => {
    const { user, logout } = useAuth();
    const [settings, setSettings] = useState<PlatformFontSettings>(DEFAULT_PLATFORM_FONT_SETTINGS);
    const [activePreview, setActivePreview] = useState<FontTarget['id']>('body');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const loadSettings = async () => {
            try {
                const response = await api.getPlatformFontSettings();
                if (!cancelled) {
                    const nextSettings = normalizePlatformFontSettings(response as PlatformFontSettings);
                    setSettings(nextSettings);
                    applyPlatformFontSettings(nextSettings);
                }
            } catch (loadError) {
                if (!cancelled) {
                    setError(loadError instanceof Error ? loadError.message : 'تعذر تحميل إعدادات الخطوط.');
                    setSettings(DEFAULT_PLATFORM_FONT_SETTINGS);
                    applyPlatformFontSettings(DEFAULT_PLATFORM_FONT_SETTINGS);
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

    const activeTarget = useMemo(
        () => FONT_TARGETS.find((target) => target.id === activePreview) || FONT_TARGETS[0],
        [activePreview],
    );

    const updateSettings = (patch: Partial<PlatformFontSettings>) => {
        const nextSettings = normalizePlatformFontSettings({ ...settings, ...patch });
        setSettings(nextSettings);
        applyPlatformFontSettings(nextSettings);
        setError(null);
        setSuccess(null);
    };

    const handleFontUpload = async (target: 'body' | 'heading', file?: File) => {
        if (!file) return;
        setError(null);
        setSuccess(null);

        try {
            const upload = await readFontFile(file);
            updateSettings(
                target === 'body'
                    ? { bodyFont: 'custom', bodyCustomFont: upload }
                    : { headingFont: 'custom', headingCustomFont: upload },
            );
        } catch (uploadError) {
            setError(uploadError instanceof Error ? uploadError.message : 'تعذر رفع الخط.');
        }
    };

    const handleSave = async () => {
        setError(null);
        setSuccess(null);

        if (!user) {
            setError('انتهت جلسة الإدارة. سجل الدخول كمدير ثم أعد المحاولة.');
            logout();
            return;
        }

        setIsSaving(true);
        try {
            const response = await api.updatePlatformFontSettings(settings);
            const savedSettings = normalizePlatformFontSettings(response as PlatformFontSettings);
            setSettings(savedSettings);
            applyPlatformFontSettings(savedSettings);
            window.dispatchEvent(new CustomEvent(PLATFORM_FONT_SETTINGS_UPDATED, { detail: savedSettings }));
            setSuccess('تم حفظ إعدادات الخطوط وتطبيقها على المنصة.');
        } catch (saveError) {
            const message = saveError instanceof Error ? saveError.message : 'تعذر حفظ إعدادات الخطوط.';
            setError(message.includes('Authentication required') ? 'انتهت جلسة الإدارة أو لم تصل صلاحية الحفظ للخادم.' : message);
        } finally {
            setIsSaving(false);
        }
    };

    const resetToDefault = () => {
        updateSettings(DEFAULT_PLATFORM_FONT_SETTINGS);
        setSuccess('تمت معاينة الخط الافتراضي. اضغط حفظ التعديلات لتثبيته.');
    };

    const renderTargetControls = (target: FontTarget) => {
        const selectedFont = settings[target.fontKey] as PlatformFontFamily;
        const selectedOption = PLATFORM_FONT_OPTIONS.find((option) => option.id === selectedFont) || PLATFORM_FONT_OPTIONS[0];
        const currentColor = String(settings[target.colorKey] || '');
        const previewStyle: React.CSSProperties = {
            fontSize: String(settings[target.sizeKey] || '') || undefined,
            fontWeight: String(settings[target.weightKey] || '') || undefined,
            color: currentColor || undefined,
        };

        return (
            <section key={target.id} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-black text-gray-900">{target.title}</h2>
                        <p className="mt-1 text-xs leading-5 text-gray-500">{target.description}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setActivePreview(target.id)}
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black transition ${
                            activePreview === target.id
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-gray-50 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700'
                        }`}
                    >
                        <Eye size={14} />
                        معاينة
                    </button>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <label className="block">
                        <span className="mb-2 block text-xs font-black text-gray-600">الخط</span>
                        <select
                            value={selectedFont}
                            onChange={(event) => updateSettings({ [target.fontKey]: event.target.value as PlatformFontFamily })}
                            className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm font-bold text-gray-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        >
                            {PLATFORM_FONT_OPTIONS.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <span className="mt-2 block text-[11px] font-bold leading-5 text-gray-400">{selectedOption.note}</span>
                    </label>

                    <label className="block">
                        <span className="mb-2 block text-xs font-black text-gray-600">الحجم</span>
                        <div className="grid gap-2">
                            <select
                                value={String(settings[target.sizeKey] || '')}
                                onChange={(event) => updateSettings({ [target.sizeKey]: event.target.value })}
                                className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm font-bold text-gray-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            >
                                {FONT_SIZE_OPTIONS.map((size) => (
                                    <option key={size || 'default'} value={size}>
                                        {size || 'حسب التصميم'}
                                    </option>
                                ))}
                            </select>
                            <input
                                aria-label={`حجم ${target.title}`}
                                title={`حجم ${target.title}`}
                                value={String(settings[target.sizeKey] || '')}
                                onChange={(event) => updateSettings({ [target.sizeKey]: event.target.value })}
                                placeholder="مثال: 16px أو 1.2rem"
                                className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm font-bold text-gray-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            />
                        </div>
                    </label>

                    <label className="block">
                        <span className="mb-2 block text-xs font-black text-gray-600">السمك</span>
                        <select
                            value={String(settings[target.weightKey] || '')}
                            onChange={(event) => updateSettings({ [target.weightKey]: event.target.value })}
                            className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm font-bold text-gray-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        >
                            {FONT_WEIGHT_OPTIONS.map((weight) => (
                                <option key={weight || 'default'} value={weight}>
                                    {weight || 'حسب التصميم'}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="block">
                        <span className="mb-2 block text-xs font-black text-gray-600">اللون</span>
                        <div className="flex gap-2">
                            <input
                                type="color"
                                aria-label={`لون ${target.title}`}
                                title={`لون ${target.title}`}
                                value={currentColor || '#111827'}
                                onChange={(event) => updateSettings({ [target.colorKey]: event.target.value })}
                                className="h-12 w-14 rounded-2xl border border-gray-200 bg-white p-1"
                            />
                            <input
                                aria-label={`لون ${target.title} كنص`}
                                title={`لون ${target.title} كنص`}
                                value={currentColor}
                                onChange={(event) => updateSettings({ [target.colorKey]: event.target.value })}
                                placeholder="#111827"
                                className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm font-bold text-gray-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            />
                            <button
                                type="button"
                                onClick={() => updateSettings({ [target.colorKey]: '' })}
                                className="rounded-2xl border border-gray-200 bg-white px-3 text-xs font-black text-gray-600 hover:bg-gray-50"
                            >
                                مسح
                            </button>
                        </div>
                    </label>
                </div>

                <div className="mt-5 rounded-3xl border border-gray-100 bg-gray-50 p-4">
                    <div className="mb-3 flex items-center gap-2 text-[11px] font-black text-gray-400">
                        <Palette size={14} />
                        معاينة {target.title} - {getFontLabel(selectedFont)}
                    </div>
                    <div className={target.previewClassName} style={previewStyle}>
                        {target.previewText}
                    </div>
                </div>
            </section>
        );
    };

    if (isLoading) {
        return (
            <div className="rounded-3xl border border-gray-100 bg-white p-10 text-center shadow-sm">
                <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-2xl bg-indigo-50" />
                <div className="text-sm font-black text-gray-700">جاري تحميل إدارة الخطوط...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
                        <Type size={14} />
                        إعدادات الخطوط المتقدمة
                    </div>
                    <h1 className="mt-3 text-2xl font-black text-gray-900">إدارة خطوط المنصة</h1>
                    <p className="mt-2 text-sm leading-6 text-gray-500">
                        الافتراضي محفوظ كما هو. أي حجم أو سمك أو لون تتركه فارغًا سيظل تابعًا لتصميم المنصة الحالي.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={resetToDefault}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-black text-gray-700 hover:bg-gray-50"
                    >
                        <RotateCcw size={16} />
                        رجوع للافتراضي
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2 text-sm font-black text-white shadow-sm hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <Save size={16} />
                        {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                    </button>
                </div>
            </div>

            {error ? <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}
            {success ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{success}</div> : null}

            <section className="rounded-3xl border border-amber-100 bg-amber-50 p-5">
                <h2 className="text-sm font-black text-amber-800">مكتبة الخطوط الجاهزة</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {PLATFORM_FONT_OPTIONS.filter((option) => option.id !== 'custom').map((option) => (
                        <div key={option.id} className="rounded-2xl border border-amber-100 bg-white/75 p-4">
                            <div className="font-black text-gray-900">{option.label}</div>
                            <div className="mt-1 text-[11px] font-bold leading-5 text-gray-500">{option.note}</div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="grid gap-4 rounded-3xl border border-indigo-100 bg-indigo-50 p-5 lg:grid-cols-[1fr_1.15fr]">
                <div>
                    <div className="text-sm font-black text-indigo-800">المعاينة النشطة</div>
                    <div className="mt-4 flex flex-wrap gap-2">
                        {FONT_TARGETS.map((target) => (
                            <button
                                key={target.id}
                                type="button"
                                onClick={() => setActivePreview(target.id)}
                                className={`rounded-full px-4 py-2 text-xs font-black transition ${
                                    activePreview === target.id
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'bg-white text-gray-600 hover:bg-indigo-100 hover:text-indigo-800'
                                }`}
                            >
                                {target.title}
                            </button>
                        ))}
                    </div>
                    <p className="mt-4 text-xs leading-6 text-indigo-700">{activeTarget.description}</p>
                </div>
                <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <div className={activeTarget.previewClassName} style={{
                        fontSize: String(settings[activeTarget.sizeKey] || '') || undefined,
                        fontWeight: String(settings[activeTarget.weightKey] || '') || undefined,
                        color: String(settings[activeTarget.colorKey] || '') || undefined,
                    }}>
                        {activeTarget.previewText}
                    </div>
                </div>
            </section>

            <div className="grid gap-5 xl:grid-cols-2">
                {FONT_TARGETS.map(renderTargetControls)}
            </div>

            <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2 text-sm font-black text-gray-700">
                    <Upload size={16} />
                    رفع خط مخصص
                </div>
                <p className="text-xs leading-6 text-gray-500">
                    استخدم الرفع عند وجود خط مرخص خاص بالمنصة. الحد 500KB حتى لا يتأثر تحميل الموقع. يمكن تطبيق الخط المخصص على النصوص أو العناوين.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {[
                        { target: 'body' as const, label: 'خط مخصص للنصوص', customFont: settings.bodyCustomFont },
                        { target: 'heading' as const, label: 'خط مخصص للعناوين', customFont: settings.headingCustomFont },
                    ].map((item) => (
                        <label key={item.target} className="cursor-pointer rounded-3xl border border-dashed border-indigo-200 bg-indigo-50/60 p-4 text-sm font-black text-indigo-700 hover:bg-indigo-50">
                            <span className="inline-flex items-center gap-2">
                                <Upload size={16} />
                                {item.label}
                            </span>
                            <span className="mt-2 block text-[11px] font-bold text-indigo-500">WOFF/WOFF2/TTF/OTF حتى 500KB</span>
                            {item.customFont?.fileName ? (
                                <span className="mt-3 block rounded-2xl bg-white px-3 py-2 text-xs font-bold text-gray-600">
                                    الملف الحالي: {item.customFont.fileName} - {Math.round((item.customFont.size || 0) / 1024)}KB
                                </span>
                            ) : null}
                            <input
                                type="file"
                                aria-label={`رفع ملف ${item.label}`}
                                accept=".woff,.woff2,.ttf,.otf,font/woff,font/woff2"
                                className="hidden"
                                onChange={(event) => void handleFontUpload(item.target, event.target.files?.[0])}
                            />
                        </label>
                    ))}
                </div>
            </section>
        </div>
    );
};
