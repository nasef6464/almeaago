import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard, ExternalLink, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../auth/state/AuthProvider';
import {publicCommerceClient,type PublicProduct} from './commerce-public-client';
import type {CartItem} from './cart-model';
import PricingComparisonMatrix, { EducationalStageKey } from './PricingComparisonMatrix';

const PaymentModal = React.lazy(() => import('./PaymentModal').then((module) => ({ default: module.PaymentModal })));

const formatPrice = (price?: number, currency = 'SAR') =>
  `${new Intl.NumberFormat('ar-SA').format(Number(price || 0))} ${currency}`;

export const PricingPage: React.FC = () => {
  const {user}=useAuth();
  const [selectedMembership,setSelectedMembership]=useState<CartItem|null>(null);
  const [memberships,setMemberships]=useState<Array<PublicProduct & {title:string;price:number;features:string[]}>>([]);
  const [catalogLoading,setCatalogLoading]=useState(true);const [catalogError,setCatalogError]=useState('');
  const isAdmin=Boolean(user?.roles.includes('admin'));
  const referralRef=useMemo(()=>new URLSearchParams(window.location.search).get('ref'),[]);
  useEffect(()=>{const controller=new AbortController();setCatalogLoading(true);setCatalogError('');(async()=>{const rows:PublicProduct[]=[];for(let page=1;page<=10000;page++){const r=await publicCommerceClient.catalog(page,controller.signal);rows.push(...r.items);if(!r.hasMore)break;}if(!controller.signal.aborted)setMemberships(rows.filter(x=>x.publicMembership).map(x=>({...x,title:x.name,price:x.priceMinor/100,features:[]})));})().catch(e=>{if(!controller.signal.aborted)setCatalogError(e instanceof Error?e.message:'تعذر تحميل العضويات')}).finally(()=>{if(!controller.signal.aborted)setCatalogLoading(false)});return()=>controller.abort()},[]);
  const freeMembershipLink = user?.id ? '/dashboard' : '/login';

  const handleSelectTier = (tierKey: 'free' | 'standard' | 'pro', _stageKey: EducationalStageKey) => {
    if (tierKey === 'free') {
      window.location.href = freeMembershipLink;
      return;
    }

    // Paid stage offers need an explicit canonical mapping before purchase.
    return;
  };

  return (
    <div data-testid="pricing-memberships-page" className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-10" dir="rtl">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h1 className="text-3xl font-black text-gray-900 sm:text-4xl">عضويات المنصة</h1>
          <p className="mt-3 text-sm text-gray-600 sm:text-base">
            العضوية هنا اشتراك عام على مستوى المنصة. باقات المسارات والمدارس تدار بشكل مستقل داخل المسارات والمدارس.
          </p>
          {referralRef && (
            <div className="mt-6 inline-block rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 border border-purple-200 p-4 text-center shadow-xs">
              <span className="inline-block rounded-full bg-purple-600 px-3 py-0.5 text-xs font-black text-white">
                هدية سفراء المئة 🎁
              </span>
              <p className="mt-2 text-sm font-black text-purple-950">
                مرحباً بك! كود خصم زميلك <span className="font-mono text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md font-black">{referralRef}</span> سيتم التحقق منه عند إنشاء طلب الشراء.
              </p>
            </div>
          )}
        </div>

        {catalogLoading ? <div role="status" className="mt-8 text-center font-bold">جارٍ تحميل العضويات...</div> : null}
        {catalogError ? <div role="alert" className="mt-8 rounded-xl bg-rose-50 p-4 text-rose-700">{catalogError}</div> : null}
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">مجانية</span>
            <h2 className="mt-3 text-2xl font-black text-gray-900">عضوية مجانية</h2>
            <div className="mt-2 text-3xl font-black text-indigo-700">0 ر.س</div>
            <ul className="mt-5 space-y-2 text-sm text-gray-700">
              <li className="rounded-xl bg-gray-50 px-3 py-2">الوصول للمحتوى المجاني</li>
              <li className="rounded-xl bg-gray-50 px-3 py-2">لوحة طالب أساسية</li>
              <li className="rounded-xl bg-gray-50 px-3 py-2">شراء باقات المسارات عند الحاجة</li>
            </ul>
            <Link
              to={freeMembershipLink}
              data-testid="pricing-free-membership-start"
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white hover:bg-indigo-700"
            >
              ابدأ الآن
            </Link>
          </div>

          {memberships.map((membership) => (
            <div key={membership.id} className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
              <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">عضوية عامة</span>
              <h2 className="mt-3 text-2xl font-black text-gray-900">{membership.title}</h2>
              <div className="mt-2 text-3xl font-black text-indigo-700">
                {formatPrice(membership.price, membership.currency || 'SAR')}
              </div>
              {membership.description ? (
                <p className="mt-3 text-sm leading-7 text-gray-600">{membership.description}</p>
              ) : null}
              <ul className="mt-5 space-y-2 text-sm text-gray-700">
                {(membership.features?.length ? membership.features : ['وصول عام حسب إعدادات المدير']).slice(0, 5).map((feature: string) => (
                  <li key={feature} className="rounded-xl bg-gray-50 px-3 py-2">{feature}</li>
                ))}
              </ul>
              <button
                type="button"
                data-testid="pricing-membership-request"
                onClick={() => setSelectedMembership({id:membership.id,title:membership.name,price:membership.price,type:'package',currency:membership.currency})}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white hover:bg-amber-600"
              >
                <CreditCard size={16} />
                طلب العضوية
              </button>
            </div>
          ))}
        </div>

        {!catalogLoading && !catalogError && memberships.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-7 text-amber-800">
            العضوية المجانية متاحة. ستظهر العضويات المدفوعة هنا عند نشرها.
          </div>
        ) : null}

        {/* Smart Age-Appropriate Comparison Matrix */}
        <PricingComparisonMatrix onSelectTier={handleSelectTier} />

        {isAdmin ? (
          <div className="mt-10 rounded-2xl border border-indigo-100 bg-white p-4 text-sm leading-7 text-gray-700 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="mt-1 rounded-full bg-indigo-50 p-2 text-indigo-600">
                  <ShieldCheck size={18} />
                </span>
                <div>
                  <div className="font-black text-gray-900">إدارة العضويات العامة</div>
                  <div className="text-gray-600">
                    العضويات العامة تظهر هنا بعد نشرها من تبويب العضويات. باقات المسارات والمدارس تدار في أماكنها.
                  </div>
                </div>
              </div>
              <Link
                to="/admin-dashboard?tab=memberships"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white hover:bg-indigo-700"
              >
                فتح إدارة العضويات
                <ExternalLink size={16} />
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      <React.Suspense fallback={null}>
        {selectedMembership ? <PaymentModal
          isOpen
          onClose={() => setSelectedMembership(null)}
          item={selectedMembership}
          type="package"
        /> : null}
      </React.Suspense>
    </div>
  );
};

export default PricingPage;
