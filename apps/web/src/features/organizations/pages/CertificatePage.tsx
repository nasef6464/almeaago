import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { AlertCircle, Award, CheckCircle2, Copy, Loader2, Printer, ShieldCheck, Sparkles } from 'lucide-react';
import { lessonProgressSummaryClient, type CertificateVerification } from '../../learning/api/learning-client';

const formatIssuedDate = (value?: string | number | Date) => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return parsed.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
};

export const CertificatePage: React.FC = () => {
  const { code = '' } = useParams<{ code: string }>();
  return <CertificateDetails key={code} code={code} />;
};

function CertificateDetails({ code }: { code: string }) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [certificate, setCertificate] = useState<CertificateVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    lessonProgressSummaryClient
      .certificateByCode(code, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        if (!res.certificate?.verificationCode ||
          res.certificate.verificationCode.toUpperCase() !== code.trim().toUpperCase()) {
          setError('تعذر التحقق من رمز الشهادة في السجل الرسمي.');
          return;
        }
        setCertificate(res.certificate);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setCertificate(null);
        const unknown = err instanceof Error && 'status' in err && err.status === 404;
        setError(unknown
          ? 'لم يتم العثور على شهادة مطابقة لهذا الرمز.'
          : 'تعذر التحقق من رمز الشهادة في السجل الرسمي.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [code]);

  const verifyUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://almeaa.net';
    return `${origin}/certificate/${encodeURIComponent(code)}`;
  }, [code]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // If code is empty
  if (!code) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center" dir="rtl">
        <div className="max-w-md rounded-3xl border border-rose-200 bg-white p-8 shadow-sm">
          <p className="text-rose-600 font-black text-lg">لم يتم تحديد رمز الشهادة للتحقق.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center" dir="rtl">
        <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-indigo-600" />
          <p role="status" className="text-slate-700 font-black text-sm">جارٍ التحقق من الشهادة في السجل الرسمي…</p>
        </div>
      </div>
    );
  }

  if (error || !certificate) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center" dir="rtl">
        <div className="max-w-md rounded-3xl border border-rose-200 bg-white p-8 shadow-sm space-y-2">
          <AlertCircle size={28} className="mx-auto text-rose-600" />
          <p role="alert" className="text-rose-700 font-black text-base">
            {error || 'لم يتم العثور على شهادة مطابقة لهذا الرمز.'}
          </p>
          <p className="font-mono text-xs text-slate-500" dir="ltr">{code}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #certificate-sheet, #certificate-sheet * { visibility: visible !important; }
          #certificate-sheet { position: absolute !important; inset: 0 !important; width: 100% !important; margin: 0 auto !important; box-shadow: none !important; border: 0 !important; }
          #certificate-actions { display: none !important; }
        }
      `}</style>

      <main className="min-h-screen bg-slate-100/80 px-4 py-8 sm:py-12" dir="rtl">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Public Verification Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                <ShieldCheck size={20} />
              </span>
              <div>
                <h4 className="text-sm font-black text-emerald-950">شهادة معتمدة وموثقة رسمياً</h4>
                <p className="text-xs font-bold text-emerald-700">تم التحقق من صحة السجل الأكاديمي الرقمي في قاعدة بيانات منصة المئة.</p>
              </div>
            </div>
            <div className="font-mono text-xs font-black text-emerald-900 bg-white px-3 py-1.5 rounded-xl border border-emerald-200" dir="ltr">
              {code}
            </div>
          </div>

          {/* Printable Royal Certificate Sheet */}
          <div
            id="certificate-sheet"
            className="overflow-hidden rounded-3xl border-8 border-double border-amber-300/80 bg-white shadow-2xl relative"
            style={{
              backgroundImage: 'radial-gradient(circle at center, #ffffff 0%, #faf8f5 100%)',
            }}
          >
            {/* Header Banner */}
            <header className="relative bg-gradient-to-l from-indigo-900 via-indigo-800 to-amber-600 px-8 py-8 text-white text-right">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-amber-300 text-xs font-black mb-1">
                    <Sparkles size={14} /> منصة المئة للقدرات والتحصيلي
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black">شهادة تقدير وإنجاز معتمدة</h1>
                  <p className="mt-1 text-xs text-indigo-100 font-bold">
                    صادرة من منصة المئة بناءً على إتمام الدورة
                  </p>
                </div>
                <div className="hidden sm:flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20">
                  <Award size={36} className="text-amber-300" />
                </div>
              </div>
            </header>

            {/* Main Certificate Content */}
            <div className="grid gap-8 p-8 md:grid-cols-[1.5fr_0.5fr] items-center">
              <section className="text-right space-y-4">
                <p className="text-xs font-black text-slate-500">
                  تشهد منصة المئة التعليمية بأن الطالب:
                </p>
                <div className="inline-block border-b-2 border-dashed border-amber-400 pb-1">
                  <h2 className="text-3xl font-black text-slate-900">{certificate.studentName || 'طالب المنصة'}</h2>
                </div>

                <p className="text-xs font-bold text-slate-600 leading-6">
                  أتم متطلبات {certificate.courseName ? `دورة «${certificate.courseName}»` : 'الدورة'}.
                  {certificate.completionPercentage != null ? ` نسبة الإتمام ${certificate.completionPercentage}%.` : ''}
                </p>

                <div className="grid gap-3 sm:grid-cols-2 pt-2">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5">
                    <p className="text-[11px] font-bold text-slate-500">حالة الاعتماد</p>
                    <p className="mt-0.5 text-sm font-black text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 size={16} /> موثقة وسارية
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5">
                    <p className="text-[11px] font-bold text-slate-500">تاريخ الإصدار</p>
                    <p className="mt-0.5 text-sm font-black text-slate-800">{formatIssuedDate(certificate.issuedAt)}</p>
                  </div>
                </div>

                <div className="pt-2 text-xs text-slate-500">
                  <p>
                    رمز التحقق الرقمي:{' '}
                    <span className="font-mono font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg">
                      {certificate.verificationCode || code}
                    </span>
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400 break-all">{verifyUrl}</p>
                </div>
              </section>

              {/* Dynamic QR Verification Link */}
              <aside className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-6 text-center">
                <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-2xs">
                  <QRCodeSVG value={verifyUrl} size={150} fgColor="#1e293b" level="M" />
                </div>
                <p className="text-xs font-black text-amber-900">امسح الكود بكاميرا الجوال للتحقق الفوري</p>
              </aside>
            </div>

            {/* Certificate Action Footer */}
            <footer
              id="certificate-actions"
              className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/80 px-8 py-4"
            >
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Printer size={15} />
                <span>طباعة الشهادة الرسمية</span>
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Copy size={15} />
                <span>نسخ رابط التحقق</span>
              </button>
              {copyStatus !== 'idle' ? <p role="status" className="w-full text-xs text-slate-600">
                {copyStatus === 'copied' ? 'تم نسخ الرابط.' : 'تعذر نسخ الرابط. يمكنك تحديده ونسخه يدويًا.'}
              </p> : null}
            </footer>
          </div>
        </div>
      </main>
    </>
  );
};

export default CertificatePage;
