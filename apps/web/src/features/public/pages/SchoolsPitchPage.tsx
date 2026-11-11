import React, { useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  BadgeCheck,
  BookOpen,
  Bot,
  BrainCircuit,
  Building2,
  Calculator,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Gift,
  GraduationCap,
  HelpCircle,
  Laptop,
  Layers,
  Lightbulb,
  Loader2,
  MessageSquare,
  Mic,
  Phone,
  QrCode,
  Send,
  Share2,
  Shield,
  ShieldCheck,
  Sliders,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  UploadCloud,
  Users,
  Volume2,
  Zap,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { organizationsClient, SchoolInquiryPayload } from '../../organizations/api/organizations-client';

// Pricing baseline constants aligned with backend and administration tiers
export const SCHOOL_PRICING_TIERS = [
  {
    id: 'tier_foundation',
    name: 'باقة التأسيس للقدرات',
    badge: 'الأساسية',
    tagline: 'تأسيس متين لطلاب الثاني ثانوي في مسار القدرات العامة مع بنك أسئلة قياس المعتمد.',
    basePricePerStudent: 45,
    paths: ['القدرات العامة (كمي + لفظي)'],
    modules: ['الإدارة المدرسية والمقاعد', 'بنك الأسئلة الموحد والتجميعات', 'المسارات والدورات التأسيسية'],
    color: 'from-blue-600 to-cyan-600',
    border: 'border-blue-200 dark:border-blue-800',
    bg: 'bg-blue-50/50 dark:bg-blue-950/20',
    isPopular: false,
  },
  {
    id: 'tier_excellence',
    name: 'باقة التميز الأكاديمي',
    badge: 'الأكثر اختياراً بين المدارس ⭐',
    tagline: 'الحزمة المتكاملة للقدرات والتحصيلي مع الفصول الذكية، ورادار الفجوات، وشهادات التكريم الملكية.',
    basePricePerStudent: 75,
    paths: ['القدرات العامة (كمي + لفظي)', 'التحصيلي العلمي والأدبي'],
    modules: [
      'الإدارة المدرسية والمقاعد',
      'بنك الأسئلة الشامل',
      'منظومة الاختبارات المدرسية',
      'المسارات والدورات التدريبية',
      'الفيديوهات التفاعلية والأسئلة المدمجة',
      'الفصل الذكي وريموت المعلم التفاعلي',
    ],
    color: 'from-indigo-600 to-purple-600',
    border: 'border-indigo-300 dark:border-indigo-700 ring-2 ring-indigo-500/30',
    bg: 'bg-indigo-50/60 dark:bg-indigo-950/30',
    isPopular: true,
  },
  {
    id: 'tier_smart_vip',
    name: 'باقة المدرسة الذكية VIP',
    badge: 'الخيار الشامل للريادة 👑',
    tagline: 'كافة مسارات المنصة ووحداتها الـ 11 بالكامل، مع الذكاء الاصطناعي التوليدي من الـ PDF والمعلم السقراطي الناطق.',
    basePricePerStudent: 110,
    paths: ['القدرات العامة', 'التحصيلي (علمي + أدبي)', 'اختبارات نافس الوطنية'],
    modules: [
      'جميع وحدات المنصة الـ 11 بدون استثناء',
      'توليد الاختبارات من PDF بالذكاء الاصطناعي',
      'المعلم السقراطي الذكي والسبورة الناطقة',
      'استيراد مباشر من شيتات نظام نور',
      'العلامة المدرسية الخاصة (White-Label) وشعار المدرسة',
      'حوكمة استهلاك الذكاء الاصطناعي (AI Quota)',
      'تقارير رادار الفجوات والخطط العلاجية',
      'حصص البث المباشر والدعم الفني المخصص',
    ],
    color: 'from-amber-600 to-yellow-500',
    border: 'border-amber-300 dark:border-amber-700',
    bg: 'bg-amber-50/60 dark:bg-amber-950/30',
    isPopular: false,
  },
  {
    id: 'tier_custom',
    name: 'الباقة المخصصة للمجمعات',
    badge: 'مرونة تامة',
    tagline: 'تصميم عقد مخصص وفق متطلبات المدارس الكبرى والمجمعات التعليمية والمراكز الرائدة.',
    basePricePerStudent: 90,
    paths: ['تحديد مخصص حسب متطلبات المدرسة'],
    modules: ['اختيار مرن من بين وحدات المنصة الـ 11 حسب حاجة كل مرحلة'],
    color: 'from-emerald-600 to-teal-600',
    border: 'border-emerald-200 dark:border-emerald-800',
    bg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
    isPopular: false,
  },
];

export function SchoolsPitchPage() {
  // Calculator state
  const [studentCount, setStudentCount] = useState<number>(250);
  const [selectedTierId, setSelectedTierId] = useState<string>('tier_excellence');
  const [billingCycle, setBillingCycle] = useState<'annual' | 'term'>('annual');

  // Interactive showcase active tab
  const [activeShowcaseTab, setActiveShowcaseTab] = useState<'ai_exam' | 'socratic_board' | 'royal_cert' | 'noor_dashboard'>('ai_exam');

  // Socratic chalkboard player simulator
  const [isPlayingSocraticAudio, setIsPlayingSocraticAudio] = useState(false);
  const [socraticStep, setSocraticStep] = useState(1);

  // Proposal Form state
  const [schoolName, setSchoolName] = useState('');
  const [city, setCity] = useState('الرياض');
  const [directorName, setDirectorName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedPaths, setSelectedPaths] = useState<string[]>(['qudurat', 'tahsili']);
  const [notes, setNotes] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissionSuccess, setSubmissionSuccess] = useState<null | {
    refNumber: string;
    schoolName: string;
    studentCount: number;
    tierName: string;
    totalAnnualEstimate: number;
    isOfflineBuffer?: boolean;
  }>(null);

  // FAQ Accordion state
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Pricing calculations
  const selectedTier = useMemo(
    () => SCHOOL_PRICING_TIERS.find((t) => t.id === selectedTierId) || SCHOOL_PRICING_TIERS[1],
    [selectedTierId]
  );

  const pricingSummary = useMemo(() => {
    let rate = selectedTier.basePricePerStudent;

    // Volume discount tiers
    if (studentCount >= 1000) {
      rate *= 0.70; // 30% discount for 1000+
    } else if (studentCount >= 500) {
      rate *= 0.80; // 20% discount for 500+
    } else if (studentCount >= 200) {
      rate *= 0.90; // 10% discount for 200+
    }

    // Billing cycle adjustment
    if (billingCycle === 'annual') {
      rate *= 0.85; // Additional 15% discount for full academic year upfront
    }

    const pricePerStudent = Math.round(rate);
    const totalContract = pricePerStudent * studentCount;
    // Estimated retail value if purchased by students individually (avg 420 SAR per student)
    const retailCost = studentCount * 420;
    const totalSavings = Math.max(0, retailCost - totalContract);
    const savingsPercent = Math.round((totalSavings / retailCost) * 100);

    return {
      pricePerStudent,
      totalContract,
      retailCost,
      totalSavings,
      savingsPercent,
    };
  }, [selectedTier, studentCount, billingCycle]);

  const handleApplyToForm = () => {
    const el = document.getElementById('school-proposal-form');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const handleSocraticStepChange = (newStep: number) => {
    if (isPlayingSocraticAudio) {
      setIsPlayingSocraticAudio(false);
      window.speechSynthesis?.cancel();
    }
    setSocraticStep(newStep);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolName.trim() || !phone.trim() || !directorName.trim()) {
      setSubmitError('يرجى كتابة اسم المدرسة، واسم المسؤول، ورقم الجوال للتواصل.');
      return;
    }

    setFormSubmitting(true);
    setSubmitError(null);

    const ref = `SCH-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    const inquiryData: SchoolInquiryPayload = {
      refNumber: ref,
      schoolName: schoolName.trim(),
      city,
      directorName: directorName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      studentCount,
      tierId: selectedTier.id,
      tierName: selectedTier.name,
      paths: selectedPaths,
      notes: notes.trim() || undefined,
      totalAnnualEstimate: pricingSummary.totalContract,
    };

    // 1. Audit / Offline Resilience Buffer in localStorage
    try {
      const existing = JSON.parse(localStorage.getItem('almeaa_school_inquiries') || '[]');
      existing.unshift({ ...inquiryData, createdAt: new Date().toISOString() });
      localStorage.setItem('almeaa_school_inquiries', JSON.stringify(existing));
    } catch {
      // Ignore storage errors
    }

    // 2. Network execution with graceful fallback
    try {
      const response = await organizationsClient.submitSchoolInquiry(inquiryData);
      setSubmissionSuccess({
        refNumber: response.refNumber || ref,
        schoolName: inquiryData.schoolName,
        studentCount: inquiryData.studentCount,
        tierName: inquiryData.tierName,
        totalAnnualEstimate: inquiryData.totalAnnualEstimate,
      });
    } catch (networkErr: unknown) {
      console.warn('Backend inquiry submission fallback to local buffer:', networkErr);
      // Graceful fallback: lead is safely buffered; present modal with WhatsApp confirmation
      setSubmissionSuccess({
        refNumber: ref,
        schoolName: inquiryData.schoolName,
        studentCount: inquiryData.studentCount,
        tierName: inquiryData.tierName,
        totalAnnualEstimate: inquiryData.totalAnnualEstimate,
        isOfflineBuffer: true,
      });
    } finally {
      setFormSubmitting(false);
    }
  };

  const togglePathSelection = (pathKey: string) => {
    setSelectedPaths((prev) =>
      prev.includes(pathKey) ? prev.filter((p) => p !== pathKey) : [...prev, pathKey]
    );
  };

  const toggleSocraticAudio = () => {
    if (isPlayingSocraticAudio) {
      setIsPlayingSocraticAudio(false);
      window.speechSynthesis?.cancel();
    } else {
      setIsPlayingSocraticAudio(true);
      if ('speechSynthesis' in window) {
        const textToSpeak =
          socraticStep === 1
            ? 'أهلاً بك يا بطل. لنبدأ بتحليل المعادلة الرياضية. ما هي العوامل المشتركة التي تراها في البسط؟'
            : socraticStep === 2
            ? 'ممتاز جداً! بما أن البسط هو فرق بين مربعين، كيف يمكننا تحليله رياضياً؟'
            : 'أحسنت صنعاً! باختصار العامل المشترك مع المقام، يتبقى لدينا الحل النهائي.';
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = 'ar-SA';
        utterance.rate = 0.95;
        utterance.onend = () => setIsPlayingSocraticAudio(false);
        utterance.onerror = () => setIsPlayingSocraticAudio(false);
        window.speechSynthesis.speak(utterance);
      } else {
        setTimeout(() => setIsPlayingSocraticAudio(false), 3000);
      }
    }
  };

  const formatMoney = (amount: number) =>
    new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(amount);

  return (
    <main data-testid="schools-pitch-page" dir="rtl" className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-indigo-950 border-b border-emerald-500/20 px-4 py-2 text-center text-xs font-bold text-emerald-200">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles size={14} className="text-amber-400" />
          <span>المبادرة الوطنية لتمكين المدارس الرائدة | شراكة معتمدة لرفع مؤشرات قياس ونافس 2026/2027</span>
        </span>
      </div>

      {/* ========================================================================= */}
      {/* 1. HERO SECTION */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-28 border-b border-slate-800">
        {/* Ambient lighting glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] bg-gradient-to-tr from-indigo-600/20 via-emerald-600/15 to-transparent blur-3xl pointer-events-none -z-0" />

        <div className="max-w-6xl mx-auto px-4 relative z-10 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-black text-emerald-400 mb-6 shadow-xs">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>🇸🇦 حلول متكاملة لمدارس التعليم العام، الأهلية، والعالمية بالمملكة</span>
          </div>

          {/* Main Title */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight sm:leading-tight">
            اصنع الفارق في نتائج طلابك وتصدّر
            <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              لوائح التميز في اختبارات قياس ونافس
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 max-w-3xl mx-auto text-base sm:text-xl font-bold leading-relaxed text-slate-300">
            منظومة رقمية متكاملة تمنح مدرستك هوية مستقلة كاملة (شعار المدرسة، والشهادات المعتمدة، ولوحة تحكم المدير)،
            مع أحدث أدوات الذكاء الاصطناعي: توليد الاختبارات من PDF بضغطة زر، المعلم السقراطي الناطق، والربط السلس مع شيتات نظام نور.
          </p>

          {/* Action CTAs */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={handleApplyToForm}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black px-7 py-4 text-base shadow-xl hover:shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <Send size={18} />
              <span>طلب عرض سعر رسمي وتجربة للمدرسة</span>
            </button>
            <a
              href="#roi-calculator"
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 text-white font-black px-6 py-4 text-base border border-slate-700 hover:border-slate-600 transition-all cursor-pointer"
            >
              <Calculator size={18} className="text-cyan-400" />
              <span>حاسبة العائد والتوفير المالي (ROI)</span>
            </a>
          </div>

          {/* Trust stats counter bar */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="rounded-2xl border border-slate-800 bg-slate-800/40 backdrop-blur-xs p-4 text-center">
              <div className="text-2xl sm:text-3xl font-black text-emerald-400">+9.4 درجات</div>
              <div className="text-xs font-bold text-slate-400 mt-1">متوسط ارتفاع درجات الطلاب</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-800/40 backdrop-blur-xs p-4 text-center">
              <div className="text-2xl sm:text-3xl font-black text-cyan-400">+45 مدرسة</div>
              <div className="text-xs font-bold text-slate-400 mt-1">شريكة في مدن المملكة</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-800/40 backdrop-blur-xs p-4 text-center">
              <div className="text-2xl sm:text-3xl font-black text-amber-400">100% متوافق</div>
              <div className="text-xs font-bold text-slate-400 mt-1">مع نظام نور ومؤشرات قياس</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-800/40 backdrop-blur-xs p-4 text-center">
              <div className="text-2xl sm:text-3xl font-black text-purple-400">3 دقائق</div>
              <div className="text-xs font-bold text-slate-400 mt-1">وقت استيراد فصول المدرسة كاملة</div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. INTERACTIVE FEATURE SHOWCASE (VClasses AI + Socratic Chalkboard + White-Label + Noor) */}
      {/* ========================================================================= */}
      <section className="py-20 bg-slate-900 border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">
              تقنيات حصرية تُحدث ثورة في إدارة التعلم المدرسي
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white mt-2">
              أدوات ذكية متطورة صُممت خصيصاً للمدير والمعلم والطالب
            </h2>
            <p className="text-sm sm:text-base font-bold text-slate-400 mt-3">
              استكشف المزايا الحصرية التي تجعل منصة المئة الخيار الأول للمدارس الطامحة لتصدر مؤشرات الأداء الوطني.
            </p>
          </div>

          {/* Showcase Tabs Switcher */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2 p-1.5 rounded-2xl bg-slate-800/80 border border-slate-700 max-w-3xl mx-auto">
            <button
              onClick={() => setActiveShowcaseTab('ai_exam')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                activeShowcaseTab === 'ai_exam'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bot size={16} />
              <span>توليد اختبارات من PDF (AI)</span>
            </button>
            <button
              onClick={() => setActiveShowcaseTab('socratic_board')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                activeShowcaseTab === 'socratic_board'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BrainCircuit size={16} />
              <span>السبورة السقراطية الناطقة</span>
            </button>
            <button
              onClick={() => setActiveShowcaseTab('royal_cert')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                activeShowcaseTab === 'royal_cert'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Award size={16} />
              <span>شعار مدرستك وشهادات التكريم</span>
            </button>
            <button
              onClick={() => setActiveShowcaseTab('noor_dashboard')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                activeShowcaseTab === 'noor_dashboard'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileSpreadsheet size={16} />
              <span>تكامل نور ولوحة المدير</span>
            </button>
          </div>

          {/* Tab 1: AI PDF Exam Generator */}
          {activeShowcaseTab === 'ai_exam' && (
            <div className="mt-10 rounded-3xl border border-emerald-500/30 bg-slate-950/80 p-6 sm:p-8 backdrop-blur-md">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-5 space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black">
                    <Sparkles size={14} />
                    <span>مماثل لمنظومة VClasses العالمية</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    حوّل ملازم وتجميعات مدرستك الورقية إلى اختبارات إلكترونية تفاعلية في ثوانٍ
                  </h3>
                  <p className="text-xs sm:text-sm font-bold text-slate-300 leading-relaxed">
                    وفر على المعلمين عشرات ساعات الطباعة وإدخال الأسئلة. ارفع ورقة الأسئلة أو ملف PDF،
                    ليقوم الذكاء الاصطناعي باستخراج الأسئلة، الخيارات، صيغ الرياضيات KaTeX، ونموذج الإجابة بدقة متناهية.
                  </p>
                  <ul className="space-y-2 text-xs font-bold text-slate-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      <span>استخراج دقيق للكسور والمعادلات الرياضية بصيغ LaTeX / KaTeX المعتمدة.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      <span>توليد تلقائي لصعوبة السؤال، والتصنيف المهاري، والشرح التوضيحي.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      <span>إمكانية نشر الاختبار فوراً لفصول المدرسة أو تصديره إلى صيغة PDF مطبوعة.</span>
                    </li>
                  </ul>
                </div>

                <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                      <FileText size={16} className="text-emerald-400" />
                      <span>ورقة_تجميعات_القدرات_النموذج_أ.pdf</span>
                    </div>
                    <span className="text-[11px] font-black bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                      تم الاستخراج بالذكاء الاصطناعي ✓
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <div className="flex justify-between text-xs font-black text-slate-400 mb-2">
                        <span>السؤال الأول (جبر وتحليل):</span>
                        <span className="text-amber-400">قدرات كمي - المستوى المتقدم</span>
                      </div>
                      <p className="text-sm font-bold text-white leading-relaxed">
                        إذا كانت س² - ص² = ٤٨ ، وكانت (س + ص) = ١٢ ، فما قيمة (س - ص) ؟
                      </p>
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {['أ) ٢', 'ب) ٤ (الإجابة الصحيحة)', 'ج) ٦', 'د) ٨'].map((opt, i) => (
                          <div
                            key={i}
                            className={`p-2 rounded-lg text-xs font-black text-center ${
                              i === 1
                                ? 'bg-emerald-600/30 border border-emerald-500 text-emerald-300'
                                : 'bg-slate-900 border border-slate-800 text-slate-400'
                            }`}
                          >
                            {opt}
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 rounded-lg bg-emerald-950/40 border border-emerald-800/40 p-2.5 text-xs text-emerald-200 font-bold">
                        💡 <strong>الشرح النموذجي:</strong> المقدار س² - ص² = (س - ص)(س + ص) = ٤٨. بقسمة ٤٨ على ١٢ = ٤.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Socratic Voice Whiteboard */}
          {activeShowcaseTab === 'socratic_board' && (
            <div className="mt-10 rounded-3xl border border-indigo-500/30 bg-slate-950/80 p-6 sm:p-8 backdrop-blur-md">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-5 space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-black">
                    <Mic size={14} />
                    <span>المعلم السقراطي الناطق بالعربية</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    معلم افتراضي خاص لكل طالب في مدرستك يشرح الحل خطوة بخطوة بالصوت والسبورة
                  </h3>
                  <p className="text-xs sm:text-sm font-bold text-slate-300 leading-relaxed">
                    بدلاً من إعطاء الطالب الحل الجاهز الذي ينساه سريعاً، يوجهه المعلم الذكي بالأسئلة التوجيهية السقراطية،
                    ويكتب الخطوات على السبورة التفاعلية متزامنة مع الصوت العربي الفصيح.
                  </p>
                  <div className="pt-2">
                    <button
                      data-testid="socratic-audio-toggle"
                      onClick={toggleSocraticAudio}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black px-5 py-3 text-xs shadow-lg transition-all cursor-pointer"
                    >
                      <Volume2 size={16} className={isPlayingSocraticAudio ? 'animate-bounce text-amber-300' : ''} />
                      <span>{isPlayingSocraticAudio ? 'إيقاف الشرح الصوتي' : 'استمع لتفاعل المعلم السقراطي 🔊'}</span>
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-7 bg-slate-950 border border-indigo-900/50 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
                      <BrainCircuit size={16} />
                      <span>سبورة الشرح الذكي - الأسلوب السقراطي التفاعلي</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSocraticStepChange(Math.max(1, socraticStep - 1))}
                        disabled={socraticStep === 1}
                        className="px-2 py-1 rounded bg-slate-800 text-xs text-slate-300 disabled:opacity-40"
                      >
                        السابق
                      </button>
                      <span className="text-xs font-black text-amber-400">خطوة {socraticStep} من 3</span>
                      <button
                        onClick={() => handleSocraticStepChange(Math.min(3, socraticStep + 1))}
                        disabled={socraticStep === 3}
                        className="px-2 py-1 rounded bg-slate-800 text-xs text-slate-300 disabled:opacity-40"
                      >
                        التالي
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 min-h-[180px] flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-black text-amber-400 mb-1">
                        {socraticStep === 1
                          ? 'الخطوة 1: استكشاف البنية والمعطيات'
                          : socraticStep === 2
                          ? 'الخطوة 2: تحليل الفرق بين المربعين'
                          : 'الخطوة 3: التبسيط والوصول للناتج النهائي'}
                      </div>
                      <p className="text-sm font-bold text-slate-200 leading-relaxed">
                        {socraticStep === 1 &&
                          '«ما هي العلاقة بين المقدار (س² - ص²) والمقدارين (س - ص) و (س + ص)؟ تذكّر قانون المتطابقات الشهيرة.»'}
                        {socraticStep === 2 &&
                          '«ممتاز! قانون الفرق بين المربعين: س² - ص² = (س - ص)(س + ص). لدينا س² - ص² = ٤٨ و (س + ص) = ١٢.»'}
                        {socraticStep === 3 &&
                          '«إذاً: ١٢ × (س - ص) = ٤٨. بالقسمة على ١٢ نجد أن (س - ص) = ٤ مباشرة. أحسنت الاستنتاج!»'}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Bot size={14} className="text-indigo-400" />
                        <span>نظام التوجيه السقراطي الصوتي مفعل</span>
                      </span>
                      <span className="font-mono text-emerald-400">KaTeX Active ✓</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Royal Certificate & School White-Label */}
          {activeShowcaseTab === 'royal_cert' && (
            <div className="mt-10 rounded-3xl border border-amber-500/30 bg-slate-950/80 p-6 sm:p-8 backdrop-blur-md">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-5 space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black">
                    <Trophy size={14} />
                    <span>الهوية المدرسية الحصرية (White-Label)</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    شعار مدرستك يتصدر المنصة، وشهادات تفوق ملكية فورية برمز QR مشفر للتحقق
                  </h3>
                  <p className="text-xs sm:text-sm font-bold text-slate-300 leading-relaxed">
                    عزز ولاء وفخر طلابك وأولياء الأمور بمدرستهم. عند إتمام كل دورة أو اختبار محاكاة،
                    يتم إصدار شهادة إتقان ملكية تحمل شعار مدرستك الرسمي، اسم المدير، ورقم توثيق رسمي يمكن مسحه بالجوال.
                  </p>
                  <div className="space-y-2 text-xs font-bold text-slate-300">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-amber-400" />
                      <span>ظهور شعار المدرسة المعتمد في ترويسة الطالب والمعلم.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-amber-400" />
                      <span>إمكانية طباعة الشهادات بدقة فائقة 300DPI لحفلات التكريم المدرسية.</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-7 bg-gradient-to-b from-amber-950/40 to-slate-950 border-2 border-amber-500/40 rounded-2xl p-6 shadow-2xl relative text-center">
                  <div className="border border-amber-400/30 rounded-xl p-5 bg-slate-900/90">
                    <div className="flex items-center justify-between mb-4 border-b border-amber-500/20 pb-3">
                      <div className="text-right">
                        <div className="text-xs font-black text-amber-300">المملكة العربية السعودية</div>
                        <div className="text-[11px] font-bold text-slate-400">مجمع مدارس الأندلس الأهلية الرائدة</div>
                      </div>
                      <div className="w-12 h-12 rounded-full border border-amber-400 bg-amber-500/20 flex items-center justify-center text-amber-300 font-black text-xs">
                        شعارك
                      </div>
                    </div>

                    <h4 className="text-lg font-black text-amber-200">شهادة تقدير وإتقان أكاديمي</h4>
                    <p className="text-xs text-slate-300 mt-2">
                      تشهد إدارة المدرسة بأن الطالب المتميز: <strong className="text-white">سعود بن فيصل العتيبي</strong>
                      <br />
                      قد أتم بنجاح متطلبات: <strong className="text-amber-300">المحاكاة الشاملة لاختبار القدرات العامة</strong>
                      <br />
                      بمعدل تفوق قدره: <strong className="text-emerald-400 font-mono text-sm">٩٦.٥%</strong>
                    </p>

                    <div className="mt-5 flex items-center justify-between border-t border-amber-500/20 pt-3">
                      <div className="text-right text-[11px] text-slate-400">
                        <div>مدير المدرسة: أ. عبدالعزيز القحطاني</div>
                        <div className="font-mono text-[10px] text-amber-400">REF: ALM-SCH-2026-9812</div>
                      </div>
                      <div className="bg-white p-1 rounded-md shadow-xs">
                        <QRCodeSVG value="https://almeaa.net/verify/ALM-SCH-2026-9812" size={44} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Noor Integration & Director Dashboard */}
          {activeShowcaseTab === 'noor_dashboard' && (
            <div className="mt-10 rounded-3xl border border-cyan-500/30 bg-slate-950/80 p-6 sm:p-8 backdrop-blur-md">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-5 space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-black">
                    <FileSpreadsheet size={14} />
                    <span>تكامل فوري بدون أي مجهود يدوي</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    استيراد شيت إكسل نظام نور بضغطة زر واحدة وتوزيع الطلاب على فصولهم فوراً
                  </h3>
                  <p className="text-xs sm:text-sm font-bold text-slate-300 leading-relaxed">
                    لا داعي لإدخال بيانات الطلاب يدوياً. قم بتحميل شيت الطلاب من نظام نور الوزاري،
                    وارفعه للمنصة ليقوم النظام بإنشاء حساباتهم، وتعيينهم لفصولهم، وتزويد المعلمين والمدير برادار تشخيصي فوري.
                  </p>
                  <div className="space-y-2 text-xs font-bold text-slate-300">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-cyan-400" />
                      <span>توليد أكواد دخول تلقائية للطلاب أو ربط بحسابات البريد الوزاري.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-cyan-400" />
                      <span>رادار تشخيص الفجوات المهارية لكل فصل لمساعدة المشرفين التربويين.</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                    <div className="flex items-center gap-2 text-xs font-black text-cyan-400">
                      <Building2 size={16} />
                      <span>لوحة تحكم مدير المدرسة | الفصل الدراسي الثاني</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400">محدث الآن</span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="rounded-xl bg-slate-950 p-3 text-center border border-slate-800">
                      <div className="text-xl font-black text-white">٣٨٠</div>
                      <div className="text-[11px] font-bold text-slate-400">إجمالي طلاب المدرسة</div>
                    </div>
                    <div className="rounded-xl bg-slate-950 p-3 text-center border border-slate-800">
                      <div className="text-xl font-black text-emerald-400">٩١.٤%</div>
                      <div className="text-[11px] font-bold text-slate-400">متوسط إنجاز المقررات</div>
                    </div>
                    <div className="rounded-xl bg-slate-950 p-3 text-center border border-slate-800">
                      <div className="text-xl font-black text-cyan-400">١٢ فصلاً</div>
                      <div className="text-[11px] font-bold text-slate-400">فصول ذكية نشطة</div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-3 border border-slate-800 text-xs">
                    <div className="font-black text-slate-300 mb-2">مقارنة فصول الثالث ثانوي في اختبار محاكاة القدرات:</div>
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-[11px] font-bold text-slate-400 mb-1">
                          <span>فصل ٣/١ (علمي)</span>
                          <span className="text-emerald-400 font-black">٨٩% متوسط</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full rounded-full" style={{ width: '89%' }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[11px] font-bold text-slate-400 mb-1">
                          <span>فصل ٣/٢ (علمي)</span>
                          <span className="text-indigo-400 font-black">٨٤% متوسط</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div className="bg-indigo-500 h-full rounded-full" style={{ width: '84%' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. PACKAGES MATRIX SECTION */}
      {/* ========================================================================= */}
      <section className="py-20 bg-slate-950 border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <span className="text-xs font-black text-indigo-400 uppercase tracking-wider">
              مرونة تامة في العقود والمسارات والموديولات
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white mt-2">
              باقات المدارس المعتمدة وفق احتياج كل صرح تعليمي
            </h2>
            <p className="text-sm sm:text-base font-bold text-slate-400 mt-3">
              اختر الباقة المناسبة لمدرستك، أو صمم عقداً مخصصاً يلبي كافة تطلعات طلابك وهيئتك التعليمية.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {SCHOOL_PRICING_TIERS.map((tier) => {
              const isSelected = selectedTierId === tier.id;
              return (
                <div
                  key={tier.id}
                  onClick={() => setSelectedTierId(tier.id)}
                  className={`relative rounded-3xl border p-6 flex flex-col justify-between transition-all cursor-pointer ${
                    isSelected
                      ? `${tier.border} ${tier.bg} shadow-2xl scale-[1.02]`
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                  }`}
                >
                  {tier.isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-3.5 py-1 text-[11px] font-black text-white shadow-md">
                      {tier.badge}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-400">{tier.badge}</span>
                      {isSelected && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white">
                          <Check size={12} />
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-black text-white mt-3">{tier.name}</h3>
                    <p className="text-xs font-bold text-slate-400 mt-2 leading-relaxed">{tier.tagline}</p>

                    <div className="mt-5 border-t border-slate-800 pt-4">
                      <div className="text-xs font-bold text-slate-400">المسارات المرخصة:</div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {tier.paths.map((p, idx) => (
                          <span
                            key={idx}
                            className="inline-block rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-300"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 border-t border-slate-800 pt-3">
                      <div className="text-xs font-bold text-slate-400 mb-2">أبرز المزايا والموديولات:</div>
                      <ul className="space-y-1.5 text-xs font-bold text-slate-300">
                        {tier.modules.slice(0, 4).map((mod, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <Check size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                            <span className="leading-snug">{mod}</span>
                          </li>
                        ))}
                        {tier.modules.length > 4 && (
                          <li className="text-[11px] text-indigo-400 font-bold">
                            + {tier.modules.length - 4} مزايا إضافية متقدمة
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTierId(tier.id);
                        handleApplyToForm();
                      }}
                      className={`w-full py-2.5 rounded-xl text-xs font-black transition-all ${
                        isSelected
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      }`}
                    >
                      {isSelected ? 'الباقة المحددة في الحسبة ✓' : 'اختيار هذه الباقة'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. INTERACTIVE SCHOOL SEAT & ROI CALCULATOR */}
      {/* ========================================================================= */}
      <section id="roi-calculator" className="py-20 bg-slate-900 border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <span className="text-xs font-black text-cyan-400 uppercase tracking-wider">
              حاسبة الاستثمار والعائد المالي (School ROI Calculator)
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white mt-2">
              احسب تكلفة مدرستك وقيمة التوفير المالي فوراً
            </h2>
            <p className="text-sm sm:text-base font-bold text-slate-400 mt-2">
              حرك مؤشر المقاعد لتحديد عدد الطلاب ومشاهدة التكلفة السنوية المباشرة وحجم الوفر المحقق.
            </p>
          </div>

          <div className="mt-12 rounded-3xl border border-slate-700 bg-slate-950 p-6 sm:p-10 shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              {/* Controls Column */}
              <div className="lg:col-span-7 space-y-6">
                {/* 1. Student Count Slider */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-black text-white flex items-center gap-2">
                      <Users size={18} className="text-emerald-400" />
                      <span>عدد طلاب المدرسة المراد تسجيلهم:</span>
                    </label>
                    <span className="text-2xl font-black text-emerald-400 font-mono">
                      {studentCount} <span className="text-xs text-slate-400 font-sans">طالب</span>
                    </span>
                  </div>

                  <input
                    data-testid="roi-student-slider"
                    type="range"
                    min="50"
                    max="2000"
                    step="25"
                    value={studentCount}
                    onChange={(e) => setStudentCount(Number(e.target.value))}
                    className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />

                  {/* Preset quick buttons */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-400">
                    <span>خيارات سريعة:</span>
                    {[100, 250, 500, 1000, 1500].map((num) => (
                      <button
                        key={num}
                        data-testid={`roi-preset-${num}`}
                        type="button"
                        onClick={() => setStudentCount(num)}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-black transition-all cursor-pointer ${
                          studentCount === num
                            ? 'bg-emerald-600 text-white border-emerald-500'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                        }`}
                      >
                        {num} طالب
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Tier Selection */}
                <div>
                  <label className="text-sm font-black text-white block mb-2">
                    الباقة المختارة للحسبة:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {SCHOOL_PRICING_TIERS.map((tier) => (
                      <button
                        key={tier.id}
                        data-testid={`roi-tier-${tier.id}`}
                        type="button"
                        onClick={() => setSelectedTierId(tier.id)}
                        className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                          selectedTierId === tier.id
                            ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-black truncate">{tier.name}</div>
                        <div className="text-[10px] opacity-80 mt-1">{tier.badge}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Billing Mode Switcher */}
                <div className="flex items-center justify-between rounded-2xl bg-slate-900 border border-slate-800 p-3">
                  <div className="flex items-center gap-2">
                    <Calendar size={18} className="text-amber-400" />
                    <div>
                      <div className="text-xs font-black text-white">فترة العقد المالي</div>
                      <div className="text-[11px] text-emerald-400 font-bold">
                        خصم سنوي إضافي 15% عند التعاقد للعام الدراسي كاملاً
                      </div>
                    </div>
                  </div>
                  <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setBillingCycle('annual')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        billingCycle === 'annual'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      سنوي (موصى به)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingCycle('term')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        billingCycle === 'term'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      فصلي
                    </button>
                  </div>
                </div>
              </div>

              {/* Live Calculations Result Card */}
              <div className="lg:col-span-5 rounded-2xl bg-gradient-to-br from-indigo-950/70 via-slate-900 to-emerald-950/50 border border-indigo-500/30 p-6 text-center space-y-4 shadow-xl">
                <span className="inline-block rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 text-xs font-black">
                  تقدير العرض المالي المعتمد
                </span>

                <div>
                  <div className="text-xs font-bold text-slate-400">التكلفة السنوية التقديرية للطالب:</div>
                  <div className="text-4xl font-black text-white font-mono mt-1">
                    {formatMoney(pricingSummary.pricePerStudent)}
                    <span className="text-xs font-sans text-slate-400"> / طالب / سنة</span>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-3">
                  <div className="text-xs font-bold text-slate-400">إجمالي استثمار العقد التقديري:</div>
                  <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
                    {formatMoney(pricingSummary.totalContract)}
                  </div>
                </div>

                <div className="rounded-xl bg-emerald-950/50 border border-emerald-800/50 p-3 text-xs text-emerald-200 font-bold space-y-1">
                  <div className="flex justify-between">
                    <span>قيمة التوفير مقارنة بالاشتراكات الفردية:</span>
                    <span className="font-mono text-emerald-300 font-black">
                      {formatMoney(pricingSummary.totalSavings)}
                    </span>
                  </div>
                  <div className="flex justify-between text-amber-300">
                    <span>نسبة الوفر المحققة لأولياء الأمور:</span>
                    <span className="font-mono font-black">{pricingSummary.savingsPercent}% توفير</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleApplyToForm}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg transition-all cursor-pointer"
                >
                  اعتماد هذه الحسبة في نموذج العرض 🚀
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. B2B SCHOOL LEAD CAPTURE & PROPOSAL FORM */}
      {/* ========================================================================= */}
      <section id="school-proposal-form" className="py-20 bg-slate-950 border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">
              شراكة رسمية معتمدة | تواصل فوري خلال ساعتين
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white mt-2">
              طلب عرض سعر رسمي وتجربة حية لمدرستك
            </h2>
            <p className="text-sm font-bold text-slate-400 mt-2">
              املأ البيانات التالية، وسيتواصل معك مستشار الشراكات المدرسية لتزويدك بالعرض المالي وتفعيل الحساب التجريبي.
            </p>
          </div>

          <form
            onSubmit={handleFormSubmit}
            noValidate
            className="mt-12 rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-10 shadow-2xl space-y-6"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* School Name */}
              <div>
                <label htmlFor="school-name-input" className="text-xs font-black text-slate-300 block mb-2">
                  اسم المدرسة أو المجمع التعليمي <span className="text-rose-500">*</span>
                </label>
                <input
                  id="school-name-input"
                  type="text"
                  required
                  placeholder="مثال: مدارس الأندلس الأهلية للبنين"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-xs font-bold text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* City */}
              <div>
                <label htmlFor="city-select" className="text-xs font-black text-slate-300 block mb-2">
                  المدينة / المنطقة التعليمية <span className="text-rose-500">*</span>
                </label>
                <select
                  id="city-select"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-xs font-bold text-white focus:border-emerald-500 focus:outline-hidden"
                >
                  <option value="الرياض">الرياض</option>
                  <option value="جدة">جدة</option>
                  <option value="مكة المكرمة">مكة المكرمة</option>
                  <option value="المدينة المنورة">المدينة المنورة</option>
                  <option value="الدمام / الخبر">الدمام / الخبر</option>
                  <option value="القصيم">القصيم</option>
                  <option value="عسير / أبها">عسير / أبها</option>
                  <option value="تبوك">تبوك</option>
                  <option value="أخرى">مدينة أخرى</option>
                </select>
              </div>

              {/* Director / Representative Name */}
              <div>
                <label htmlFor="director-name-input" className="text-xs font-black text-slate-300 block mb-2">
                  اسم المسؤول / مدير المدرسة / المشرف <span className="text-rose-500">*</span>
                </label>
                <input
                  id="director-name-input"
                  type="text"
                  required
                  placeholder="مثال: أ. عبدالعزيز القحطاني"
                  value={directorName}
                  onChange={(e) => setDirectorName(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-xs font-bold text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Mobile Phone */}
              <div>
                <label htmlFor="phone-input" className="text-xs font-black text-slate-300 block mb-2">
                  رقم الجوال للتواصل عبر الواتساب <span className="text-rose-500">*</span>
                </label>
                <input
                  id="phone-input"
                  type="tel"
                  required
                  dir="ltr"
                  placeholder="05xxxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-xs font-bold text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-hidden text-right"
                />
              </div>

              {/* Official Email */}
              <div className="sm:col-span-2">
                <label htmlFor="email-input" className="text-xs font-black text-slate-300 block mb-2">
                  البريد الإلكتروني الرسمي للمدرسة (اختياري)
                </label>
                <input
                  id="email-input"
                  type="email"
                  dir="ltr"
                  placeholder="admin@school.edu.sa"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-xs font-bold text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-hidden text-right"
                />
              </div>
            </div>

            {/* Requested Paths Selection */}
            <div>
              <label className="text-xs font-black text-slate-300 block mb-2">
                المسارات المستهدفة بالتعاقد:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: 'qudurat', label: 'القدرات العامة' },
                  { key: 'tahsili', label: 'التحصيلي العلمي والأدبي' },
                  { key: 'nafis', label: 'اختبارات نافس الوطنية' },
                  { key: 'foundations', label: 'التأسيس والمراجعات' },
                ].map((item) => {
                  const isChecked = selectedPaths.includes(item.key);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => togglePathSelection(item.key)}
                      className={`p-3 rounded-xl border text-xs font-black flex items-center justify-between transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span>{item.label}</span>
                      {isChecked && <Check size={14} className="text-emerald-400" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Contract Summary Pill */}
            <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-indigo-400" />
                <span className="font-bold text-slate-300">
                  الباقة المحددة: <strong className="text-white">{selectedTier.name}</strong> · عدد الطلاب:{' '}
                  <strong className="text-emerald-400">{studentCount} طالب</strong>
                </span>
              </div>
              <div className="font-mono text-emerald-400 font-black">
                تقدير الاستثمار: {formatMoney(pricingSummary.totalContract)}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes-textarea" className="text-xs font-black text-slate-300 block mb-2">
                ملاحظات أو متطلبات خاصة (اختياري)
              </label>
              <textarea
                id="notes-textarea"
                rows={3}
                placeholder="اذكر أي تفاصيل إضافية مثل موعد بدء التدريب المطلوب أو الرغبة في تجربة حية للمعلمين..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-xs font-bold text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-hidden"
              />
            </div>

            {submitError && (
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-4 text-xs font-bold text-rose-300">
                {submitError}
              </div>
            )}

            {/* Submit Button */}
            <button
              data-testid="school-proposal-submit"
              type="submit"
              disabled={formSubmitting}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-slate-950 font-black text-sm shadow-xl transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {formSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                  <span>جارٍ إرسال الطلب واعتماد الرقم المرجعي...</span>
                </>
              ) : (
                <>
                  <Send size={18} />
                  <span>إرسال طلب العرض الرسمي وتفعيل الحساب التجريبي 📨</span>
                </>
              )}
            </button>
          </form>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. SUCCESS CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {submissionSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-lg w-full rounded-3xl border border-emerald-500/40 bg-slate-900 p-6 sm:p-8 text-center space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40">
              <CheckCircle2 size={36} />
            </div>

            <h3 className="text-2xl font-black text-white">تم استلام طلب الشراكة بنجاح!</h3>

            <p className="text-xs sm:text-sm font-bold text-slate-300 leading-relaxed">
              سعداء بانضمام <strong className="text-emerald-400">{submissionSuccess.schoolName}</strong> إلى عائلة مدارس المئة.
              سيتواصل معكم مستشار شراكات المدارس خلال ساعتين لتزويدكم بالعرض الفني والمالي المعتمد وتفعيل النسخة التجريبية.
            </p>

            <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 text-xs space-y-2 text-right">
              <div className="flex justify-between">
                <span className="text-slate-400">رقم طلب العرض المرجعي:</span>
                <span className="font-mono text-amber-400 font-black">{submissionSuccess.refNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">الباقة المختارة:</span>
                <span className="text-white font-bold">{submissionSuccess.tierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">عدد الطلاب المسجلين:</span>
                <span className="text-white font-bold">{submissionSuccess.studentCount} طالب</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-2">
                <span className="text-slate-400">الاستثمار السنوي التقديري:</span>
                <span className="font-mono text-emerald-400 font-black">
                  {formatMoney(submissionSuccess.totalAnnualEstimate)}
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <a
                href={`https://wa.me/966500000000?text=${encodeURIComponent(
                  `السلام عليكم ورحمة الله،\nتم تقديم طلب شراكة مدرسية عبر منصة المئة:\n- الرقم المرجعي: ${submissionSuccess.refNumber}\n- المدرسة: ${submissionSuccess.schoolName}\n- الباقة: ${submissionSuccess.tierName}\n- عدد الطلاب: ${submissionSuccess.studentCount} طالب\n- التقدير السنوي: ${formatMoney(submissionSuccess.totalAnnualEstimate)}\nنرجو تزويدنا بالعرض المالي المعتمد وتفعيل النسخة التجريبية.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 text-xs shadow-md transition-all cursor-pointer"
              >
                <Phone size={14} />
                <span>متابعة فورية عبر الواتساب 💬</span>
              </a>
              <button
                type="button"
                onClick={() => setSubmissionSuccess(null)}
                className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-black text-xs transition-all cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. FAQ SECTION FOR PRINCIPALS */}
      {/* ========================================================================= */}
      <section className="py-20 bg-slate-900 border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-black text-indigo-400 uppercase tracking-wider">
              إجابات شاملة لمدراء ومشرفي المدارس
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-2">
              الأسئلة الشائعة حول شراكة المدارس
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                q: 'كيف يتم تفعيل حسابات الطلاب والفصول في المدرسة؟',
                a: 'بكل سهولة وبدون أي مجهود يدوي، يمكنك تصدير شيت إكسل الطلاب من نظام "نور" ورفعه مباشرة إلى لوحة تحكم المدير، ليقوم النظام في أقل من 3 دقائق بإنشاء حسابات الطلاب وتوزيعهم على فصولهم وتزويدهم بأكواد دخول فورية.',
              },
              {
                q: 'هل تظهر هويتنا وشعار مدرستنا على المنصة والشهادات؟',
                a: 'نعم، في باقتي "التميز الأكاديمي" و"المدرسة الذكية VIP"، يتم تفعيل نظام العلامة البيضاء (White-Label)؛ حيث يظهر شعار المدرسة واسمها الرسمي في حسابات الطلاب والمعلمين، وتُطبع شهادات التكريم الملكية حاملة لشعار مدرستك وتوقيع المدير مع رمز QR للتحقق.',
              },
              {
                q: 'ماذا لو رغب طالب في شراء مسار لم تشترك فيه المدرسة؟',
                a: 'تدعم المنصة نموذج "الوصول الهجين المتراكم"؛ يحصل الطالب مجاناً على كافة المسارات التي رخصتها مدرسته، وإذا رغب في دراسة مسار إضافي أو ترقية حسابه لعضوية فردية، يمكنه الشراء مباشرة دون أي تعارض مع عضويته المدرسية.',
              },
              {
                q: 'كيف نتحكم في استهلاك الذكاء الاصطناعي (AI Quotas) للمعلمين والطلاب؟',
                a: 'توفر لوحة المدير حوكمة صارمة لحصص الذكاء الاصطناعي؛ حيث يستطيع المدير تحديد عدد مرات استخدام المعلم لتوليد الاختبارات من PDF، وتحديد حصص الأسئلة السقراطية اليومية للطلاب، مع تتبع دقيق لبيانات الاستخدام في الزمن الحقيقي.',
              },
              {
                q: 'هل تقدمون تدريباً ودعماً فنياً للمعلمين والإدارة المدرسية؟',
                a: 'نعم، يتضمن كل عقد ورشة تدريبية تفاعلية عن بعد مدتها 45 دقيقة للهيئة التعليمية، مع دليل مصور فوري، ومستشار دعم فني مخصص عبر الواتساب والهاتف متاح طوال أيام الأسبوع لمتابعة أي استفسار.',
              },
            ].map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-5 text-right flex items-center justify-between text-xs sm:text-sm font-black text-white hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      size={18}
                      className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-emerald-400' : ''}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm font-bold text-slate-300 leading-relaxed border-t border-slate-800/60">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. BOTTOM CONVERSION CTA BANNER */}
      {/* ========================================================================= */}
      <section className="py-16 bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-black text-emerald-400">
            <Trophy size={16} />
            <span>انضم لأكثر من 45 مدرسة رائدة في المملكة</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-black text-white">
            جاهزون لنقل مدرستك إلى صدارة مدارس المملكة؟
          </h2>

          <p className="text-sm font-bold text-slate-300 max-w-xl mx-auto">
            احصل على عرض سعر مخصص ونسخة تجريبية حية لفصول مدرستك ومعلميك دون أي التزام مسبق.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              onClick={handleApplyToForm}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black px-8 py-4 text-sm shadow-xl transition-all cursor-pointer"
            >
              <Send size={16} />
              <span>ابدأ الآن - طلب عرض سعر وتجربة للمدرسة</span>
            </button>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-black px-6 py-4 text-sm border border-slate-700 transition-all"
            >
              <Users size={16} />
              <span>استعراض عضويات الطلاب الأفراد</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
