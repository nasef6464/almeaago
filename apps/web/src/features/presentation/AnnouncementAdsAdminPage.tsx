import React, { useMemo, useState } from 'react';
import { Copy, ExternalLink, Eye, ImagePlus, Megaphone, Plus, Sparkles, Trash2 } from 'lucide-react';
import type {
  AnnouncementAd,
  AnnouncementAudience,
  AnnouncementDisplayMode,
  AnnouncementFrequency,
  AnnouncementImageFit,
} from './announcement-types';
import { useAnnouncementAds } from './useAnnouncementAds';
import { ANNOUNCEMENT_AD_PREVIEW_EVENT } from './AnnouncementAdsOverlay';

const MAX_AD_IMAGE_BYTES = 900 * 1024;

const audienceLabels: Record<AnnouncementAudience, string> = {
  all: 'كل الزوار',
  guest: 'غير المسجلين',
  student: 'الطلاب',
  parent: 'أولياء الأمور',
  staff: 'الإدارة والفريق',
};

const displayModeLabels: Record<AnnouncementDisplayMode, string> = {
  modal: 'نافذة وسط الشاشة',
  'top-banner': 'شريط علوي خفيف',
};

const frequencyLabels: Record<AnnouncementFrequency, string> = {
  session: 'مرة في الجلسة',
  once: 'مرة واحدة فقط',
  always: 'كل زيارة',
};

const imageFitLabels: Record<AnnouncementImageFit, string> = {
  cover: 'ملء المساحة',
  contain: 'إظهار الصورة كاملة',
};

const PLATFORM_PRESET_IMAGES = [
  { title: 'استوديو التابلت الذكي', subtitle: 'تدريب تفاعلي ومؤشرات حية', url: '/images/smart-learning-tablet.jpg' },
  { title: 'إتقان القدرات والكمي', subtitle: 'حلول ذكية للمسائل', url: '/images/daylight-qudrat-math.jpg' },
  { title: 'مختبر التحصيلي العلمي', subtitle: 'علوم ورياضيات', url: '/images/daylight-tahsili-science.jpg' },
  { title: 'محاكاة قياس بالوقت', subtitle: 'بيئة اختبارية مطابقة', url: '/images/daylight-mock-simulation.jpg' },
  { title: 'المعلم الآلي الذكي AI', subtitle: 'توجيه وتحليل فوري', url: '/images/daylight-ai-tutor.jpg' },
  { title: 'فرحة الـ 100% والتفوق', subtitle: 'الكأس الذهبي والقبول', url: '/images/daylight-celebration-100.jpg' },
  { title: 'حلبة التنافس المدرسي', subtitle: 'مسابقات الفصول والمدارس', url: '/images/daylight-school-arena.jpg' },
  { title: 'بطل القدرات العامة', subtitle: 'كمي ولفظي', url: '/images/qudrat-champion.jpg' },
  { title: 'التميز التحصيلي', subtitle: 'علوم ورياضيات', url: '/images/tahsili-excellence.jpg' },
  { title: 'محاكاة اختبارات قياس', subtitle: 'بيئة اختبارية مطابقة', url: '/images/mock-exam-simulation.jpg' },
  { title: 'المعلم الذكي AI', subtitle: 'تحليل وتدريب موجه', url: '/images/ai-smart-tutor.jpg' },
  { title: 'فرحة التفوق 100%', subtitle: 'حقق المئة واستعد للجامعة', url: '/images/score-celebration.jpg' },
  { title: 'ميدان التنافس والفصول', subtitle: 'تحديات جماعية للمدارس', url: '/images/classroom-arena.jpg' },
];

