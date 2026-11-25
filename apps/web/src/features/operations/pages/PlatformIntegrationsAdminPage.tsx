import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  Layers,
  Loader2,
  MessageSquare,
  RefreshCw,
  Save,
  UserCheck,
  Video,
} from 'lucide-react';
import { useAuth } from '../../auth/state/AuthProvider';
import { operationsClient } from '../api/operations-client';
import type {
  IntegrationRuntimeStatus,
  PlatformAuthSettings,
  PlatformContactWidgetSettings,
  PlatformProviderSetting,
  PlatformSEOSettings,
} from '../api/operations-types';

const DEFAULT_AUTH: PlatformAuthSettings = {
  allowSelfRegistration: true,
  allowEmailPassword: true,
  requireEmailVerification: false,
  requireAdminApproval: false,
  defaultRole: 'student',
  registrationTitle: 'انضم إلى مجتمع المئة التعليمي',
  registrationSubtitle: 'سجّل حسابك للوصول إلى كافة شروحات وتدريبات قياس',
  termsLink: '/terms',
  privacyLink: '/privacy',
  maxAccountsPerDevice: 3,
};

const DEFAULT_PROVIDERS: Record<string, PlatformProviderSetting> = {
  googleMeet: { enabled: true, mode: 'oauth', note: 'مربوط للاجتماعات الفردية والجماعية' },
  zoom: { enabled: false, mode: 'oauth', note: 'غير مفعل' },
  teams: { enabled: false, mode: 'oauth', note: 'غير مفعل' },
  youtubeLive: { enabled: false, mode: 'api', note: 'بث الحصص العامة' },
  googleOAuth: { enabled: true, mode: 'oauth', note: 'تسجيل الدخول السريع عبر Google' },
  whatsappOTP: { enabled: false, mode: 'otp', note: 'التحقق عبر الواتساب' },
};

const DEFAULT_SEO: PlatformSEOSettings = {
  siteName: 'منصة المئة - قدرات & تحصيلي',
  defaultTitle: 'منصة المئة | المنصة المتكاملة للقدرات والتحصيلي ونافس',
  defaultDescription: 'شروحات تأسيسية وبنك أسئلة ذكي ومحاكاة دقيقة لاختبارات قياس مع المعلم الآلي وتتبع دقيق للمهارات.',
  canonicalBaseUrl: 'https://almeaa.com',
  googleAnalyticsId: '',
  googleTagManagerId: '',
  robotsIndexing: true,
};

const DEFAULT_CONTACT_WIDGET: PlatformContactWidgetSettings = {
  enabled: true,
  channel: 'whatsapp',
  whatsappNumber: '+966500000000',
  whatsappMessage: 'مرحبا، أرغب في الاستفسار عن منصة المعا',
  openInNewTab: true,
  showOnPublicPages: true,
  showOnDashboardPages: true,
};

