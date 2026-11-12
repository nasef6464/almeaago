import React, { useState } from 'react';
import {
  Gift,
  Copy,
  Check,
  Share2,
  Users,
  Wallet,
  Sparkles,
  HelpCircle,
  X,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

interface ReferralAmbassadorModalProps {
  isOpen: boolean;
  onClose: () => void;
  referralCode: string;
  studentName?: string;
}

export const ReferralAmbassadorModal: React.FC<ReferralAmbassadorModalProps> = ({
  isOpen,
  onClose,
  referralCode,
  studentName = 'زميلي',
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const referralUrl = `${window.location.origin}/pricing?ref=${referralCode}`;
  const shareMessage = `🌟 هدية خاصة لك! اشترك في منصة المئة للقدرات والتحصيلي واحصل على خصم 10% فوري على أي باقة باستخدام كود الخصم الحصري الخاص بي: [${referralCode}] 🚀\nرابط الاشتراك المباشر: ${referralUrl}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2200);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  const handleShareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareMessage)}`, '_blank');
  };

  const handleShareX = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in" dir="rtl">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
              <Gift size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                برنامج سفراء المئة 🎁
              </h3>
              <p className="text-xs text-slate-500 font-bold">شارك الخصم مع زملائك واكسب رصيداً</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Main Hero Capsule */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-50 via-indigo-50 to-purple-100/50 dark:from-purple-950/30 dark:to-indigo-950/20 border border-purple-200/60 dark:border-purple-800/40 text-center">
            <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-purple-600 text-white inline-block mb-2 shadow-xs">
              كود الخصم الخاص بك
            </span>
            <div className="flex items-center justify-center gap-2.5 my-2">
              <span className="font-mono text-2xl sm:text-3xl font-black text-purple-700 dark:text-purple-300 tracking-wider">
                {referralCode}
              </span>
              <button
                onClick={handleCopyCode}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1 transition-colors shadow-xs"
              >
                {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedCode ? 'تم النسخ!' : 'نسخ الكود'}</span>
              </button>
            </div>
            <p className="text-xs text-purple-900 dark:text-purple-200 font-bold mt-1">
              يمنح زميلك خصماً فورياً 10% على كل الباقات والعضويات
            </p>
          </div>

          {/* Quick Share Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              onClick={handleShareWhatsApp}
              className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 transition-all shadow-xs"
            >
              <Share2 size={16} />
              <span>مشاركة سريعة عبر واتساب</span>
            </button>
            <button
              onClick={handleShareX}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-black text-white font-black text-xs flex items-center justify-center gap-2 transition-all shadow-xs"
            >
              <span>نشر الكود على منصة X</span>
            </button>
          </div>

          {/* Direct Link Box */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1 text-right">
              <div className="text-[10px] font-bold text-slate-400">رابط الدعوة المباشر:</div>
              <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 truncate">
                {referralUrl}
              </div>
            </div>
            <button
              onClick={handleCopyLink}
              className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 text-xs font-bold border border-slate-200 dark:border-slate-600 shrink-0 transition-colors"
            >
              {copiedLink ? 'تم! ✓' : 'نسخ الرابط'}
            </button>
          </div>

          {/* How It Works - 3 Steps */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">
              كيف يعمل برنامج سفراء المئة؟
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-center">
                <div className="w-8 h-8 mx-auto rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300 flex items-center justify-center font-black text-xs mb-1.5">
                  1
                </div>
                <div className="text-xs font-black text-slate-800 dark:text-slate-200">شارك كودك</div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">مع أصدقائك وزملائك في المدرسة أو القروبات</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-center">
                <div className="w-8 h-8 mx-auto rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center justify-center font-black text-xs mb-1.5">
                  2
                </div>
                <div className="text-xs font-black text-slate-800 dark:text-slate-200">خصم 10% لزميلك</div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">يطبق فورياً عند إدخال الكود في صفحة الدفع</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-center">
                <div className="w-8 h-8 mx-auto rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-300 flex items-center justify-center font-black text-xs mb-1.5">
                  3
                </div>
                <div className="text-xs font-black text-slate-800 dark:text-slate-200">مكافأة في محفظتك</div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">تكسب رصيداً وتمديداً مجانياً لاشتراكاتك بالمنصة</div>
              </div>
            </div>
          </div>

          {/* Benefits Summary Note */}
          <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 flex items-start gap-2 text-xs">
            <Sparkles size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-amber-900 dark:text-amber-200 font-bold leading-relaxed">
              كلما زاد عدد زملائك المشتركين بكودك، ترتفع رتبتك كسفير معتمد وتحصل على مزايا حصرية ودورات مجانية متقدمة!
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs transition-colors shadow-xs"
          >
            فهمت، شكراً لك
          </button>
        </div>
      </div>
    </div>
  );
};