const AD_TEMPLATES = [
  {
    title: 'مفاجأة سارة - خصم خاص على الاشتراكات',
    body: 'استفد من العرض الحصري لمنصة المئة واشترك الآن للوصول الكامل إلى بنك الأسئلة والشروحات التفاعلية.',
    ctaLabel: 'استفد من العرض الآن',
    ctaUrl: '/pricing',
    imageUrl: '/images/score-celebration.jpg',
    audience: 'all' as AnnouncementAudience,
    displayMode: 'modal' as AnnouncementDisplayMode,
    frequency: 'session' as AnnouncementFrequency,
    priority: 5,
  },
  {
    title: 'انطلاق تدريب مسار القدرات العامة',
    body: 'ابدأ خطتك المكثفة مع شروحات الكمي واللفظي واختبارات المحاكاة الذكية المقاسة بالوقت.',
    ctaLabel: 'ابدأ التدريب فوراً',
    ctaUrl: '/category/018f0000-0000-7000-8000-000000000030',
    imageUrl: '/images/qudrat-champion.jpg',
    audience: 'student' as AnnouncementAudience,
    displayMode: 'modal' as AnnouncementDisplayMode,
    frequency: 'session' as AnnouncementFrequency,
    priority: 10,
  },
  {
    title: 'اختبارات نافس الوطنية المحاكية',
    body: 'قيّم مهاراتك في اختبارات نافس الوزارية مع تصحيح فوري ورصد للمفاهيم التي تحتاج تقوية.',
    ctaLabel: 'خُض الاختبار التجريبي',
    ctaUrl: '/category/a5d9b9ec-625e-5eb1-87b9-0cd8f6073a44',
    imageUrl: '/images/mock-exam-simulation.jpg',
    audience: 'student' as AnnouncementAudience,
    displayMode: 'top-banner' as AnnouncementDisplayMode,
    frequency: 'always' as AnnouncementFrequency,
    priority: 15,
  },
  {
    title: 'بوابة المدارس والفصول الذكية',
    body: 'اربط مدرستك وفصولك الذكية بمنصة المئة لتحصل على تقارير تفصيلية ومتابعة مستمرة لطلابك.',
    ctaLabel: 'استكشف بوابة المدارس',
    ctaUrl: '/admin-dashboard/schools',
    imageUrl: '/images/classroom-arena.jpg',
    audience: 'staff' as AnnouncementAudience,
    displayMode: 'modal' as AnnouncementDisplayMode,
    frequency: 'session' as AnnouncementFrequency,
    priority: 20,
  },
];

const QUICK_DESTINATIONS = [
  { label: 'مسار القدرات', url: '/category/018f0000-0000-7000-8000-000000000030', cta: 'ابدأ التدريب' },
  { label: 'مسار التحصيلي', url: '/category/d242dd63-2c42-54e1-81da-37322e5234a7', cta: 'استكشف التحصيلي' },
  { label: 'اختبارات نافس', url: '/category/a5d9b9ec-625e-5eb1-87b9-0cd8f6073a44', cta: 'خُض الاختبار' },
  { label: 'باقات المنصة', url: '/pricing', cta: 'اشترك الآن' },
  { label: 'تشغيل المدارس', url: '/admin-dashboard/schools', cta: 'إدارة المدارس' },
  { label: 'الرئيسية', url: '/', cta: 'الرئيسية' },
];

