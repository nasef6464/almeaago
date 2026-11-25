import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Clock, FileText, Loader2, RefreshCw, ShoppingBag, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../auth/state/AuthProvider';
import { commerceClient } from '../../../commerce/api/commerce-client';
import type { CommercePaymentRequest } from '../../../commerce/api/commerce-types';
import { sessionBookingsClient, type SessionBooking } from '../../api/learning-client';

type RequestFilter = 'all' | 'pending' | 'paid' | 'cancelled';

type UnifiedRequest =
  | { kind: 'payment'; createdAt: string; statusGroup: 'pending' | 'paid' | 'cancelled'; payment: CommercePaymentRequest }
  | { kind: 'booking'; createdAt: string; statusGroup: 'pending' | 'paid' | 'cancelled'; booking: SessionBooking };

function bookingGroup(status: SessionBooking['bookingStatus']): 'pending' | 'paid' | 'cancelled' {
  if (status === 'confirmed') return 'paid';
  if (status === 'rejected' || status === 'cancelled') return 'cancelled';
  return 'pending';
}

function paymentGroup(status: string): 'pending' | 'paid' | 'cancelled' {
  if (status === 'paid') return 'paid';
  if (status === 'rejected' || status === 'cancelled' || status === 'failed') return 'cancelled';
  return 'pending';
}

export const MyRequestsTab: React.FC = () => {
  const { getCsrfToken } = useAuth();
  const [requests, setRequests] = useState<CommercePaymentRequest[]>([]);
  const [bookings, setBookings] = useState<SessionBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<RequestFilter>('all');
  const [reload, setReload] = useState(0);
  const [cancellingId, setCancellingId] = useState('');

  const loadRequests = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    setError('');

    Promise.all([
      commerceClient.myPaymentRequests(1, 50, signal),
      sessionBookingsClient.mine(50, signal).catch(() => ({ bookings: [] as SessionBooking[] })),
    ])
      .then(([payRes, bookRes]) => {
        if (signal?.aborted) return;
        setRequests(payRes.items || []);
        setBookings(bookRes.bookings || []);
      })
      .catch((err) => {
        if (!signal?.aborted) {
          setError(err instanceof Error ? err.message : 'تعذر تحميل قائمة طلباتك');
        }
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadRequests(controller.signal);
    return () => controller.abort();
  }, [loadRequests, reload]);

  const unifiedItems = useMemo<UnifiedRequest[]>(() => {
    const all: UnifiedRequest[] = [
      ...requests.map((payment) => ({
        kind: 'payment' as const,
        createdAt: payment.createdAt,
        statusGroup: paymentGroup(payment.status),
        payment,
      })),
      ...bookings.map((booking) => ({
        kind: 'booking' as const,
        createdAt: booking.createdAt,
        statusGroup: bookingGroup(booking.bookingStatus),
        booking,
      })),
    ];
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [bookings, requests]);

  const filteredRequests = useMemo(() => {
    if (filter === 'all') return unifiedItems;
    return unifiedItems.filter((item) => item.statusGroup === filter);
  }, [filter, unifiedItems]);

  async function handleCancelBooking(bookingId: string) {
    setCancellingId(bookingId);
    try {
      const csrf = await getCsrfToken();
      const res = await sessionBookingsClient.cancel(bookingId, csrf);
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? res.booking : b)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إلغاء طلب الحجز');
    } finally {
      setCancellingId('');
    }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'paid':
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/60 px-3 py-1 text-xs font-black text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 size={13} /> {status === 'confirmed' ? 'حجز مؤكد' : 'مكتمل ومفعل'}
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
            <FileText size={24} />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">طلباتي واشتراكاتي</h2>
            <p className="text-xs sm:text-sm font-bold text-gray-500 dark:text-slate-400 mt-0.5">
              سجل طلبات الشراء وتفعيل الباقات وحجوزات الحصص الفردية.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
            to="/courses"
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition"
          >
            الدورات
          </Link>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-bold text-white transition shadow-xs"
          >
            <ShoppingBag size={14} />
            استعراض الباقات
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-3">
        {(
          [
            { id: 'all', label: 'كل الطلبات', count: unifiedItems.length },
            { id: 'pending', label: 'قيد المراجعة', count: unifiedItems.filter((r) => r.statusGroup === 'pending').length },
            { id: 'paid', label: 'المكتملة والمؤكدة', count: unifiedItems.filter((r) => r.statusGroup === 'paid').length },
            { id: 'cancelled', label: 'الملغية والمرفوضة', count: unifiedItems.filter((r) => r.statusGroup === 'cancelled').length },
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

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 font-bold text-gray-500 dark:text-slate-400">
          <Loader2 size={20} className="animate-spin text-indigo-600" />
          جارٍ تحميل طلباتك...
        </div>
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/50 p-4 font-bold text-rose-700 dark:text-rose-300">
          {error}
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-500 mb-4">
            <ShoppingBag size={28} />
          </div>
          <h3 className="text-base font-black text-gray-900 dark:text-white">لا توجد طلبات في هذا القسم</h3>
          <p className="mt-1 text-xs font-bold text-gray-500 dark:text-slate-400 max-w-sm leading-6">
            عند طلب تفعيل باقة أو حجز حصة فردية ستظهر حالتها هنا فوراً.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-xs font-bold text-white transition shadow-xs"
            >
              تصفح الباقات
            </Link>
            <Link
              to="/book-session?source=requests"
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-5 py-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 transition"
            >
              حجز حصة خاصة
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((entry) => {
            if (entry.kind === 'booking') {
              const booking = entry.booking;
              return (
                <article
                  key={`booking-${booking.id}`}
                  className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-violet-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {statusBadge(booking.bookingStatus)}
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-black text-violet-700">
                        <Calendar size={12} />
                        حجز حصة
                      </span>
                      <span className="text-xs font-bold text-gray-500">
                        {booking.scheduledDate} · {booking.scheduledTime}
                      </span>
                    </div>
                    <h4 className="text-base font-black text-gray-900 dark:text-white">{booking.title}</h4>
                    <p className="mt-1 text-xs font-bold text-gray-500">{booking.targetLabel}</p>
                    {booking.assignedTeacherName && (
                      <p className="mt-1 text-xs font-bold text-indigo-700">
                        المدرب المعين: {booking.assignedTeacherName}
                      </p>
                    )}
                    {booking.adminNotes && (
                      <p className="mt-2 rounded-xl bg-slate-50 p-2.5 text-xs font-bold text-slate-600">
                        ملاحظة الإدارة: {booking.adminNotes}
                      </p>
                    )}
                  </div>
                  {booking.bookingStatus === 'pending' && (
                    <button
                      type="button"
                      disabled={cancellingId === booking.id}
                      onClick={() => handleCancelBooking(booking.id)}
                      className="inline-flex items-center gap-1.5 self-start rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-black text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                    >
                      <XCircle size={14} />
                      <span>{cancellingId === booking.id ? 'جاري الإلغاء...' : 'إلغاء الحجز'}</span>
                    </button>
                  )}
                </article>
              );
            }

            const req = entry.payment;
            return (
              <article
                key={`payment-${req.id}`}
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

                  {req.paymentMethod === 'transfer' && req.status === 'pending' && req.productId && (
                    <div className="mt-2.5">
                      <Link
                        to={`/checkout?productId=${encodeURIComponent(req.productId)}`}
                        className="inline-flex items-center rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800 hover:bg-amber-100"
                      >
                        تحديث بيانات التحويل
                      </Link>
                    </div>
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
            );
          })}
        </div>
      )}
    </div>
  );
};
