import React, { useState } from 'react';
import { Gift, Copy, Check, Share2, Sparkles, ChevronLeft, Users } from 'lucide-react';
import { ReferralAmbassadorModal } from './ReferralAmbassadorModal';

interface ReferralAmbassadorCardProps {
  userId: string;
  userName?: string;
}

export const deriveReferralCode = (userId: string): string => {
  if (!userId || userId === 'guest') return 'ALMEAA10';
  const clean = userId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const suffix = clean.length >= 5 ? clean.slice(-5) : clean.padEnd(5, 'X');
  return `ALM-${suffix}`;
};

export const ReferralAmbassadorCard: React.FC<ReferralAmbassadorCardProps> = ({
  userId,
  userName = 'يا بطل',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const referralCode = deriveReferralCode(userId);
  const referralUrl = `${window.location.origin}/pricing?ref=${referralCode}`;
  const shareMessage = `🌟 هدية خاصة لك من ${userName}! اشترك في منصة المئة واحصل على خصم 10% فوري على أي باقة باستخدام كودي: [${referralCode}] 🚀\nرابط الاشتراك: ${referralUrl}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleShareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareMessage)}`, '_blank');
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 p-4 sm:p-5 text-white shadow-md shadow-indigo-500/10 border border-purple-500/30">
        {/* Decorative background glows */}
        <div className="absolute -left-8 -top-8 w-32 h-32 rounded-full bg-indigo-400/20 blur-xl pointer-events-none" />
        <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-purple-400/20 blur-lg pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left info column */}
          <div className="flex items-start gap-3 sm:gap-3.5">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20 shadow-inner">
              <Gift size={24} className="text-purple-200" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-purple-500/50 border border-purple-300/30 text-purple-100">
                  سفراء المئة 🎁
                </span>
                <span className="text-[11px] font-bold text-purple-200">
                  خصم 10% لزميلك + رصيد لمحفظتك
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white mt-1 leading-tight">
                شارك كود الخصم الحصري واكسب مكافآت
              </h3>
              <p className="text-xs text-purple-100/90 font-medium mt-0.5 max-w-md">
                كل طالب يشترك بكودك يحصل على خصم 10% فورياً، ويُضاف لرصيدك في محفظة المنصة مكافأة نقدية وتمديد مجاني.
              </p>
            </div>
          </div>

          {/* Right action column */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            {/* Referral Code Box */}
            <div className="flex items-center justify-between gap-2 bg-black/25 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/20">
              <div>
                <div className="text-[10px] font-bold text-purple-200">كودك الحصري:</div>
                <div className="font-mono text-sm font-black text-white tracking-wide">{referralCode}</div>
              </div>
              <button
                onClick={handleCopyCode}
                className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white font-bold text-xs flex items-center gap-1 transition-colors"
                title="نسخ كود الخصم"
              >
                {copied ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} />}
                <span>{copied ? 'تم!' : 'نسخ'}</span>
              </button>
            </div>

            {/* Quick WhatsApp Share */}
            <button
              onClick={handleShareWhatsApp}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-xs"
            >
              <Share2 size={14} />
              <span>واتساب</span>
            </button>

            {/* Details Modal Trigger */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-black text-xs flex items-center justify-center gap-1 transition-colors border border-white/20"
            >
              <span>التفاصيل</span>
              <ChevronLeft size={15} />
            </button>
          </div>
        </div>
      </div>

      <ReferralAmbassadorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        referralCode={referralCode}
        studentName={userName}
      />
    </>
  );
};