const createDefaultAd = (): AnnouncementAd => ({
  id: `ad_${Date.now()}`,
  title: 'إعلان جديد',
  body: '',
  imageUrl: '',
  ctaLabel: 'افتح الآن',
  ctaUrl: '/',
  audience: 'all',
  displayMode: 'modal',
  frequency: 'session',
  imageFit: 'cover',
  delaySeconds: 0,
  isActive: true,
  priority: 10,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export function AnnouncementAdsAdminPage() {
  const { ads, createAd, updateAd, deleteAd } = useAnnouncementAds();
  const [selectedId, setSelectedId] = useState(ads[0]?.id || '');
  const [feedback, setFeedback] = useState('');
  const [previewTab, setPreviewTab] = useState<'modal' | 'banner'>('modal');

  const sortedAds = useMemo(
    () => [...ads].sort((a, b) => a.priority - b.priority || b.createdAt - a.createdAt),
    [ads],
  );

  const selectedAd = sortedAds.find((ad) => ad.id === selectedId) || sortedAds[0];
  const activeCount = sortedAds.filter((ad) => ad.isActive).length;

  const handleAddAd = () => {
    const nextAd = createDefaultAd();
    createAd(nextAd);
    setSelectedId(nextAd.id);
    setFeedback('تم إنشاء إعلان جديد.');
  };

  const applyTemplate = (template: typeof AD_TEMPLATES[number]) => {
    const nextAd: AnnouncementAd = {
      ...createDefaultAd(),
      ...template,
      id: `ad_${Date.now()}`,
    };
    createAd(nextAd);
    setSelectedId(nextAd.id);
    setFeedback(`تم إنشاء إعلان جديد من قالب "${template.title}".`);
  };

  const duplicateSelected = () => {
    if (!selectedAd) return;
    const duplicated: AnnouncementAd = {
      ...selectedAd,
      id: `ad_${Date.now()}`,
      title: `[نسخة] ${selectedAd.title}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    createAd(duplicated);
    setSelectedId(duplicated.id);
    setFeedback('تم تكرار الإعلان بنجاح.');
  };

  const updateSelected = (data: Partial<AnnouncementAd>) => {
    if (!selectedAd) return;
    updateAd(selectedAd.id, data);
    setFeedback('تم حفظ التعديل.');
  };

  const previewSelected = () => {
    if (!selectedAd) return;
    window.dispatchEvent(new CustomEvent(ANNOUNCEMENT_AD_PREVIEW_EVENT, { detail: { id: selectedAd.id } }));
    setFeedback('تم فتح معاينة الإعلان على الموقع.');
  };

  const handleImageUpload = (file?: File) => {
    if (!file || !selectedAd) return;
    if (file.size > MAX_AD_IMAGE_BYTES) {
      setFeedback('الصورة كبيرة. يفضل صورة أقل من 900KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateSelected({ imageUrl: String(reader.result || '') });
      setFeedback('تم رفع صورة الإعلان.');
    };
    reader.readAsDataURL(file);
  };

  return (
    <main dir="rtl" className="mx-auto max-w-7xl space-y-6 pb-16 font-sans">
      {/* ── Header ── */}
      <header className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800 border border-amber-200/60">
                <Megaphone size={14} /> إدارة الإعلانات
              </span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-black text-emerald-700 border border-emerald-200">
                {activeCount} نشط من {sortedAds.length}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-black text-slate-900 tracking-tight">الإعلانات العائمة والتنبيهات الترويجية</h1>
            <p className="mt-1 text-xs font-medium text-slate-500 leading-6">
              أنشئ إعلانًا بصورة أو رسالة مختصرة، وحدد الجمهور وزر الانتقال داخل المنصة وتوقيت الظهور.
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleAddAd}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white shadow-xs hover:bg-indigo-700 transition cursor-pointer"
            >
              <Plus size={16} />
              <span>إعلان جديد</span>
            </button>
          </div>
        </div>

        {/* ── القوالب الجاهزة ── */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 mb-2.5 text-xs font-black text-slate-700">
            <Sparkles size={14} className="text-amber-500" />
            <span>قوالب إعلانية جاهزة للمنصة (انقر للإنشاء الفوري):</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
            {AD_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.title}
                type="button"
                onClick={() => applyTemplate(tmpl)}
                className="flex flex-col text-right p-3 rounded-xl border border-slate-200/70 bg-slate-50/70 hover:bg-indigo-50/60 hover:border-indigo-200 transition-all cursor-pointer group"
              >
                <span className="text-xs font-black text-slate-900 group-hover:text-indigo-700 line-clamp-1">{tmpl.title}</span>
                <span className="mt-1 text-[11px] text-slate-500 line-clamp-1">{tmpl.body}</span>
                <span className="mt-2 text-[10px] font-bold text-indigo-600 bg-white/80 self-start px-2 py-0.5 rounded border border-slate-200/60">
                  + استخدام القالب
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {feedback ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 animate-fade-in flex items-center justify-between">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback('')} className="text-emerald-700 hover:text-emerald-900">✕</button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[300px_1fr]">
        {/* ── القائمة الجانبية للإعلانات ── */}
        <div className="space-y-2.5">
          <div className="text-xs font-black text-slate-500 px-1">قائمة الإعلانات المسجلة ({sortedAds.length})</div>
          {sortedAds.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-xs font-bold text-slate-400">
              لا توجد إعلانات بعد. اضغط "إعلان جديد" للبدء.
            </div>
          ) : (
            sortedAds.map((ad) => (
              <div
                key={ad.id}
                onClick={() => setSelectedId(ad.id)}
                className={`rounded-2xl border p-3.5 text-right shadow-2xs transition-all cursor-pointer ${
                  selectedAd?.id === ad.id
                    ? 'border-indigo-400 bg-indigo-50/70 shadow-xs ring-1 ring-indigo-200'
                    : 'border-slate-200/80 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-black text-slate-900 leading-snug line-clamp-1">{ad.title}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateAd(ad.id, { isActive: !ad.isActive });
                    }}
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black transition-colors ${
                      ad.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {ad.isActive ? 'نشط' : 'متوقف'}
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 font-bold">
                  <span>{audienceLabels[ad.audience]}</span>
                  <span className="text-[10px] text-slate-400">{displayModeLabels[ad.displayMode || 'modal']}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── نموذج التعديل والمعاينة ── */}
        {selectedAd ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 md:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-base font-black text-slate-900">تعديل الإعلان: {selectedAd.title}</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={previewSelected}
                    className="inline-flex items-center gap-1 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-black text-slate-950 shadow-xs hover:bg-amber-400 transition"
                  >
                    <Eye size={14} />
                    <span>معاينة حية</span>
                  </button>
                  <button
                    type="button"
                    onClick={duplicateSelected}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-100"
                  >
                    <Copy size={13} />
                    <span>نسخ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`هل أنت متأكد من حذف الإعلان "${selectedAd.title}"؟`)) {
                        deleteAd(selectedAd.id);
                        setFeedback('تم حذف الإعلان.');
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100"
                  >
                    <Trash2 size={13} />
                    <span>حذف</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-xs font-bold text-slate-700">عنوان الإعلان</span>
                  <input
                    value={selectedAd.title}
                    onChange={(event) => updateSelected({ title: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold outline-none focus:border-indigo-400"
                  />
                </label>

                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-xs font-bold text-slate-700">النص المختصر</span>
                  <textarea
                    value={selectedAd.body || ''}
                    onChange={(event) => updateSelected({ body: event.target.value })}
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-indigo-400"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-700">الجمهور المستهدف</span>
                  <select
                    value={selectedAd.audience}
                    onChange={(event) => updateSelected({ audience: event.target.value as AnnouncementAudience })}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold outline-none focus:border-indigo-400"
                  >
                    {Object.entries(audienceLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-700">شكل الظهور</span>
                  <select
                    value={selectedAd.displayMode || 'modal'}
                    onChange={(event) => updateSelected({ displayMode: event.target.value as AnnouncementDisplayMode })}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold outline-none focus:border-indigo-400"
                  >
                    {Object.entries(displayModeLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-700">تكرار الظهور</span>
                  <select
                    value={selectedAd.frequency || 'session'}
                    onChange={(event) => updateSelected({ frequency: event.target.value as AnnouncementFrequency })}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold outline-none focus:border-indigo-400"
                  >
                    {Object.entries(frequencyLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-700">التأخير قبل الظهور (ثوانٍ)</span>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={selectedAd.delaySeconds ?? 0}
                    onChange={(event) => updateSelected({ delaySeconds: Number(event.target.value) || 0 })}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold outline-none focus:border-indigo-400"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-700">نص زر الإجراء (CTA)</span>
                  <input
                    value={selectedAd.ctaLabel || ''}
                    onChange={(event) => updateSelected({ ctaLabel: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold outline-none focus:border-indigo-400"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-700">رابط زر الإجراء (URL)</span>
                  <input
                    value={selectedAd.ctaUrl || ''}
                    onChange={(event) => updateSelected({ ctaUrl: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-mono outline-none focus:border-indigo-400"
                  />
                </label>
              </div>

              {/* ── وجهات سريعة ── */}
              <div className="pt-2">
                <span className="text-[11px] font-black text-slate-500">وجهات سريعة داخل المنصة:</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {QUICK_DESTINATIONS.map((dest) => (
                    <button
                      key={dest.label}
                      type="button"
                      onClick={() => updateSelected({ ctaUrl: dest.url, ctaLabel: dest.cta })}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:border-indigo-200 hover:bg-indigo-50"
                    >
                      {dest.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── اختيار وتخصيص صورة الإعلان ── */}
              <div className="space-y-2 pt-2 border-t">
                <span className="text-xs font-bold text-slate-700">صورة الإعلان</span>
                <div className="flex items-center gap-2">
                  <input
                    value={selectedAd.imageUrl || ''}
                    placeholder="رابط الصورة أو اختر من المعرض أدناه..."
                    onChange={(event) => updateSelected({ imageUrl: event.target.value })}
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono outline-none focus:border-indigo-400"
                  />
                  <label className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-100 cursor-pointer">
                    <ImagePlus size={14} />
                    <span>رفع</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e.target.files?.[0])}
                    />
                  </label>
                </div>

                <div className="mt-3">
                  <span className="text-[11px] font-black text-slate-500">معرض صور المنصة الجاهزة (انقر للاختيار):</span>
                  <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1 border rounded-xl">
                    {PLATFORM_PRESET_IMAGES.map((img) => (
                      <button
                        key={img.url}
                        type="button"
                        onClick={() => updateSelected({ imageUrl: img.url })}
                        className={`group relative rounded-lg overflow-hidden border transition ${
                          selectedAd.imageUrl === img.url ? 'ring-2 ring-indigo-600 border-indigo-600' : 'border-slate-200 hover:border-indigo-300'
                        }`}
                        title={`${img.title} - ${img.subtitle}`}
                      >
                        <img src={img.url} alt={img.title} className="h-14 w-full object-cover" />
                        <span className="absolute inset-x-0 bottom-0 bg-black/70 p-0.5 text-[9px] font-black text-white text-center truncate block">
                          {img.title}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── المعاينة المصغرة ── */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-black text-slate-700">المعاينة التقريبية</span>
                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  {displayModeLabels[selectedAd.displayMode || 'modal']}
                </span>
              </div>

              {selectedAd.displayMode === 'top-banner' ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    {selectedAd.imageUrl ? (
                      <img src={selectedAd.imageUrl} alt="" className="h-10 w-14 rounded object-cover" />
                    ) : (
                      <div className="h-10 w-14 rounded bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">
                        إعلان
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-black text-slate-900 truncate">{selectedAd.title}</div>
                      {selectedAd.body ? <div className="text-[10px] text-slate-500 truncate">{selectedAd.body}</div> : null}
                    </div>
                  </div>
                  {selectedAd.ctaLabel ? (
                    <div className="text-center rounded-lg bg-amber-500 py-1 text-xs font-black text-slate-950">
                      {selectedAd.ctaLabel}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                  {selectedAd.imageUrl ? (
                    <img src={selectedAd.imageUrl} alt="" className="h-32 w-full object-cover" />
                  ) : (
                    <div className="h-20 bg-indigo-900 text-white p-3 flex items-center justify-center font-black text-xs">
                      {selectedAd.title}
                    </div>
                  )}
                  <div className="p-3 space-y-2">
                    <div className="text-xs font-black text-slate-900">{selectedAd.title}</div>
                    {selectedAd.body ? <div className="text-[11px] text-slate-500 leading-snug">{selectedAd.body}</div> : null}
                    {selectedAd.ctaLabel ? (
                      <div className="text-center rounded-xl bg-amber-500 py-2 text-xs font-black text-slate-950 shadow-sm">
                        {selectedAd.ctaLabel}
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
