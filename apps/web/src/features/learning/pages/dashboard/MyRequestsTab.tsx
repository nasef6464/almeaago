import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, FileText, Loader2, RefreshCw, ShoppingBag, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { commerceClient } from '../../../commerce/api/commerce-client';
import type { CommercePaymentRequest } from '../../../commerce/api/commerce-types';

type RequestFilter = 'all' | 'pending' | 'paid' | 'cancelled';

export const MyRequestsTab: React.FC = () => {
  const [requests, setRequests] = useState<CommercePaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<RequestFilter>('all');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');

    commerceClient
      .myPaymentRequests(1, 50, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) {
          setRequests(res.items || []);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'تعذر تحميل قائمة طلباتك');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [reload]);

  const filteredRequests = useMemo(() => {
    if (filter === 'all') return requests;
    if (filter === 'pending') return requests.filter((r) => r.status === 'pending');
    if (filter === 'paid') return requests.filter((r) => r.status === 'paid');
    return requests.filter((r) => r.status === 'rejected' || r.status === 'cancelled' || r.status === 'failed');
  }, [filter, requests]);

  const statusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/60 px-3 py-1 text-xs font-black text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 size={13} /> مكتمل ومفعل
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800/60 px-3 py-1 text-xs font-black text-amber-700 dark:text-amber-300">
            <Clock size={13} /> قيد المراجعة
          </span>
        );
      case 'rejected':
      case 'cancelled':
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800/60 px-3 py-1 text-xs font-black text-rose-700 dark:text-rose-300">
            <XCircle size={13} /> {status === 'rejected' ? 'مرفوض' : 'ملغي'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-black text-slate-700 dark:text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 w-full min-w-0" dir="rtl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
            <FileText size={24} />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">طلباتي واشتراكاتي</h2>
            <p className="text-xs sm:text-sm font-bold text-gray-500 dark:text-slate-400 mt-0.5">
              سجل كامل لطلبات الشراء وتفعيل الباقات والعضويات.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setReload((v) => v + 1)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            تحديث
          </button>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-bold text-white transition shadow-xs"
          >
            <ShoppingBag size={14} />
            استعراض الباقات
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-3">
        {(
          [
            { id: 'all', label: 'كل الطلبات', count: requests.length },
            { id: 'pending', label: 'قيد المراجعة', count: requests.filter((r) => r.status === 'pending').length },
            { id: 'paid', label: 'المكتملة والمفعلة', count: requests.filter((r) => r.status === 'paid').length },
            { id: 'cancelled', label: 'الملغية والمرفوضة', count: requests.filter((r) => r.status === 'rejected' || r.status === 'cancelled').length },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              filter === tab.id
                ? 'bg-indigo-600 text-white shadow-xs font-black'
                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-100 dark:border-slate-700'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] ${
                filter === tab.id ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 font-bold text-gray-500 dark:text-slate-400">
          <Loader2 size={20} className="animate-spin text-indigo-600" />
          جارٍ تحميل طلباتك...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/50 p-4 font-bold text-rose-700 dark:text-rose-300">
          {error}
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-500 mb-4">
            <ShoppingBag size={28} />
          </div>
          <h3 className="text-base font-black text-gray-900 dark:text-white">لا توجد طلبات في هذا القسم</h3>
          <p className="mt-1 text-xs font-bold text-gray-500 dark:text-slate-400 max-w-sm leading-6">
            عند طلب تفعيل باقة أو شراء عضوية ستظهر حالتها وتفاصيل الفاتورة هنا فوراً.
          </p>
          <Link
            to="/pricing"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-xs font-bold text-white transition shadow-xs"
          >
            تصفح العضويات والباقات المتاحة
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((req) => (
            <article
              key={req.id}
              className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs transition hover:border-indigo-200 dark:hover:border-slate-700 hover:shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {statusBadge(req.status)}
                  <span className="font-mono text-[11px] font-bold text-gray-400 dark:text-slate-500">
                    #{req.id.slice(0, 8)}
                  </span>
                  <span className="text-gray-300 dark:text-slate-700">·</span>
                  <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
                    {new Date(req.createdAt).toLocaleDateString('ar-SA')}
                  </span>
                </div>

                <h4 className="text-base font-black text-gray-900 dark:text-white">
                  {req.productName || 'طلب اشتراك في باقة منصة المئة'}
                </h4>

                {req.reviewerNotes && (
                  <p className="mt-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                    ملاحظة المراجعة: {req.reviewerNotes}
                  </p>
                )}
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 border-t sm:border-t-0 border-gray-100 dark:border-slate-800 pt-3 sm:pt-0 shrink-0">
                <div className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                  {(req.finalAmountMinor / 100).toLocaleString('ar-SA')} {req.currency || 'ر.س'}
                </div>
                <div className="text-[11px] font-bold text-gray-400 dark:text-slate-500">
                  {req.paymentMethod === 'card'
                    ? 'بطاقة بنكية / مدى'
                    : req.paymentMethod === 'transfer'
                    ? 'تحويل بنكي'
                    : 'محفظة إلكترونية'}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
