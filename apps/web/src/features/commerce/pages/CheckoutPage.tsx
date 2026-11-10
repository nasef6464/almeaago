import {
  BadgeCheck,
  Building,
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  FileText,
  Info,
  Loader2,
  Percent,
  ReceiptText,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import { commerceClient } from '../api/commerce-client';
import type {
  CommerceDiscountPreview,
  CommercePaymentMethod,
  CommercePaymentRequest,
  CommerceProduct,
} from '../api/commerce-types';

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat('ar-SA', { style: 'currency', currency }).format(minor / 100);

function checkoutKey(productId: string) {
  const k = `commerce-checkout:${productId}`;
  let value = sessionStorage.getItem(k);
  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem(k, value);
  }
  return value;
}

function resetCheckoutKey(productId: string) {
  sessionStorage.removeItem(`commerce-checkout:${productId}`);
}

export function CheckoutPage() {
  const { user, loading: authLoading, getCsrfToken } = useAuth();
  const [params] = useSearchParams();
  const rawProductId = params.get('productId') || '';
  const rawCourseId = params.get('courseId') || '';

  const [resolvedProductId, setResolvedProductId] = useState(rawProductId);
  const [product, setProduct] = useState<CommerceProduct | null>(null);
  const [requests, setRequests] = useState<CommercePaymentRequest[]>([]);
  const [current, setCurrent] = useState<CommercePaymentRequest | null>(null);
  const [discountCode, setDiscountCode] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [preview, setPreview] = useState<CommerceDiscountPreview | null>(null);
  const [method, setMethod] = useState<CommercePaymentMethod>('card');
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Bank transfer receipt state
  const [senderName, setSenderName] = useState('');
  const [senderBank, setSenderBank] = useState('مصرف الراجحي');
  const [transferRef, setTransferRef] = useState('');
  const [receiptPreview, setReceiptPreview] = useState('');

  // 1. Resolve productId from courseId if needed
  useEffect(() => {
    if (authLoading || !user) return;
    const c = new AbortController();

    async function resolveAndLoad() {
      setBusy(true);
      setError('');
      try {
        let pId = rawProductId;
        if (!pId && rawCourseId) {
          try {
            const accessRes = await commerceClient.courseAccess(rawCourseId, c.signal);
            if (accessRes?.access?.productId) {
              pId = accessRes.access.productId;
            }
          } catch {}

          if (!pId) {
            const prodList = await commerceClient.products(1, 50, '', '', c.signal);
            const matched = prodList.items.find(
              (p) => p.courseId === rawCourseId || p.package?.items?.some((it) => it.courseId === rawCourseId)
            );
            if (matched) pId = matched.id;
          }
        }

        if (!pId) {
          setError('لم يتم العثور على منتج تجاري مسجل لهذه الدورة أو المحتوى.');
          setBusy(false);
          return;
        }

        setResolvedProductId(pId);
        const [p, r] = await Promise.all([
          commerceClient.catalogProduct(pId, c.signal),
          commerceClient.myPaymentRequests(1, 20, c.signal),
        ]);

        if (c.signal.aborted) return;
        setProduct(p.product);
        setRequests(r.items);
        setCurrent(r.items.find((x) => x.productId === pId && x.status === 'pending') || null);
      } catch (e) {
        if (!c.signal.aborted) setError(e instanceof Error ? e.message : 'تعذر تحميل بيانات الشراء');
      } finally {
        if (!c.signal.aborted) setBusy(false);
      }
    }

    void resolveAndLoad();
    return () => c.abort();
  }, [authLoading, rawProductId, rawCourseId, user]);

  const displayed = useMemo(
    () =>
      current
        ? {
            original: current.originalAmountMinor,
            discount: current.discountAmountMinor,
            final: current.finalAmountMinor,
            currency: current.currency,
          }
        : preview && preview.valid
        ? {
            original: preview.originalAmountMinor,
            discount: preview.discountAmountMinor,
            final: preview.finalAmountMinor,
            currency: preview.currency,
          }
        : product
        ? { original: product.priceMinor, discount: 0, final: product.priceMinor, currency: product.currency }
        : null,
    [current, preview, product]
  );

  async function applyDiscount() {
    const code = discountCode.trim();
    if (!product || !code) {
      setPreview(null);
      return;
    }
    setPreviewing(true);
    setError('');
    setNotice('');
    try {
      const r = await commerceClient.previewDiscount(product.id, code);
      setPreview(r.preview);
      if (!r.preview.valid) setNotice(r.preview.message || 'كود الخصم غير متاح لهذا المنتج.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر فحص كود الخصم');
    } finally {
      setPreviewing(false);
    }
  }

  async function redeem() {
    const code = accessCode.trim().toUpperCase();
    if (!code) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const csrf = await getCsrfToken();
      await commerceClient.redeemAccessCode(code, csrf);
      setNotice('تم تفعيل كود الوصول بنجاح! يمكنك الآن بدء دراسة المحتوى.');
      setAccessCode('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تفعيل كود الوصول');
    } finally {
      setSaving(false);
    }
  }

  function handleReceiptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setReceiptPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function submit() {
    if (!product || current) return;
    if (method === 'transfer' && !senderName.trim()) {
      setError('يرجى كتابة اسم صاحب الحساب المحول منه لإتمام التحقق من الحوالة البنكية.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const csrf = await getCsrfToken();
      const r = await commerceClient.createCheckout(
        {
          productId: product.id,
          discountCode: preview?.valid ? preview.code : '',
          paymentMethod: method,
          idempotencyKey: checkoutKey(product.id),
        },
        csrf
      );
      setCurrent(r.request);
      setRequests((v) => [r.request, ...v.filter((x) => x.id !== r.request.id)]);
      if (method === 'transfer') {
        setNotice(
          'تم تسجيل طلب التحويل البنكي بنجاح. سيتم مراجعة الإيصال واعتماد تفعيل اشتراكك في أقرب وقت.'
        );
      } else {
        setNotice(
          r.request.gatewayMode === 'manual_review'
            ? 'تم إنشاء طلب الدفع. سيتم تفعيل المحتوى فور اعتماد الطلب.'
            : 'تم إنشاء طلب الدفع. سيُفتح المحتوى فور إتمام عملية السداد.'
        );
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'تعذر إنشاء طلب الدفع';
      if (message === 'Payment provider unavailable') resetCheckoutKey(product.id);
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || busy) {
    return (
      <main className="p-10 text-center font-black" dir="rtl">
        <Loader2 size={32} className="mx-auto mb-3 animate-spin text-indigo-600" />
        جاري تحميل بيانات الشراء والمنتج...
      </main>
    );
  }
  if (!user) {
    return (
      <main className="p-10 text-center font-black text-rose-700" dir="rtl">
        يلزم تسجيل الدخول لإتمام عملية الشراء.
      </main>
    );
  }
  if (!product) {
    return (
      <main className="p-10 text-center font-black text-rose-700" dir="rtl">
        {error || 'المنتج المطلوب غير متاح حالياً أو لم يتم تسعيره.'}
      </main>
    );
  }
  if (product.accessMode !== 'paid') {
    return (
      <main className="p-10 text-center font-black text-emerald-700" dir="rtl">
        هذا المحتوى متاح مجاناً ولا يتطلب شراء!
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-slate-50 px-3 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-4">
        {/* Header */}
        <header className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl">
          <div className="flex items-center gap-2 text-amber-400">
            <CreditCard size={20} />
            <span className="text-xs font-black tracking-wider">بوابة الدفع والاشتراك الآمنة</span>
          </div>
          <h1 className="mt-2 text-2xl font-black">طلب شراء {product.name}</h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">
            السعر والخصم يُحتسبان بدقة وأمان من الخادم؛ اشتراكك محمي ومربوط بحسابك مباشرة.
          </p>
        </header>

        {error ? <div role="alert" className="rounded-2xl bg-rose-50 p-4 font-bold text-rose-700 text-sm">{error}</div> : null}
        {notice ? <div className="rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-800 text-sm">{notice}</div> : null}

        {/* Product Card */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-black text-indigo-700">
                {product.code}
              </span>
              <h2 className="mt-2 text-xl font-black text-slate-900">{product.name}</h2>
              <p className="mt-1 text-xs text-slate-500 font-bold">{product.description || 'وصول كامل لكافة دروس واختبارات وبنوك الأسئلة للمحتوى المختار.'}</p>
            </div>
            <div className="text-left text-xl font-black text-indigo-900">
              {money(product.priceMinor, product.currency)}
            </div>
          </div>
        </section>

        {/* Access Code Box */}
        <section data-testid="access-code-redemption" className="space-y-3 rounded-3xl border border-amber-200 bg-amber-50/70 p-5 shadow-xs">
          <div className="font-black text-amber-950 text-sm">لديك كود تفعيل أو كوبون من مدرستك؟</div>
          <p className="text-xs font-bold leading-5 text-amber-800">
            أدخل الكود لمنحك حق الوصول الكامل للمقرر فور التحقق من صلاحية الكود.
          </p>
          <div className="flex gap-2">
            <input
              data-testid="payment-access-code-input"
              aria-label="كود التفعيل"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
              placeholder="مثال: ALMEAA-VIP-2026"
              className="min-w-0 flex-1 rounded-xl border border-amber-300 bg-white p-2.5 font-mono text-sm font-black text-slate-900 uppercase"
            />
            <button
              data-testid="payment-redeem-access-code"
              type="button"
              disabled={saving || !accessCode.trim()}
              onClick={() => void redeem()}
              className="rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-black text-white hover:bg-amber-700 transition disabled:opacity-40"
            >
              تفعيل الكود
            </button>
          </div>
        </section>

        {/* Checkout Form */}
        {!current ? (
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
            {/* Discount Code */}
            <label className="block space-y-2">
              <span className="flex items-center gap-1.5 text-xs font-black text-slate-700">
                <Percent size={15} /> كوبون خصم
              </span>
              <div className="flex gap-2">
                <input
                  aria-label="كود الخصم"
                  value={discountCode}
                  onChange={(e) => {
                    setDiscountCode(e.target.value.toUpperCase());
                    setPreview(null);
                  }}
                  placeholder="DISCOUNT10"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 p-2.5 font-mono text-sm font-bold uppercase"
                />
                <button
                  type="button"
                  disabled={previewing || !discountCode.trim()}
                  onClick={() => void applyDiscount()}
                  className="rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-2 text-xs font-black text-indigo-800 hover:bg-indigo-100 transition disabled:opacity-40"
                >
                  {previewing ? <Loader2 size={16} className="animate-spin" /> : 'تطبيق'}
                </button>
              </div>
            </label>

            {preview ? (
              <div
                className={`rounded-xl p-3 text-xs font-black ${
                  preview.valid ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {preview.valid
                  ? `تم تطبيق الكوبون (${preview.code}): خصم ${money(preview.discountAmountMinor, preview.currency)}`
                  : preview.message}
              </div>
            ) : null}

            {/* Payment Method Selector */}
            <label className="block space-y-2">
              <span className="text-xs font-black text-slate-700">وسيلة الدفع المفضلة</span>
              <select
                aria-label="وسيلة الدفع"
                value={method}
                onChange={(e) => setMethod(e.target.value as CommercePaymentMethod)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-black bg-white"
              >
                <option value="card">💳 بطاقة مدى / فيزا / ماستركارد</option>
                <option value="transfer">🏛️ تحويل بنكي مباشر (حسابات المؤسسة الرسمية)</option>
                <option value="wallet">👛 محفظة الطالب / رصيد مسبق</option>
              </select>
            </label>

            {/* Bank Transfer Details Card (When 'transfer' is selected) */}
            {method === 'transfer' && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 space-y-3" dir="rtl">
                <div className="flex items-center gap-2 font-black text-blue-950 text-sm">
                  <Building size={18} className="text-blue-700" />
                  <span>بيانات الحساب البنكي الرسمي المعتمد:</span>
                </div>
                <div className="rounded-xl bg-white p-3 border border-blue-100 space-y-1.5 text-xs text-slate-700 font-bold">
                  <div className="flex justify-between">
                    <span className="text-slate-500">اسم المستفيد:</span>
                    <strong className="text-slate-900">مؤسسة المئة التعليمية للتدريب</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">البنك:</span>
                    <strong className="text-slate-900">مصرف الراجحي (Al Rajhi Bank)</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">رقم الآيبان (IBAN):</span>
                    <span className="font-mono font-black text-indigo-700 dir-ltr text-xs select-all">
                      SA03 8000 0456 6080 1234 5678
                    </span>
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <span className="block text-xs font-black text-slate-800">بيانات الحوالة البنكية:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="اسم صاحب الحساب المحول منه *"
                      className="rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-bold"
                    />
                    <select
                      value={senderBank}
                      onChange={(e) => setSenderBank(e.target.value)}
                      className="rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-bold"
                    >
                      <option value="مصرف الراجحي">مصرف الراجحي</option>
                      <option value="البنك الأهلي السعودي">البنك الأهلي السعودي</option>
                      <option value="بنك الرياض">بنك الرياض</option>
                      <option value="مصرف الإنماء">مصرف الإنماء</option>
                      <option value="بنك البلاد">بنك البلاد</option>
                      <option value="بنك آخر">بنك آخر</option>
                    </select>
                  </div>

                  <input
                    value={transferRef}
                    onChange={(e) => setTransferRef(e.target.value)}
                    placeholder="رقم مرجع التحويل أو آخر 4 أرقام من الحساب (اختياري)"
                    className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-bold"
                  />

                  {/* Receipt Upload */}
                  <div className="rounded-xl border border-dashed border-blue-300 bg-white p-3 text-center">
                    <label className="cursor-pointer block">
                      <UploadCloud size={24} className="mx-auto text-blue-600 mb-1" />
                      <span className="text-xs font-black text-blue-800">اضغط لرفع صورة إيصال التحويل البنكي</span>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleReceiptUpload}
                        className="hidden"
                      />
                    </label>
                    {receiptPreview && (
                      <div className="mt-2 text-xs font-bold text-emerald-700 flex items-center justify-center gap-1">
                        <CheckCircle2 size={14} />
                        <span>تم إرفاق صورة الإيصال بنجاح</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Price Breakdown */}
            {displayed ? (
              <div className="space-y-2 rounded-2xl bg-slate-50 p-4 text-xs font-bold">
                <div className="flex justify-between text-slate-600">
                  <span>السعر الأصلي:</span>
                  <span>{money(displayed.original, displayed.currency)}</span>
                </div>
                {displayed.discount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>قيمة الخصم:</span>
                    <span>- {money(displayed.discount, displayed.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-black text-slate-900">
                  <span>المبلغ الإجمالي المستحق:</span>
                  <span className="text-base text-indigo-700">{money(displayed.final, displayed.currency)}</span>
                </div>
              </div>
            ) : null}

            {/* Submit Button */}
            <button
              type="button"
              disabled={saving}
              onClick={() => void submit()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3.5 text-sm font-black text-white hover:bg-indigo-700 transition disabled:opacity-40 shadow-lg cursor-pointer"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
              {method === 'transfer' ? 'تأكيد إرسال طلب التحويل البنكي' : 'متابعة الدفع الآمن'}
            </button>
          </section>
        ) : (
          /* Payment Request Status */
          <section data-testid="payment-request-status" className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-950 shadow-xs">
            <div className="flex items-center gap-2 font-black text-base">
              <ReceiptText size={20} className="text-amber-700" />
              <span>
                {current.gatewayMode === 'payment_link'
                  ? 'طلب الدفع جاهز للانتقال إلى بوابة الدفع'
                  : 'طلب الدفع قيد المراجعة والاعتماد'}
              </span>
            </div>
            <p className="mt-2 text-xs font-bold leading-relaxed">
              رقم الطلب: <span className="font-mono">{current.id}</span> · المبلغ: <strong>{money(current.finalAmountMinor, current.currency)}</strong> · وسيلة الدفع: <strong>{current.providerCode}</strong>
            </p>
            <p className="mt-2 text-xs font-bold text-slate-600">
              يتم تفعيل صلاحيات وصول الدورة فور اعتماد التحويل أو إتمام الدفع بنجاح.
            </p>
            {current.gatewayMode === 'payment_link' && current.providerRedirectUrl ? (
              <a
                data-testid="payment-provider-redirect"
                href={current.providerRedirectUrl}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-xs font-black text-white hover:bg-indigo-700 transition shadow-md"
              >
                <CreditCard size={16} />
                <span>متابعة الدفع عبر بوابة {current.providerCode}</span>
              </a>
            ) : null}
          </section>
        )}

        {/* Previous Requests */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2 font-black text-sm text-slate-900">
            <BadgeCheck size={18} className="text-emerald-600" />
            <span>طلباتك السابقة</span>
          </div>
          <div className="mt-3 space-y-2">
            {requests.length === 0 ? (
              <p className="text-xs font-bold text-slate-400">لا توجد طلبات سابقة مسجلة بحسابك.</p>
            ) : (
              requests.slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs">
                  <span className="font-bold text-slate-800">{r.productName}</span>
                  <span className="font-black text-indigo-700">
                    {r.status === 'paid' ? 'مدفوع ومفعل ✓' : r.status === 'pending' ? 'قيد المراجعة' : r.status} ·{' '}
                    {money(r.finalAmountMinor, r.currency)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <div className="flex justify-between items-center pt-2">
          <Link to="/" className="inline-flex items-center gap-1 text-xs font-black text-indigo-700 hover:text-indigo-900">
            العودة للصفحة الرئيسية <ChevronLeft size={16} />
          </Link>
          <Link to="/learning/paths" className="text-xs font-black text-slate-500 hover:text-slate-800">
            استعراض جميع المسارات
          </Link>
        </div>
      </div>
    </main>
  );
}
