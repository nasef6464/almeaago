import {
  ArrowRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Printer,
  QrCode,
  RadioTower,
  SquareArrowOutUpRight,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';

import { assessmentSessionClient } from '../api/assessment-session-client';
import type {
  AssessmentSession,
  AssessmentSessionChannel,
  AssessmentSessionStatus,
} from '../api/assessment-session-client';
import type { AssessmentSummary } from '../api/assessment-types';

const channelLabels: Record<AssessmentSessionChannel, string> = {
  public: 'عام (رابط مباشر)',
  barcode: 'اختبار باركود QR',
  live: 'جلسة حية مباشرة',
};

const statusLabels: Record<AssessmentSessionStatus, string> = {
  scheduled: 'مجدول',
  active: 'نشط ومتاح للطلاب',
  closed: 'مغلق',
  cancelled: 'ملغي',
};

type Props = {
  assessment: AssessmentSummary;
  getCsrfToken: () => Promise<string>;
  onBack: () => void;
};

function localToISO(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function AssessmentSessionPanel({ assessment, getCsrfToken, onBack }: Props) {
  const [rows, setRows] = useState<AssessmentSession[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [channel, setChannel] = useState<AssessmentSessionChannel>('barcode');
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [maxSubmissions, setMaxSubmissions] = useState('');
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [copied, setCopied] = useState('');
  const [printSession, setPrintSession] = useState<AssessmentSession | null>(null);
  const [expandedQrSessionId, setExpandedQrSessionId] = useState<string | null>(null);

  useEffect(() => {
    const c = new AbortController();
    setBusy(true);
    assessmentSessionClient
      .list(assessment.id, 1, 100, c.signal)
      .then((x) => {
        setRows(x.items);
        setHasMore(x.hasMore);
      })
      .catch((e) => {
        if (!c.signal.aborted) {
          setError(e instanceof Error ? e.message : 'تعذر تحميل الجلسات');
        }
      })
      .finally(() => {
        if (!c.signal.aborted) setBusy(false);
      });
    return () => c.abort();
  }, [assessment.id, reload]);

  async function create() {
    setSaving(true);
    setError('');
    try {
      const csrf = await getCsrfToken();
      await assessmentSessionClient.create(
        {
          assessmentId: assessment.id,
          channel,
          schoolId: '',
          classId: '',
          opensAt: localToISO(opensAt),
          closesAt: localToISO(closesAt),
          maxSubmissions: channel === 'live' || !maxSubmissions ? null : Number(maxSubmissions),
        },
        csrf,
      );
      setReload((x) => x + 1);
      setOpensAt('');
      setClosesAt('');
      setMaxSubmissions('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر إنشاء الجلسة');
    } finally {
      setSaving(false);
    }
  }

  async function status(row: AssessmentSession, next: AssessmentSessionStatus) {
    setSaving(true);
    setError('');
    try {
      const csrf = await getCsrfToken();
      await assessmentSessionClient.status(row.id, next, csrf);
      setReload((x) => x + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحديث حالة الجلسة');
    } finally {
      setSaving(false);
    }
  }

  function getSessionUrl(row: AssessmentSession) {
    const path =
      row.channel === 'live'
        ? `/live-assessment?code=${encodeURIComponent(row.sessionCode)}`
        : `/barcode-test/${encodeURIComponent(row.sessionCode)}`;
    return `${window.location.origin}${path}`;
  }

  async function copy(row: AssessmentSession) {
    const url = getSessionUrl(row);
    await navigator.clipboard.writeText(url);
    setCopied(row.id);
    window.setTimeout(() => setCopied(''), 2000);
  }

  function handlePrint(row: AssessmentSession) {
    setPrintSession(row);
    setTimeout(() => {
      window.print();
    }, 300);
  }

  return (
    <main dir="rtl" className="mx-auto max-w-5xl space-y-5 pb-16">
      <header className="rounded-3xl bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-950 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-black text-cyan-300">
              <QrCode size={14} />
              جلسات واختبارات الباركود
            </div>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">{assessment.title}</h1>
            <p className="mt-1 text-sm font-medium text-slate-300">
              كود الاختبار: {assessment.code} · الإصدار {assessment.currentVersion} المنشور
            </p>
          </div>
          <button
            onClick={onBack}
            className="inline-flex items-center justify-center gap-2 self-start rounded-2xl border border-slate-700 bg-white/10 px-4 py-2.5 text-sm font-black text-white backdrop-blur-xs transition hover:bg-white/20 sm:self-auto"
          >
            <ArrowRight size={18} />
            الرجوع لقائمة الاختبارات
          </button>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 font-bold text-rose-700 shadow-xs">
          {error}
        </div>
      ) : null}

      {/* نموذج إنشاء جلسة جديدة */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-black text-slate-900">إنشاء جلسة اختبار جديدة</h2>
        <p className="mt-1 text-xs font-medium text-slate-500">
          تُنشأ الجلسة مجدولة أولًا؛ قم بتفعيلها عندما ترغب بإتاحة الرابط والباركود للطلاب.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1">
            <span className="text-xs font-black text-slate-700">نوع القناة</span>
            <select
              aria-label="قناة الجلسة"
              value={channel}
              onChange={(e) => setChannel(e.target.value as AssessmentSessionChannel)}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-800"
            >
              {Object.entries(channelLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-black text-slate-700">تفتح في (اختياري)</span>
            <input
              aria-label="وقت الفتح"
              type="datetime-local"
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-800"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-black text-slate-700">تغلق في (اختياري)</span>
            <input
              aria-label="وقت الإغلاق"
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-800"
            />
          </label>

          {channel !== 'live' ? (
            <label className="space-y-1">
              <span className="text-xs font-black text-slate-700">الحد الأقصى للإجابات</span>
              <input
                aria-label="حد المشاركات"
                type="number"
                min={1}
                value={maxSubmissions}
                placeholder="بدون حد"
                onChange={(e) => setMaxSubmissions(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-800"
              />
            </label>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            disabled={saving}
            onClick={() => void create()}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white shadow-xs transition hover:bg-indigo-700 disabled:opacity-40"
          >
            {saving ? <Loader2 className="animate-spin" size={17} /> : <RadioTower size={17} />}
            إنشاء جلسة الباركود
          </button>
        </div>
      </section>

      {/* قائمة الجلسات الحالية */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div className="flex items-center gap-2">
            <QrCode size={18} className="text-indigo-600" />
            <h2 className="font-black text-slate-900">الجلسات المنشأة للطلاب</h2>
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
            {rows.length} جلسة
          </span>
        </div>

        {hasMore ? (
          <div className="border-b bg-amber-50 p-3 text-xs font-bold text-amber-800">
            يوجد أكثر من 100 جلسة؛ المعروض أحدث 100 جلسة.
          </div>
        ) : null}

        {busy ? (
          <div className="p-12 text-center font-bold text-slate-500">جاري تحميل الجلسات...</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm font-bold text-slate-400">
            لا توجد جلسات بعد. قم بإنشاء أول جلسة باركود أعلاه لإتاحة الاختبار.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((row) => {
              const url = getSessionUrl(row);
              const isQrExpanded = expandedQrSessionId === row.id;

              return (
                <article key={row.id} className="p-5 transition hover:bg-slate-50/50">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-700">
                          {channelLabels[row.channel]}
                        </span>
                        <span
                          className={`rounded-lg px-2.5 py-1 text-xs font-black ${
                            row.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : row.status === 'scheduled'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {statusLabels[row.status]}
                        </span>
                        <span className="text-xs font-bold text-slate-400">v{row.assessmentVersion}</span>
                      </div>

                      <div className="mt-3 flex items-center gap-3">
                        <span className="font-mono text-base font-black tracking-widest text-slate-900 sm:text-lg">
                          {row.sessionCode}
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedQrSessionId(isQrExpanded ? null : row.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          <QrCode size={14} className="text-indigo-600" />
                          {isQrExpanded ? 'إخفاء الباركود' : 'عرض الباركود'}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => void copy(row)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 shadow-xs hover:bg-slate-50"
                      >
                        {copied === row.id ? (
                          <>
                            <CheckCircle2 size={14} className="text-emerald-600" />
                            <span className="text-emerald-600">تم النسخ</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            نسخ الرابط
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handlePrint(row)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 shadow-xs hover:bg-slate-50"
                      >
                        <Printer size={14} />
                        طباعة كرت الباركود
                      </button>

                      {row.status === 'scheduled' ? (
                        <button
                          disabled={saving}
                          onClick={() => void status(row, 'active')}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700"
                        >
                          تفعيل
                        </button>
                      ) : null}

                      {row.status === 'active' ? (
                        <button
                          disabled={saving}
                          onClick={() => void status(row, 'closed')}
                          className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-black text-rose-700 hover:bg-rose-50"
                        >
                          إغلاق
                        </button>
                      ) : null}

                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-black text-white hover:bg-slate-800"
                      >
                        فتح
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>

                  {/* لوحة عرض الباركود القابلة للتوسيع */}
                  {isQrExpanded ? (
                    <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50/40 p-6 sm:flex-row sm:gap-6">
                      <div className="rounded-2xl border border-white bg-white p-4 shadow-md">
                        <QRCodeSVG value={url} size={160} level="H" includeMargin />
                      </div>
                      <div className="mt-3 text-center sm:mt-0 sm:text-right">
                        <h4 className="text-sm font-black text-slate-900">{assessment.title}</h4>
                        <p className="mt-1 text-xs text-slate-500">امسح الباركود بالكاميرا لفتح الاختبار فورًا</p>
                        <p className="mt-2 font-mono text-xs font-bold text-indigo-700">{url}</p>
                        <button
                          type="button"
                          onClick={() => handlePrint(row)}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700"
                        >
                          <Printer size={14} />
                          طباعة ورقة الباركود
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* معاينة الطباعة لورقة الباركود */}
      {printSession ? (
        <div className="print-only hidden p-8 text-center" dir="rtl">
          <div className="mx-auto max-w-md rounded-3xl border-2 border-slate-900 p-8">
            <h1 className="text-2xl font-black text-slate-900">{assessment.title}</h1>
            <p className="mt-2 text-sm text-slate-600">امسح رمز الاستجابة السريعة (QR Code) لبدء الاختبار</p>
            <div className="my-6 flex justify-center">
              <QRCodeSVG value={getSessionUrl(printSession)} size={240} level="H" includeMargin />
            </div>
            <p className="font-mono text-lg font-black tracking-widest text-indigo-900">
              {printSession.sessionCode}
            </p>
            <p className="mt-2 text-xs text-slate-500">منصة المئة التعليمية · قدرات & تحصيلي</p>
          </div>
        </div>
      ) : null}
    </main>
  );
}
