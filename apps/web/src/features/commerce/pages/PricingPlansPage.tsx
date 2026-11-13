import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Award,
  BookOpen,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Crown,
  HelpCircle,
  Key,
  Minus,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Video,
  X,
  Zap,
} from 'lucide-react';

import { useAuth } from '../../auth/state/AuthProvider';
import { commerceClient } from '../api/commerce-client';
import {
  BILLING_CYCLES,
  MEMBERSHIP_TIERS,
  calculateTierPrice,
  formatSaudiRiyal,
  type BillingCycle,
  type MembershipTier,
  type MembershipTierId,
} from '../api/membership-types';

export const PricingPlansPage: React.FC = () => {
  const { user, getCsrfToken } = useAuth();
  const navigate = useNavigate();

  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');
  const [accessCode, setAccessCode] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const handleRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = accessCode.trim();
    if (!code) {
      setRedeemError('الرجاء إدخال رمز تفعيل صحيح.');
      return;
    }
    if (!user) {
      setRedeemError('سجّل الدخول أولاً ثم أدخل رمز التفعيل.');
      navigate('/login');
      return;
    }

    setRedeemLoading(true);
    setRedeemError(null);
    setRedeemSuccess(null);

    try {
      // Real server redemption: it validates the code, consumes a use and
      // issues the canonical entitlement. Nothing is granted locally.
      const csrf = await getCsrfToken();
      const result = await commerceClient.redeemAccessCode(code, csrf);
      setRedeemSuccess('تم تفعيل رمز الوصول بنجاح. أصبح المحتوى المصرح به متاحاً لحسابك.');
      setAccessCode('');
    } catch (err) {
      setRedeemError(
        err instanceof Error
          ? err.message
          : 'تعذر التحقق من رمز التفعيل. يرجى التأكد من الرمز وإعادة المحاولة.'
      );
    } finally {
      setRedeemLoading(false);
    }
  };

  const handleSelectTier = (tier: MembershipTier) => {
    if (tier.id === 'free_starter') {
      if (user) {
        navigate('/dashboard');
      } else {
        navigate('/signup');
      }
      return;
    }

    // Direct to checkout with tier and cycle query params
    navigate(`/checkout?tier=${tier.id}&cycle=${billingCycle}`);
  };

  const comparisonRows = [
    {
      category: 'المحتوى والمسارات التدريبية',
      items: [
        {
          name: 'المسارات المشمولة بالباقة',
          free: 'تجريبي (دروس تمهيدية)',
          foundation: 'مسار واحد مختار (قدرات أو تحصيلي)',
          excellence: 'مسار القدرات والتحصيلي كاملاً',
          vip: 'جميع المسارات (قدرات + تحصيلي + نافس الوطنية)',
        },
        {
          name: 'فيديوهات الشرح التأسيسي التفاعلية',
          free: 'الدروس التمهيدية فقط',
          foundation: true,
          excellence: true,
          vip: true,
        },
        {
          name: 'بنك الأسئلة والشروحات المصورة',
          free: '10 أسئلة يومياً',
          foundation: 'غير محدود للمسار المختار',
          excellence: 'غير محدود لجميع الأقسام',
          vip: 'غير محدود + شروحات صوتية ونماذج متعددة',
        },
        {
          name: 'أحدث التجميعات المحدثة للعام الحالي',
          free: false,
          foundation: false,
          excellence: true,
          vip: true,
        },
      ],
    },
    {
      category: 'المحاكيات والذكاء الاصطناعي',
      items: [
        {
          name: 'اختبارات محاكاة قياس الحقيقية',
          free: 'اختبار تشخيصي واحد',
          foundation: 'اختبارات تقييمية قصيرة',
          excellence: 'محاكيات غير محدودة',
          vip: 'محاكيات غير محدودة بجميع النماذج السرية',
        },
        {
          name: 'نظام قفل الأقسام الصارم (25 دقيقة لقياس)',
          free: false,
          foundation: false,
          excellence: true,
          vip: true,
        },
        {
          name: 'المعلم الذكي الفوري (AI Smart Tutor)',
          free: false,
          foundation: false,
          excellence: false,
          vip: 'غير محدود مع السبورة التفاعلية',
        },
        {
          name: 'مشغل الشرح الصوتي للسبورة خطوة بخطوة 🎙️',
          free: false,
          foundation: false,
          excellence: true,
          vip: true,
        },
        {
          name: 'رادار تشخيص الفجوات المهارية وربطه العلاجي',
          free: false,
          foundation: true,
          excellence: true,
          vip: true,
        },
      ],
    },
    {
      category: 'الميزات المتقدمة والدعم',
      items: [
        {
          name: 'حصص البث المباشر والمراجعات المكثفة',
          free: false,
          foundation: false,
          excellence: false,
          vip: 'حضور مباشر مع كبار المدربين',
        },
        {
          name: 'تقارير ذكية دورية لولي الأمر عبر واتساب',
          free: false,
          foundation: false,
          excellence: false,
          vip: true,
        },
        {
          name: 'شهادات تكريم معتمدة برمز تحقق QR',
          free: false,
          foundation: true,
          excellence: true,
          vip: true,
        },
        {
          name: 'أولوية الدعم الفني والاستشارات الأكاديمية',
          free: 'دعم قياسي',
          foundation: 'دعم قياسي',
          excellence: 'دعم سريع',
          vip: 'أولوية قصوى على مدار الساعة',
        },
      ],
    },
  ];

  const faqs = [
    {
      q: 'هل يمكن لطالب المدرسة ترقية حسابه للاستفادة من مميزات VIP؟',
      a: 'نعم بالتأكيد! منصة المئة تعتمد محرك الوصول الهجين (Hybrid Access). إذا كانت مدرستك مشتركة في مسار القدرات، يمكنك ترقية حسابك فردياً لشراء التحصيلي أو الحصول على عضوية VIP الماسية والاستفادة من المعلم الذكي والسبورة الصوتية دون أن تفقد ربطك بمدرستك.',
    },
    {
      q: 'ما هو نظام قفل الأقسام الصارم في محاكيات قياس؟',
      a: 'هو محاكاة رقمية مطابقة تماماً لاختبارات المركز الوطني للقياس، حيث يُقسم الاختبار إلى أقسام مدة كل منها 25 دقيقة. لا يمكن للطالب الانتقال للقسم التالي حتى انتهاء الوقت، ولا يمكن الرجوع للأقسام السابقة، مما يدرب الطالب على إدارة الوقت والتغلب على توتر الاختبار الحقيقي.',
    },
    {
      q: 'ما هي طرق الدفع المتاحة في المنصة؟',
      a: 'ندعم جميع وسائل الدفع المعتمدة بالمملكة: مدى (Mada)، البطاقات الائتمانية (Visa / Mastercard)، أبل باي (Apple Pay)، بالإضافة إلى التحويل البنكي المباشر لحساب مؤسسة المئة التعليمية لدى مصرف الراجحي مع رفع صورة الإيصال.',
    },
    {
      q: 'هل يتم تجديد الاشتراك تلقائياً وسحب مبالغ من بطاقتي؟',
      a: 'لا! اشتراكات منصة المئة محددة المدة (شهر، 3 أشهر، 6 أشهر، أو سنة) ولا يتم تجديدها تلقائياً بدون إذنك. سنرسل لك تنبيهاً قبل انتهاء المدة ويمكنك التجديد يدوياً إذا رغبت في ذلك.',
    },
    {
      q: 'كيف يمكن لمدارسنا الحصول على باقة مدرسية وشعار خاص بنا؟',
      a: 'توفر المنصة باقات B2B مخصصة للمدارس والمجمعات التعليمية تشمل رفع شعار المدرسة (White-Label) على شاشات الطلاب والشهادات المطبوعة، وإدارة الفصول واستيراد بيانات الطلاب من نظام نور. يمكنك التواصل مع فريق المبيعات عبر الواتساب أو صفحة اتصل بنا لتجهيز عقد مدرستكم.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950" dir="rtl">
      {/* ── 1. Hero Header & Value Proposition ── */}
      <section className="relative overflow-hidden pt-16 pb-12 sm:pt-24 sm:pb-16 text-center px-4">
        {/* Glow Effects Background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-indigo-600/15 via-amber-500/10 to-transparent blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-4xl space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-1.5 text-xs font-black text-amber-300 shadow-inner">
            <Sparkles size={14} className="text-amber-400" />
            <span>باقات وعضويات التفوق والـ +90 في القدرات والتحصيلي</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight sm:leading-tight">
            استثمر في مستقبلك الأكاديمي <br />
            <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
              واختر خطتك للدرجة الكاملة (100)
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-sm sm:text-base text-slate-400 font-medium leading-relaxed">
            محاكيات قياس الحقيقية بقفل الأقسام، بنوك أسئلة محدثة لعام 2026، والمعلم الذكي الفوري مع الشرح الصوتي للسبورة خطوة بخطوة.
          </p>

          {/* ── Billing Cycle Selector ── */}
          <div className="pt-6 flex flex-col items-center gap-3">
            <div className="inline-flex items-center rounded-2xl border border-slate-800 bg-slate-900/90 p-1.5 shadow-xl backdrop-blur-md">
              {(Object.keys(BILLING_CYCLES) as BillingCycle[]).map((cycleKey) => {
                const config = BILLING_CYCLES[cycleKey];
                const isActive = billingCycle === cycleKey;
                return (
                  <button
                    key={cycleKey}
                    type="button"
                    onClick={() => setBillingCycle(cycleKey)}
                    className={`relative rounded-xl px-4 sm:px-6 py-2 text-xs sm:text-sm font-black transition-all cursor-pointer ${isActive
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'text-slate-400 hover:text-white'
                      }`}
                  >
                    <span>{config.shortLabel}</span>
                    {config.badge && (
                      <span className="absolute -top-3 -left-1 rounded-full bg-rose-600 px-1.5 py-0.2 text-[9px] font-black text-white shadow-xs animate-bounce">
                        {config.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-amber-400/90 font-bold">
              💡 الاشتراك السنوي يوفر لك أكثر من 35% مقارنة بالاشتراك الشهري
            </p>
          </div>
        </div>
      </section>

      {/* ── 2. Pricing Tier Cards (4 Tiers) ── */}
      <section className="mx-auto max-w-7xl px-4 pb-20">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 items-stretch">
          {MEMBERSHIP_TIERS.map((tier) => {
            const pricing = calculateTierPrice(tier.id, billingCycle);
            const isVip = tier.id === 'diamond_vip';
            const isExcellence = tier.id === 'golden_excellence';

            return (
              <div
                key={tier.id}
                className={`relative flex flex-col justify-between rounded-3xl p-6 sm:p-7 transition-all duration-300 backdrop-blur-xl ${isVip
                  ? 'border-2 border-amber-400/80 bg-gradient-to-b from-amber-950/40 via-slate-900/90 to-slate-950 shadow-2xl shadow-amber-500/15 lg:-translate-y-2'
                  : isExcellence
                    ? 'border-2 border-indigo-500/80 bg-gradient-to-b from-indigo-950/40 via-slate-900/90 to-slate-950 shadow-xl shadow-indigo-500/10'
                    : 'border border-slate-800/80 bg-slate-900/60 hover:border-slate-700'
                  }`}
              >
                {/* Popular / VIP Floating Tag */}
                {tier.popularTag && (
                  <div className="absolute -top-3.5 right-6 rounded-full bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 px-3.5 py-1 text-[11px] font-black text-slate-950 shadow-md">
                    {tier.popularTag}
                  </div>
                )}

                <div>
                  {/* Badge & Target */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-block rounded-xl px-2.5 py-0.5 text-[11px] font-black ${isVip
                        ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                        : isExcellence
                          ? 'bg-indigo-400/20 text-indigo-300 border border-indigo-400/30'
                          : 'bg-slate-800 text-slate-300'
                        }`}
                    >
                      {tier.badge}
                    </span>
                  </div>

                  <h3 className="mt-3 text-xl font-black text-white">{tier.name.split('(')[0]}</h3>
                  <p className="mt-1 text-xs text-slate-400 leading-5 font-medium">{tier.description}</p>

                  {/* Price Block */}
                  <div className="mt-6 border-y border-slate-800/80 py-4">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl sm:text-4xl font-black text-white">
                        {tier.pricing[billingCycle] === 0 ? 'مجاناً' : formatSaudiRiyal(pricing.price)}
                      </span>
                      {tier.pricing[billingCycle] > 0 && (
                        <span className="text-xs text-slate-400 font-bold">/ {pricing.periodLabel}</span>
                      )}
                    </div>

                    {tier.pricing[billingCycle] > 0 && (
                      <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                        <span>ما يعادل: {pricing.monthlyEquivalent} ر.س شهرياً</span>
                        {pricing.savingsPercent > 0 && (
                          <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.2 font-black text-emerald-400">
                            وفّر {pricing.savingsPercent}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Feature Highlights List */}
                  <div className="mt-6 space-y-3">
                    <p className="text-xs font-black text-slate-300">محتوى الباقة والميزات:</p>
                    <ul className="space-y-2.5 text-xs text-slate-300">
                      {tier.highlights.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <span
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${isVip
                              ? 'bg-amber-400 text-slate-950'
                              : isExcellence
                                ? 'bg-indigo-400 text-slate-950'
                                : 'bg-emerald-500/20 text-emerald-400'
                              }`}
                          >
                            <Check size={11} strokeWidth={3} />
                          </span>
                          <span className="leading-5 font-medium">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* CTA Action Button */}
                <div className="mt-8 pt-4">
                  <button
                    type="button"
                    onClick={() => handleSelectTier(tier)}
                    className={`w-full py-3 px-5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer text-center ${isVip
                      ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 text-slate-950 hover:brightness-110 shadow-lg shadow-amber-500/25'
                      : isExcellence
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/25'
                        : tier.id === 'free_starter'
                          ? 'border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                  >
                    {tier.id === 'free_starter'
                      ? 'ابدأ التجربة المجانية'
                      : isVip
                        ? 'امتلك عضوية VIP الماسية 💎'
                        : 'اشترك الآن في الباقة'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 3. School Code & Voucher Redemption Section ── */}
      <section id="vouchers" className="mx-auto max-w-4xl px-4 pb-20">
        <div className="relative overflow-hidden rounded-3xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/40 via-slate-900 to-slate-950 p-6 sm:p-10 shadow-2xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-right">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-500/20 px-3 py-1 text-xs font-black text-indigo-300">
                <Key size={14} /> كود تفعيل المدرسة أو كوبون الخصم
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">هل حصلت على كود وصول من مدرستك؟</h2>
              <p className="text-xs sm:text-sm text-slate-400 font-medium max-w-xl">
                أدخل رمز التفعيل الممنوح لك من إدارة مدرستك أو معلمك لربط حسابك فوراً والاستفادة من صلاحيات الباقة المدرسية مجاناً.
              </p>
            </div>

            <form onSubmit={handleRedeemCode} className="w-full md:w-auto flex flex-col sm:flex-row gap-2 shrink-0">
              <input
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="أدخل رمز التفعيل هنا..."
                className="w-full sm:w-64 rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-xs sm:text-sm font-mono font-bold text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={redeemLoading}
                className="rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-3 text-xs sm:text-sm font-black text-white hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 transition-all shadow-md cursor-pointer shrink-0"
              >
                {redeemLoading ? 'جارٍ التحقق...' : 'تفعيل الكود'}
              </button>
            </form>
          </div>

          {redeemSuccess && (
            <div className="mt-5 rounded-2xl border border-emerald-500/40 bg-emerald-950/50 p-4 text-xs font-black text-emerald-300 flex items-center gap-3">
              <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />
              <span>{redeemSuccess}</span>
            </div>
          )}

          {redeemError && (
            <div className="mt-5 rounded-2xl border border-rose-500/40 bg-rose-950/50 p-4 text-xs font-black text-rose-300 flex items-center gap-3">
              <X size={18} className="shrink-0 text-rose-400" />
              <span>{redeemError}</span>
            </div>
          )}
        </div>
      </section>

      {/* ── 4. Feature Comparison Matrix ── */}
      <section className="mx-auto max-w-7xl px-4 pb-20">
        <div className="text-center space-y-3 mb-10">
          <span className="rounded-full bg-slate-800 px-4 py-1 text-xs font-black text-slate-300">
            مقارنة الميزات الشاملة (Comparison Matrix)
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-white">جدول المقارنة التفصيلي بين الباقات</h2>
          <p className="text-xs sm:text-sm text-slate-400 font-medium">
            تعرف بدقة على ما ستحصل عليه في كل باقة لتختار الأنسب لمستواك وأهدافك.
          </p>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900/50 backdrop-blur-md shadow-2xl">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-300 font-black">
                <th className="p-4 sm:p-5 w-2/5">الميزة أو الأداة</th>
                <th className="p-4 sm:p-5 text-center">المجانية</th>
                <th className="p-4 sm:p-5 text-center">التأسيس</th>
                <th className="p-4 sm:p-5 text-center text-indigo-400">التميز (+90)</th>
                <th className="p-4 sm:p-5 text-center text-amber-400">الماسية VIP 👑</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
              {comparisonRows.map((cat, catIdx) => (
                <React.Fragment key={catIdx}>
                  <tr className="bg-slate-950/80 font-black text-amber-400/90">
                    <td colSpan={5} className="p-3.5 sm:px-5 text-xs">
                      {cat.category}
                    </td>
                  </tr>
                  {cat.items.map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 sm:p-5 font-bold text-white">{row.name}</td>
                      <td className="p-4 sm:p-5 text-center">{renderMatrixCell(row.free)}</td>
                      <td className="p-4 sm:p-5 text-center">{renderMatrixCell(row.foundation)}</td>
                      <td className="p-4 sm:p-5 text-center bg-indigo-950/10 font-bold">
                        {renderMatrixCell(row.excellence)}
                      </td>
                      <td className="p-4 sm:p-5 text-center bg-amber-950/15 font-black text-amber-300">
                        {renderMatrixCell(row.vip)}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 5. Frequently Asked Questions (FAQ) ── */}
      <section className="mx-auto max-w-4xl px-4 pb-24">
        <div className="text-center space-y-3 mb-10">
          <span className="rounded-full bg-slate-800 px-4 py-1 text-xs font-black text-slate-300">
            الأسئلة الشائعة (FAQ)
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white">كل ما تحتاج لمعرفته قبل الاشتراك</h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 transition-all overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between p-5 text-right font-black text-sm text-white hover:text-amber-400 transition-colors cursor-pointer"
                >
                  <span>{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp size={18} className="text-amber-400 shrink-0" />
                  ) : (
                    <ChevronDown size={18} className="text-slate-400 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs text-slate-400 leading-relaxed font-medium border-t border-slate-800/40">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 6. Bottom Trust & School Callout Banner ── */}
      <section className="border-t border-slate-800 bg-slate-900/40 py-12 px-4 text-center">
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-bold">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-emerald-400" /> دفع آمن 100% معتمد
            </span>
            <span className="flex items-center gap-1.5">
              <CreditCard size={16} className="text-blue-400" /> مدى، فيزا، ماستركارد، وأبل باي
            </span>
            <span className="flex items-center gap-1.5">
              <Building2 size={16} className="text-amber-400" /> تحويل بنكي مباشر لمصرف الراجحي
            </span>
          </div>
          <p className="text-xs text-slate-500">
            جميع الحقوق محفوظة © {new Date().getFullYear()} لمنصة المئة للتدريب والتعليم الذكي بالمملكة العربية السعودية.
          </p>
        </div>
      </section>
    </div>
  );
};

function renderMatrixCell(value: boolean | string) {
  if (value === true) {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mx-auto">
        <Check size={13} strokeWidth={3} />
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-slate-500 mx-auto">
        <Minus size={13} />
      </span>
    );
  }
  return <span className="font-bold">{value}</span>;
}

