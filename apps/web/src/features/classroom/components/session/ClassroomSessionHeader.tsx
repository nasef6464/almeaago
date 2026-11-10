import React, { useState } from 'react';
import {
  Radio,
  Presentation,
  QrCode,
  Users,
  Clock,
  RefreshCcw,
  Maximize2,
  Share2,
  CheckCircle2,
  Copy,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ClassroomSession, ClassroomSessionStatus } from '../../api/classroom-types';
import { ClassroomJoinQR } from '../ClassroomJoinQR';

interface ClassroomSessionHeaderProps {
  session: ClassroomSession | null;
  pin: string;
  schoolName?: string;
  className?: string;
  subjectName?: string;
  joinedCount: number;
  expectedCount?: number;
  onRefresh: () => void;
  busy?: boolean;
}

const statusBadge: Record<ClassroomSessionStatus, { label: string; color: string }> = {
  draft: { label: 'مسودة', color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200' },
  scheduled: { label: 'مجدولة', color: 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300' },
  live: { label: 'مباشرة الآن', color: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 animate-pulse' },
  ended: { label: 'منتهية ومحفوظة', color: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
  archived: { label: 'مؤرشفة', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400' },
};

export const ClassroomSessionHeader: React.FC<ClassroomSessionHeaderProps> = ({
  session,
  pin,
  schoolName,
  className,
  subjectName,
  joinedCount,
  expectedCount = 0,
  onRefresh,
  busy = false,
}) => {
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyPin = () => {
    if (!pin) return;
    navigator.clipboard.writeText(pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusInfo = session?.status ? statusBadge[session.status] : statusBadge.draft;

  return (
    <>
      <header
        dir="rtl"
        className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white shadow-xl sm:p-6 dark:border-slate-800"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-cyan-300">
              <Radio size={16} className={session?.status === 'live' ? 'animate-pulse' : ''} />
              <span className="text-xs font-black tracking-wider uppercase">
                الفصل الذكي التفاعلي · SMART CLASSROOM
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>

            <h1 className="mt-2 text-2xl font-black sm:text-3xl text-white flex items-center gap-3">
              {subjectName || 'الحصة الدراسية'}
              {className && (
                <span className="text-sm font-bold text-slate-400 border border-slate-700 rounded-xl px-2.5 py-1">
                  {schoolName ? `${schoolName} · ` : ''}{className}
                </span>
              )}
            </h1>

            <p className="mt-1.5 text-xs text-slate-400 font-bold max-w-xl">
              تكامل لحظي مع بنك الأسئلة المعتمد، سبورة ذكية فائقة الدقة، ورصد فوري لحضور الطلاب وإجاباتهم.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Joined student counter badge */}
            <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 border border-white/10">
              <Users size={16} className="text-cyan-300" />
              <div className="text-right">
                <div className="text-xs font-black text-white">
                  {joinedCount} {expectedCount ? `من ${expectedCount}` : ''} طالب
                </div>
                <div className="text-[10px] font-bold text-slate-400">حضور متصل</div>
              </div>
            </div>

            {/* PIN Code Badge & QR Trigger */}
            {pin && (
              <div className="flex items-center gap-1.5 rounded-2xl bg-cyan-400/15 border border-cyan-400/30 px-3.5 py-2">
                <button
                  type="button"
                  title="عرض باركود QR"
                  onClick={() => setQrModalOpen(true)}
                  className="rounded-lg p-1 text-cyan-300 hover:bg-cyan-400/20"
                >
                  <QrCode size={18} />
                </button>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-cyan-200">رمز الدخول (PIN)</div>
                  <div dir="ltr" className="font-mono text-base font-black tracking-widest text-cyan-300">
                    {pin}
                  </div>
                </div>
                <button
                  type="button"
                  title="نسخ الرمز"
                  onClick={copyPin}
                  className="rounded-lg p-1 text-cyan-300 hover:bg-cyan-400/20"
                >
                  {copied ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Copy size={16} />}
                </button>
              </div>
            )}

            {/* Open Projector Display Link */}
            {session?.id && (
              <Link
                to={`/classroom/${session.id}/projector`}
                target="_blank"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-xs font-black text-slate-950 shadow-md hover:bg-slate-100 transition"
              >
                <Presentation size={16} className="text-indigo-600" />
                شاشة العرض (بروجكتور)
              </Link>
            )}

            {/* Refresh Button */}
            <button
              type="button"
              disabled={busy}
              onClick={onRefresh}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-white/20 bg-white/5 px-3 py-2.5 text-xs font-black text-white hover:bg-white/10 disabled:opacity-40"
            >
              <RefreshCcw size={15} className={busy ? 'animate-spin' : ''} />
              تحديث
            </button>
          </div>
        </div>
      </header>

      {/* QR Code Big Modal */}
      {qrModalOpen && pin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          dir="rtl"
        >
          <div className="flex w-full max-w-sm flex-col items-center rounded-3xl border border-slate-800 bg-slate-900 p-6 text-center text-white shadow-2xl">
            <h3 className="text-lg font-black">رمز ودعوة الفصل الذكي</h3>
            <p className="mt-1 text-xs text-slate-400">امسح الكود بكاميرا الجوال للدخول فوراً</p>

            <div className="my-5 rounded-2xl bg-white p-4 shadow-lg">
              <ClassroomJoinQR pin={pin} size={180} />
            </div>

            <div className="w-full rounded-2xl bg-cyan-400/15 border border-cyan-400/30 p-3">
              <div className="text-xs text-cyan-200">أو أدخل رمز PIN المكون من 6 أرقام:</div>
              <div dir="ltr" className="mt-1 font-mono text-3xl font-black tracking-widest text-cyan-300">
                {pin}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setQrModalOpen(false)}
              className="mt-5 w-full rounded-2xl bg-white/10 py-2.5 text-xs font-black hover:bg-white/20"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </>
  );
};
