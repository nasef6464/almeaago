import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ShoppingCart, Trash2 } from 'lucide-react';
import { useHeaderCart } from './useHeaderCart';
import { PaymentModal } from './PaymentModal';
import { EmptyState } from './EmptyState';
import type { CartItem } from './cart-model';

const typeLabel: Record<CartItem['type'], string> = {
  course: 'دورة',
  package: 'باقة',
  skill: 'تأسيس',
  test: 'اختبار',
  bank: 'بنك أسئلة',
};

export const CartPage: React.FC = () => {
  const { cartItems, removeFromCart, clearCart } = useHeaderCart();
  const [activeItem, setActiveItem] = useState<CartItem | null>(null);
  const location = useLocation();
  const isCheckoutPage = location.pathname === '/checkout';

  const totalsByCurrency = useMemo(() => {
    const totals = new Map<string, number>();
    cartItems.forEach((item) => {
      const currency = String(item.currency || 'SAR').trim() || 'SAR';
      totals.set(currency, (totals.get(currency) || 0) + Number(item.price || 0));
    });
    return Array.from(totals.entries()).map(([currency, amount]) => ({ currency, amount }));
  }, [cartItems]);

  const confirmRemoveItem = (item: CartItem) => {
    const confirmed = window.confirm(`هل تريد حذف "${item.title}" من السلة؟ يمكنك إضافته مرة أخرى لاحقًا.`);
    if (!confirmed) return;
    removeFromCart(item.id, item.type);
  };

  const confirmClearCart = () => {
    const confirmed = window.confirm('هل تريد تفريغ السلة بالكامل؟ ستحتاج لإضافة العناصر مرة أخرى قبل الشراء.');
    if (!confirmed) return;
    clearCart();
  };

  if (!cartItems.length) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10" dir="rtl">
        <EmptyState
          eyebrow={isCheckoutPage ? 'الدفع' : 'السلة'}
          title="سلة المشتريات فارغة"
          description="اختر باقة أو عضوية أولًا، ثم ارجع لإتمام الدفع من هنا."
          icon={<ShoppingCart size={22} />}
          primaryAction={{ label: 'تصفح الباقات', href: '/pricing', icon: <ShoppingCart size={15} /> }}
          secondaryAction={{ label: 'لوحة الطالب', href: '/dashboard', icon: <ShoppingCart size={15} /> }}
          tone="indigo"
          className="bg-white"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8" dir="rtl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-gray-900">سلة المشتريات</h1>
        <button
          type="button"
          data-testid="cart-clear-confirm"
          onClick={confirmClearCart}
          className="rounded-xl border border-rose-200 px-4 py-2 text-xs font-black text-rose-700 hover:bg-rose-50"
        >
          تفريغ السلة
        </button>
      </div>

      <div className="space-y-3">
        {cartItems.map((item) => (
          <div key={`${item.type}-${item.id}`} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="mb-2 inline-flex rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-black text-indigo-700">
                  {typeLabel[item.type]}
                </div>
                <h3 className="text-base font-black text-gray-900">{item.title}</h3>
              </div>
              <div className="text-left">
                <div className="text-sm font-black text-indigo-700">{item.price} {item.currency || 'SAR'}</div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveItem(item)}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700"
              >
                شراء الآن
              </button>
              <button
                type="button"
                data-testid="cart-remove-confirm"
                onClick={() => confirmRemoveItem(item)}
                className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-4 py-2 text-xs font-black text-gray-600 hover:bg-gray-50"
              >
                <Trash2 size={14} />
                حذف
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <span className="text-sm font-bold text-gray-500">إجمالي السلة</span>
          <div className="space-y-1 text-left">
            {totalsByCurrency.map(({ currency, amount }) => (
              <div key={currency} className="text-xl font-black text-indigo-700">{amount} {currency}</div>
            ))}
          </div>
        </div>
        {isCheckoutPage && cartItems.length === 1 ? (
          <button
            type="button"
            data-testid="checkout-single-item-pay"
            onClick={() => setActiveItem(cartItems[0] || null)}
            className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white hover:bg-indigo-700"
          >
            إتمام الدفع الآن
          </button>
        ) : null}
        {isCheckoutPage && cartItems.length > 1 ? (
          <div data-testid="checkout-multi-item-note" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold leading-6 text-amber-800">
            الدفع يتم لكل عنصر بشكل مستقل. استخدم زر «شراء الآن» أمام كل عنصر لإنشاء طلبه بالسعر والعملة الصحيحة.
          </div>
        ) : null}
      </div>

      {activeItem ? (
        <PaymentModal
          isOpen
          onClose={() => setActiveItem(null)}
          item={activeItem}
          type={activeItem.type}
        />
      ) : null}
    </div>
  );
};

export default CartPage;