export function PlatformIntegrationsAdminPage() {
  const { user, loading: authLoading, getCsrfToken } = useAuth();
  const [activeTab, setActiveTab] = useState<'auth' | 'providers' | 'seo' | 'contact'>('auth');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [revision, setRevision] = useState<number>(1);
  const [runtimeStatus, setRuntimeStatus] = useState<Record<string, IntegrationRuntimeStatus>>({});
  const [reloadTick, setReloadTick] = useState(0);

  const [authConfig, setAuthConfig] = useState<PlatformAuthSettings>(DEFAULT_AUTH);
  const [providers, setProviders] = useState<Record<string, PlatformProviderSetting>>(DEFAULT_PROVIDERS);
  const [seoConfig, setSeoConfig] = useState<PlatformSEOSettings>(DEFAULT_SEO);
  const [contactWidget, setContactWidget] = useState<PlatformContactWidgetSettings>(DEFAULT_CONTACT_WIDGET);

  useEffect(() => {
    if (authLoading || !user || !user.roles.includes('admin')) {
      if (!authLoading) setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    operationsClient
      .getIntegrations(controller.signal)
      .then((res) => {
        if (res.settings) {
          setAuthConfig({ ...DEFAULT_AUTH, ...res.settings.auth });
          setProviders({ ...DEFAULT_PROVIDERS, ...res.settings.providers });
          setSeoConfig({ ...DEFAULT_SEO, ...res.settings.seo });
          setContactWidget({ ...DEFAULT_CONTACT_WIDGET, ...res.settings.contactWidget });
        }
        setRevision(res.revision || 1);
        setRuntimeStatus(res.runtimeStatus || {});
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'تعذر تحميل إعدادات التكاملات');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [authLoading, user, reloadTick]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');
      setNotice('');
      const csrf = await getCsrfToken();
      const res = await operationsClient.updateIntegrations(
        {
          auth: authConfig,
          providers,
          seo: seoConfig,
          contactWidget,
          expectedRevision: revision,
        },
        csrf,
      );
      if (res.settings) {
        setAuthConfig({ ...DEFAULT_AUTH, ...res.settings.auth });
        setProviders({ ...DEFAULT_PROVIDERS, ...res.settings.providers });
        setSeoConfig({ ...DEFAULT_SEO, ...res.settings.seo });
        setContactWidget({ ...DEFAULT_CONTACT_WIDGET, ...res.settings.contactWidget });
      }
      setRevision(res.revision || revision + 1);
      if (res.runtimeStatus) setRuntimeStatus(res.runtimeStatus);
      setNotice('تم حفظ إعدادات التكاملات والتسجيل في قاعدة البيانات بنجاح.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ إعدادات التكاملات');
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <main dir="rtl" className="p-10 text-center font-black text-slate-600">
        جاري تحميل إعدادات التكاملات وبوابة التسجيل...
      </main>
    );
  }

  if (!user || !user.roles.includes('admin')) {
    return (
      <main dir="rtl" className="p-10 text-center font-black text-rose-700">
        هذه الشاشة لمدير المنصة فقط.
      </main>
    );
  }

  const providerCards = [
    { id: 'googleMeet', name: 'Google Meet', desc: 'جلسات فورية بروابط تلقائية وحساب Google Workspace.', tag: 'فصول ذكية', runtimeKey: '' },
    { id: 'zoom', name: 'Zoom Meetings', desc: 'جلسات الفيديو عالية الدقة وتسجيل السحابة.', tag: 'اجتماعات', runtimeKey: '' },
    { id: 'teams', name: 'Microsoft Teams', desc: 'فصول تفاعلية للبيئات التعليمية والمدرسية.', tag: 'مدارس', runtimeKey: '' },
    { id: 'youtubeLive', name: 'YouTube Live', desc: 'بث الدروس العامة والمراجعات المكثفة المفتوحة.', tag: 'بث عام', runtimeKey: '' },
    { id: 'googleOAuth', name: 'تسجيل الدخول Google', desc: 'تسجيل دخول بنقرة واحدة بحسابات Google للطلاب والمعلمين.', tag: 'دخول سريع', runtimeKey: 'google_oauth' },
    { id: 'whatsappOTP', name: 'تحقق WhatsApp OTP', desc: 'إرسال رموز التفعيل والتحقق عبر الواتساب.', tag: 'رسائل', runtimeKey: 'whatsapp' },
  ];

  return (
    <main dir="rtl" className="mx-auto max-w-7xl space-y-6 pb-16 font-sans">
      {/* Header */}
      <header className="rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black text-indigo-200">
              <Layers size={14} className="text-amber-400" />
              <span>PLATFORM INTEGRATIONS & SETTINGS · REV {revision}</span>
            </div>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">إدارة التكاملات وبوابة التسجيل</h1>
            <p className="mt-1 text-xs font-bold text-indigo-200 sm:text-sm">
              التحكم بإعدادات التسجيل، مزودي الفصول الافتراضية، الهوية الرقمية SEO، وودجت الدعم المباشر.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setReloadTick((v) => v + 1)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-xs font-black text-white hover:bg-white/10 transition cursor-pointer"
            >
              <RefreshCw size={15} />
              <span>تحديث</span>
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-xs font-black text-slate-950 shadow-md hover:bg-amber-400 disabled:opacity-50 transition cursor-pointer"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>{isSaving ? 'جاري الحفظ...' : 'حفظ كافة الإعدادات'}</span>
            </button>
          </div>
        </div>
      </header>

      {error ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-black text-rose-800 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-600" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError('')} className="text-rose-700 hover:text-rose-900">✕</button>
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-black text-emerald-800 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>{notice}</span>
          </div>
          <button type="button" onClick={() => setNotice('')} className="text-emerald-700 hover:text-emerald-900">✕</button>
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-2 overflow-x-auto pb-px">
        {[
          { id: 'auth', label: 'إعدادات التسجيل والحسابات', icon: UserCheck },
          { id: 'providers', label: 'مزودو الفصول والبث المباشر', icon: Video },
          { id: 'seo', label: 'محركات البحث وSEO', icon: Globe },
          { id: 'contact', label: 'ودجت الدعم المباشر', icon: MessageSquare },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-black transition-all border-b-2 -mb-px whitespace-nowrap cursor-pointer ${
                active
                  ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-xl'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Tab: Auth & Registration ── */}
      {activeTab === 'auth' && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-6">
          <div className="border-b pb-4">
            <h2 className="text-base font-black text-slate-900">بوابة التسجيل وإدارة الهوية</h2>
            <p className="mt-1 text-xs font-bold text-slate-500">
              التحكم بفتح التسجيل الذاتي، الشروط، سياسة الخصوصية، والصلاحيات الافتراضية.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center justify-between rounded-2xl border p-4 hover:bg-slate-50 cursor-pointer">
              <div>
                <span className="block text-xs font-black text-slate-900">السماح بالتسجيل الذاتي</span>
                <span className="block text-[11px] font-bold text-slate-500 mt-0.5">يمكن لأي زائر إنشاء حساب جديد مباشرة.</span>
              </div>
              <input
                type="checkbox"
                checked={authConfig.allowSelfRegistration}
                onChange={(e) => setAuthConfig({ ...authConfig, allowSelfRegistration: e.target.checked })}
                className="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between rounded-2xl border p-4 hover:bg-slate-50 cursor-pointer">
              <div>
                <span className="block text-xs font-black text-slate-900">تسجيل الدخول بالبريد وكلمة المرور</span>
                <span className="block text-[11px] font-bold text-slate-500 mt-0.5">تمكين الدخول بالبيانات المباشرة بالإضافة للدخول السريع.</span>
              </div>
              <input
                type="checkbox"
                checked={authConfig.allowEmailPassword}
                onChange={(e) => setAuthConfig({ ...authConfig, allowEmailPassword: e.target.checked })}
                className="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between rounded-2xl border p-4 hover:bg-slate-50 cursor-pointer">
              <div>
                <span className="block text-xs font-black text-slate-900">اشتراط التحقق من البريد الإلكتروني</span>
                <span className="block text-[11px] font-bold text-slate-500 mt-0.5">إلزام المستخدم بتأكيد حسابه برمز التحقق قبل فتح الخدمات.</span>
              </div>
              <input
                type="checkbox"
                checked={authConfig.requireEmailVerification}
                onChange={(e) => setAuthConfig({ ...authConfig, requireEmailVerification: e.target.checked })}
                className="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between rounded-2xl border p-4 hover:bg-slate-50 cursor-pointer">
              <div>
                <span className="block text-xs font-black text-slate-900">اشتراط موافقة الإدارة عند التسجيل</span>
                <span className="block text-[11px] font-bold text-slate-500 mt-0.5">مراجعة الحسابات الجديدة من قِبل الإدارة قبل التفعيل.</span>
              </div>
              <input
                type="checkbox"
                checked={authConfig.requireAdminApproval}
                onChange={(e) => setAuthConfig({ ...authConfig, requireAdminApproval: e.target.checked })}
                className="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between rounded-2xl border p-4 hover:bg-slate-50 cursor-pointer">
              <div>
                <span className="block text-xs font-black text-slate-900">الدور الافتراضي للتسجيل الجديد</span>
                <span className="block text-[11px] font-bold text-slate-500 mt-0.5">الدور الممنوح تلقائيًا عند التسجيل الذاتي.</span>
              </div>
              <select
                aria-label="الدور الافتراضي للتسجيل الجديد"
                value={authConfig.defaultRole}
                onChange={(e) => setAuthConfig({ ...authConfig, defaultRole: e.target.value })}
                className="rounded-xl border p-2 text-xs font-black bg-white"
              >
                <option value="student">طالب (student)</option>
                <option value="parent">ولي أمر (parent)</option>
              </select>
            </label>

            <label className="flex items-center justify-between rounded-2xl border p-4 hover:bg-slate-50 cursor-pointer">
              <div>
                <span className="block text-xs font-black text-slate-900">الحد الأقصى للحسابات لكل جهاز</span>
                <span className="block text-[11px] font-bold text-slate-500 mt-0.5">منع إساءة استخدام التسجيل التجريبي من نفس المتصفح.</span>
              </div>
              <input
                type="number"
                min={1}
                max={20}
                value={authConfig.maxAccountsPerDevice}
                onChange={(e) => setAuthConfig({ ...authConfig, maxAccountsPerDevice: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })}
                className="w-20 rounded-xl border p-2 text-center text-xs font-black"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">عنوان نافذة التسجيل</label>
              <input
                value={authConfig.registrationTitle}
                onChange={(e) => setAuthConfig({ ...authConfig, registrationTitle: e.target.value })}
                className="w-full rounded-xl border p-2.5 text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">الوصف الفرعي لنافذة التسجيل</label>
              <input
                value={authConfig.registrationSubtitle}
                onChange={(e) => setAuthConfig({ ...authConfig, registrationSubtitle: e.target.value })}
                className="w-full rounded-xl border p-2.5 text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">رابط الشروط والأحكام</label>
              <input
                value={authConfig.termsLink}
                onChange={(e) => setAuthConfig({ ...authConfig, termsLink: e.target.value })}
                className="w-full rounded-xl border p-2.5 text-xs font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">رابط سياسة الخصوصية</label>
              <input
                value={authConfig.privacyLink}
                onChange={(e) => setAuthConfig({ ...authConfig, privacyLink: e.target.value })}
                className="w-full rounded-xl border p-2.5 text-xs font-mono font-bold"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Virtual Classrooms & Providers ── */}
      {activeTab === 'providers' && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-6">
          <div className="border-b pb-4">
            <h2 className="text-base font-black text-slate-900">مزودو الفصول الافتراضية وحصص البث المباشر</h2>
            <p className="mt-1 text-xs font-bold text-slate-500">
              تحديد المنصات المتاحة للمعلمين والمدربين عند إنشاء جلسات تفاعلية ذكية. مفاتيح API تبقى في بيئة الخادم الآمنة ولا تُعاد للمتصفح.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {providerCards.map((p) => {
              const current = providers[p.id] || { enabled: false, mode: 'oauth', note: '' };
              const rt = p.runtimeKey ? runtimeStatus[p.runtimeKey] : undefined;
              return (
                <div key={p.id} className="rounded-2xl border p-5 space-y-3 bg-white shadow-2xs hover:shadow-xs transition">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-black text-slate-900">{p.name}</span>
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-black text-indigo-700">
                      {p.tag}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-500 leading-relaxed">{p.desc}</p>
                  {rt ? (
                    <div className="text-[11px] font-bold">
                      <span className={`inline-block rounded-full px-2 py-0.5 ${rt.configured ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                        {rt.configured ? 'سر الخادم مهيأ' : 'سر الخادم غير مهيأ'}
                      </span>
                    </div>
                  ) : null}
                  <div className="pt-2 flex items-center justify-between border-t">
                    <span className="text-xs font-bold text-slate-600">الحالة:</span>
                    <button
                      type="button"
                      onClick={() =>
                        setProviders({
                          ...providers,
                          [p.id]: { ...current, enabled: !current.enabled },
                        })
                      }
                      className={`rounded-full px-3 py-1 text-xs font-black transition cursor-pointer ${
                        current.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {current.enabled ? 'مفعّل' : 'معطّل'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Tab: SEO & Indexing ── */}
      {activeTab === 'seo' && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-6">
          <div className="border-b pb-4">
            <h2 className="text-base font-black text-slate-900">هوية محركات البحث وSEO</h2>
            <p className="mt-1 text-xs font-bold text-slate-500">
              تكوين وسوم الميتا الافتراضية، خريطة الموقع sitemap، وأدوات التحليلات.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-black text-slate-700 mb-1">اسم الموقع العام (Site Name)</label>
              <input
                value={seoConfig.siteName}
                onChange={(e) => setSeoConfig({ ...seoConfig, siteName: e.target.value })}
                className="w-full rounded-xl border p-2.5 text-xs font-bold"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-black text-slate-700 mb-1">عنوان الصفحة الرئيسية الافتراضي (Meta Title)</label>
              <input
                value={seoConfig.defaultTitle}
                onChange={(e) => setSeoConfig({ ...seoConfig, defaultTitle: e.target.value })}
                className="w-full rounded-xl border p-2.5 text-xs font-bold"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-black text-slate-700 mb-1">الوصف الافتراضي (Meta Description)</label>
              <textarea
                value={seoConfig.defaultDescription}
                onChange={(e) => setSeoConfig({ ...seoConfig, defaultDescription: e.target.value })}
                rows={3}
                className="w-full rounded-xl border p-2.5 text-xs font-bold leading-relaxed"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">الرابط الرسمي الأساسي (Canonical URL)</label>
              <input
                value={seoConfig.canonicalBaseUrl}
                onChange={(e) => setSeoConfig({ ...seoConfig, canonicalBaseUrl: e.target.value })}
                className="w-full rounded-xl border p-2.5 text-xs font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">معرّف Google Analytics (G-XXXXXXX)</label>
              <input
                value={seoConfig.googleAnalyticsId}
                placeholder="G-..."
                onChange={(e) => setSeoConfig({ ...seoConfig, googleAnalyticsId: e.target.value })}
                className="w-full rounded-xl border p-2.5 text-xs font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">معرّف Google Tag Manager (GTM-XXXXXXX)</label>
              <input
                value={seoConfig.googleTagManagerId}
                placeholder="GTM-..."
                onChange={(e) => setSeoConfig({ ...seoConfig, googleTagManagerId: e.target.value })}
                className="w-full rounded-xl border p-2.5 text-xs font-mono font-bold"
              />
            </div>
            <label className="flex items-center justify-between rounded-2xl border p-4 hover:bg-slate-50 cursor-pointer">
              <div>
                <span className="block text-xs font-black text-slate-900">السماح بفهرسة محركات البحث (Robots Indexing)</span>
                <span className="block text-[11px] font-bold text-slate-500 mt-0.5">تمكين أرشفة الصفحات العامة في محركات البحث.</span>
              </div>
              <input
                type="checkbox"
                checked={seoConfig.robotsIndexing}
                onChange={(e) => setSeoConfig({ ...seoConfig, robotsIndexing: e.target.checked })}
                className="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>
          </div>
        </div>
      )}

      {/* ── Tab: Floating Contact Support Widget ── */}
      {activeTab === 'contact' && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-6">
          <div className="border-b pb-4">
            <h2 className="text-base font-black text-slate-900">ودجت الدعم المباشر العائم</h2>
            <p className="mt-1 text-xs font-bold text-slate-500">
              فقاعة المساعدة السريعة للطلاب والزوار للوصول لفريق الدعم عبر الواتساب أو قنوات التواصل. يتم مزامنتها مباشرة مع الودجت العام.
            </p>
          </div>

          <div className="space-y-4 max-w-2xl">
            <label className="flex items-center justify-between rounded-2xl border p-4 hover:bg-slate-50 cursor-pointer">
              <div>
                <span className="block text-xs font-black text-slate-900">تفعيل زر الدعم المباشر</span>
                <span className="block text-[11px] font-bold text-slate-500 mt-0.5">إظهار الفقاعة العائمة أسفل يسار الموقع.</span>
              </div>
              <input
                type="checkbox"
                checked={contactWidget.enabled}
                onChange={(e) => setContactWidget({ ...contactWidget, enabled: e.target.checked })}
                className="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">قناة التواصل</label>
              <select
                aria-label="قناة التواصل"
                value={contactWidget.channel}
                onChange={(e) => setContactWidget({ ...contactWidget, channel: e.target.value })}
                className="w-full rounded-xl border p-2.5 text-xs font-bold bg-white"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="telegram">Telegram</option>
                <option value="phone">اتصال هاتفي</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">رقم الواتساب مع المفتاح الدولي</label>
              <input
                value={contactWidget.whatsappNumber}
                placeholder="+9665XXXXXXXX"
                onChange={(e) => setContactWidget({ ...contactWidget, whatsappNumber: e.target.value })}
                className="w-full rounded-xl border p-2.5 text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">رسالة الترحيب التلقائية</label>
              <textarea
                value={contactWidget.whatsappMessage}
                onChange={(e) => setContactWidget({ ...contactWidget, whatsappMessage: e.target.value })}
                rows={2}
                className="w-full rounded-xl border p-2.5 text-xs font-bold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex items-center justify-between rounded-2xl border p-3 cursor-pointer">
                <span className="text-xs font-black text-slate-800">فتح في تبويب جديد</span>
                <input
                  type="checkbox"
                  checked={contactWidget.openInNewTab}
                  onChange={(e) => setContactWidget({ ...contactWidget, openInNewTab: e.target.checked })}
                  className="h-4 w-4 rounded text-indigo-600"
                />
              </label>
              <label className="flex items-center justify-between rounded-2xl border p-3 cursor-pointer">
                <span className="text-xs font-black text-slate-800">إظهار في الصفحات العامة</span>
                <input
                  type="checkbox"
                  checked={contactWidget.showOnPublicPages}
                  onChange={(e) => setContactWidget({ ...contactWidget, showOnPublicPages: e.target.checked })}
                  className="h-4 w-4 rounded text-indigo-600"
                />
              </label>
              <label className="flex items-center justify-between rounded-2xl border p-3 cursor-pointer">
                <span className="text-xs font-black text-slate-800">إظهار في لوحات التحكم</span>
                <input
                  type="checkbox"
                  checked={contactWidget.showOnDashboardPages}
                  onChange={(e) => setContactWidget({ ...contactWidget, showOnDashboardPages: e.target.checked })}
                  className="h-4 w-4 rounded text-indigo-600"
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
