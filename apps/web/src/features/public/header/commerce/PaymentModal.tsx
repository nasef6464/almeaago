import React, {useEffect,useRef,useState} from 'react';
import {CheckCircle2,ChevronLeft,CreditCard,Landmark,Lock,ShieldCheck,Wallet,X} from 'lucide-react';
import {useAuth} from '../../../auth/state/AuthProvider';
import {commerceClient} from '../../../commerce/api/commerce-client';
import type {CommerceProduct,CommercePaymentMethod,CommercePaymentRequest,CommerceGatewayMode} from '../../../commerce/api/commerce-types';
import {publicCommerceClient} from './commerce-public-client';
import {useHeaderCart} from './useHeaderCart';
import type {CartItem} from './cart-model';
import {checkoutAttempts,isTerminalCheckoutStatus,normalizeCheckoutIntent} from './checkout-intent';
interface Props{isOpen:boolean;onClose:()=>void;item:CartItem;type?:CartItem['type']}
interface MethodSettings{label:string;instructions:string;providerName:string;phoneNumber:string;bankName:string;iban:string;accountName:string;accountNumber:string}
const emptyMethod:MethodSettings={label:'',instructions:'',providerName:'',phoneNumber:'',bankName:'',iban:'',accountName:'',accountNumber:''};
const settings={notes:'',card:emptyMethod,transfer:emptyMethod,wallet:emptyMethod};
export const PaymentModal:React.FC<Props>=({isOpen,onClose,item,type='course'})=>{
 const {user,getCsrfToken}=useAuth();const{addToCart}=useHeaderCart();const operationGeneration=useRef(0);
 const[step,setStep]=useState<'intro'|'method'|'details'|'success'|'previous'>('intro');const[method,setMethod]=useState<CommercePaymentMethod|null>(null);
 const[canonical,setCanonical]=useState<CommerceProduct|null>(null);const[productLoading,setProductLoading]=useState(true);
 const[enabledMethods,setEnabledMethods]=useState<CommercePaymentMethod[]>([]);const[settingsLoading,setSettingsLoading]=useState(true);const[gatewayMode,setGatewayMode]=useState<CommerceGatewayMode>('manual_review');
 const[loading,setLoading]=useState(false);const[accessCode,setAccessCode]=useState('');const[accessCodeLoading,setAccessCodeLoading]=useState(false);
 const[actionError,setActionError]=useState<string|null>(null);const[successMessage,setSuccessMessage]=useState<string|null>(null);const actionErrorRef=useRef<HTMLDivElement|null>(null);
 const[discountCode,setDiscountCode]=useState('');const[discountPreview,setDiscountPreview]=useState<{valid:boolean;originalAmount:number;discountAmount:number;finalAmount:number;message:string}|null>(null);const[discountPreviewLoading,setDiscountPreviewLoading]=useState(false);const[request,setRequest]=useState<CommercePaymentRequest|null>(null);
 useEffect(()=>{operationGeneration.current++;if(!isOpen)return;const c=new AbortController();setLoading(false);setAccessCodeLoading(false);setAccessCode('');setCanonical(null);setProductLoading(true);setStep('intro');setActionError(null);setMethod(null);setDiscountCode('');setDiscountPreview(null);setRequest(null);setSuccessMessage(null);setSettingsLoading(true);setEnabledMethods([]);
 publicCommerceClient.paymentOptions(c.signal).then(r=>{if(c.signal.aborted)return;setEnabledMethods(r.methods);setGatewayMode(r.gatewayMode)}).catch(()=>{if(!c.signal.aborted)setActionError('تعذر تحميل إعدادات الدفع. حاول مرة أخرى.')}).finally(()=>{if(!c.signal.aborted)setSettingsLoading(false)});
 if(user)commerceClient.catalogProduct(item.id,c.signal).then(r=>{if(c.signal.aborted)return;if(r.product.accessMode==='paid'&&r.product.priceMinor>0)setCanonical(r.product);else setActionError('هذا المنتج لا يحتاج طلب دفع.')}).catch(e=>{if(!c.signal.aborted)setActionError(e instanceof Error?e.message:'المنتج غير متاح')}).finally(()=>{if(!c.signal.aborted)setProductLoading(false)});else{setProductLoading(false);setActionError('سجل دخولك أولاً لإرسال طلب شراء.')};return()=>{c.abort();operationGeneration.current++};},[isOpen,item.id,user]);
 useEffect(()=>{setDiscountPreview(null);setDiscountPreviewLoading(false);if(!isOpen||!canonical||!discountCode.trim())return;let cancelled=false;const timer=setTimeout(()=>{setDiscountPreviewLoading(true);commerceClient.previewDiscount(canonical.id,discountCode).then(({preview:p})=>{if(!cancelled)setDiscountPreview({valid:p.valid,originalAmount:p.originalAmountMinor/100,discountAmount:p.discountAmountMinor/100,finalAmount:p.finalAmountMinor/100,message:p.message})}).catch(e=>{if(!cancelled)setActionError(e.message)}).finally(()=>{if(!cancelled)setDiscountPreviewLoading(false)})},450);return()=>{cancelled=true;clearTimeout(timer)}},[canonical,discountCode,isOpen]);
 useEffect(()=>{if(actionError)actionErrorRef.current?.focus()},[actionError]);
 if(!isOpen)return null;
 const getItemName=()=>canonical?.name||item.title;const getPrice=()=>canonical?canonical.priceMinor/100:item.price;const getCurrency=()=>canonical?.currency||item.currency||'SAR';
 const getTitle=()=>type==='package'?'الاشتراك في الباقة':type==='skill'?'فتح التأسيس':type==='bank'?'فتح التدريب':type==='test'?'فتح الاختبار':'الاشتراك في الدورة';
 const methodProviderLabel=(_method:CommercePaymentMethod)=>'';
 const selectMethod=(value:CommercePaymentMethod)=>{if(!user){setActionError('سجل دخولك أولاً ثم أكمل الشراء.');return}setMethod(value);setStep('details')};
 const handleAddToCart=()=>{if(!user){setActionError('سجل دخولك أولاً ثم أضف العناصر إلى السلة.');return}if(!canonical||canonical.priceMinor<=0){setActionError('لا يمكن إضافة عنصر بلا سعر إلى السلة.');return}addToCart({id:canonical.id,title:canonical.name,type,price:canonical.priceMinor/100,currency:canonical.currency});setSuccessMessage(`تمت إضافة ${getItemName()} إلى سلة المشتريات.`);setStep('success')};
 const handleRedeemAccessCode=async()=>{if(!user||!accessCode.trim()){setActionError('سجل دخولك وأدخل كود التفعيل أولًا.');return}setAccessCodeLoading(true);const generation=operationGeneration.current;try{const csrf=await getCsrfToken();if(generation!==operationGeneration.current)return;await commerceClient.redeemAccessCode(accessCode.trim(),csrf);if(generation!==operationGeneration.current)return;setSuccessMessage('تم تفعيل الكود بنجاح وإضافة الباقة المرتبطة إلى حسابك.');setStep('success')}catch(e){if(generation===operationGeneration.current)setActionError(e instanceof Error?e.message:'تعذر تفعيل الكود الآن.')}finally{if(generation===operationGeneration.current)setAccessCodeLoading(false)}};
 const purchaseIntent=()=>canonical&&method&&user?normalizeCheckoutIntent({actorId:user.id,productId:canonical.id,paymentMethod:method,discountCode}):null;
 const handlePayment=async()=>{
  const intent=purchaseIntent();if(!intent||request)return;
  const generation=operationGeneration.current;setLoading(true);setActionError(null);
  try{
   const csrf=await getCsrfToken();if(generation!==operationGeneration.current)return;
   const {request:r}=await commerceClient.createCheckout({productId:intent.productId,paymentMethod:intent.paymentMethod,discountCode:intent.discountCode,idempotencyKey:checkoutAttempts.get(intent)},csrf);
   if(generation!==operationGeneration.current)return;
   setRequest(r);
   if(isTerminalCheckoutStatus(r.status)){setStep('previous');return}
   setSuccessMessage(`رقم الطلب: ${r.id}. ${r.gatewayMode==='payment_link'?'تابع الدفع عبر الرابط لإكمال الطلب.':'سيظهر في طلباتك لحين المراجعة.'}`);setStep('success');
  }catch(e){if(generation===operationGeneration.current)setActionError(e instanceof Error?e.message:'تعذر إرسال طلب الدفع الآن.')}
  finally{if(generation===operationGeneration.current)setLoading(false)}
 };
 const beginNewPurchase=()=>{const intent=purchaseIntent();if(!intent||!request||!isTerminalCheckoutStatus(request.status))return;checkoutAttempts.beginNew(intent);setRequest(null);setSuccessMessage(null);setStep('details');setActionError(null)};
 const renderPrevious=()=>request?<div data-testid="payment-previous-request" className="space-y-5 py-8 text-center"><h3 className="text-2xl font-black text-gray-900">طلب سابق</h3><p className="text-sm font-bold leading-7 text-gray-600">رقم الطلب: {request.id} · الحالة: {request.status}</p><p className="text-sm leading-7 text-gray-500">لم يتم إنشاء طلب جديد. يمكنك بدء طلب شراء آخر بشكل مستقل.</p><button type="button" onClick={beginNewPurchase} className="w-full rounded-2xl bg-indigo-600 px-5 py-3 font-black text-white">بدء طلب شراء جديد</button><button type="button" onClick={onClose} className="w-full rounded-2xl border border-gray-200 px-5 py-3 font-black text-gray-600">إغلاق</button></div>:null;

 const renderPaymentDecisionSummary=()=> <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 text-right"><div className="text-sm font-black text-indigo-900">ملخص طلب الشراء</div><div className="mt-3 space-y-2">{[type==='package'?'هذا الطلب يفتح الباقة المختارة فقط':'هذا الطلب يفتح هذا العنصر فقط','لن يتم فتح المحتوى تلقائيًا من المتصفح',gatewayMode==='manual_review'?'تتم مراجعة الطلب وتفعيل الوصول من الإدارة':'يتم تفعيل الوصول بعد تأكيد الدفع'].map(row=><div key={row} className="flex items-start gap-2 text-xs font-bold leading-5 text-indigo-700"><ShieldCheck size={14} className="mt-0.5 shrink-0"/><span>{row}</span></div>)}</div></div>;
    const renderMethodButton = (
        selectedMethod: CommercePaymentMethod,
        title: string,
        description: string,
        icon: React.ReactNode,
        iconClasses: string,
    ) => (
        <button
            onClick={() => selectMethod(selectedMethod)}
            className="w-full flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-5 rounded-2xl border-2 border-gray-100 hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
        >
            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl transition-colors ${iconClasses}`}>{icon}</div>
                <div className="text-right">
                    <p className="font-bold text-gray-800">{title}</p>
                    <p className="text-xs text-gray-500">{description}</p>
                    {methodProviderLabel(selectedMethod) ? (
                        <p className="mt-1 text-[11px] font-bold text-gray-400">{methodProviderLabel(selectedMethod)}</p>
                    ) : null}
                </div>
            </div>
            <ChevronLeft size={20} className="text-gray-400" />
        </button>
    );

    const renderActionError = (compact = false) => actionError ? (
        <div
            ref={actionErrorRef}
            data-testid="payment-action-error"
            role="alert"
            aria-live="assertive"
            tabIndex={-1}
            className={`rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-right text-sm font-bold text-red-700 outline-none focus:ring-2 focus:ring-red-300 ${compact ? '' : 'sticky top-0 z-20 mb-4 shadow-sm'}`}
        >
            {actionError}
        </div>
    ) : null;

    const renderIntro = () => (
        <div className="space-y-4 animate-fade-in text-right">
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="text-xs font-black text-amber-700">محتوى مدفوع</div>
                        <h3 className="mt-2 text-2xl font-black text-gray-900">{getItemName()}</h3>
                        <p className="mt-2 text-sm font-bold leading-6 text-gray-600">
                            اختر طريقة الدفع المناسبة وسننشئ لك رقم طلب واضح للمتابعة.
                        </p>
                    </div>
                    <div className="rounded-2xl bg-white px-5 py-4 text-center shadow-sm">
                        <div className="text-xs font-bold text-gray-500">السعر المختار</div>
                        <div className="mt-1 text-xl font-black text-indigo-600">{getPrice()} {getCurrency()}</div>
                    </div>
                </div>
            </div>



            <div className="flex flex-col gap-3 sm:flex-row">
                <button
                    type="button"
                    onClick={() => setStep('method')}
                    disabled={productLoading || Boolean(user && !canonical)}
                    data-testid="payment-continue-purchase"
                    className="flex-1 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700"
                >
                    متابعة الشراء
                </button>
                <button
                    type="button"
                    onClick={handleAddToCart}
                    className="rounded-2xl border border-indigo-200 px-5 py-3 text-sm font-black text-indigo-700 transition-all hover:bg-indigo-50"
                >
                    إضافة للسلة
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-2xl border border-gray-200 px-5 py-3 text-sm font-black text-gray-600 transition-all hover:bg-gray-50"
                >
                    ليس الآن
                </button>
            </div>
        </div>
    );

    const renderMethodSelector = () => (
        <div className="space-y-4 animate-fade-in">
            <h3 className="text-xl font-black text-gray-800 mb-6 text-right">{getTitle()}</h3>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-right">
                <div className="text-xs font-black text-gray-500">طلب الشراء</div>
                <div className="mt-2 text-lg font-black text-gray-900">{getItemName()}</div>
                <div className="mt-2 text-sm font-black text-indigo-600">{getPrice()} {getCurrency()}</div>
            </div>



            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3 text-right">
                <div>
                    <p className="font-bold text-amber-900">لديك كود تفعيل؟</p>
                    <p className="text-xs text-amber-700 mt-1">فعّل الباقة أو الدورة مباشرة من نفس النافذة بدون خطوات دفع إضافية.</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                        value={accessCode}
                        onChange={(event) => setAccessCode(event.target.value.toUpperCase())}
                        data-testid="payment-access-code-input"
                        placeholder="أدخل كود التفعيل"
                        className="flex-1 p-3 rounded-xl border border-amber-200 bg-white focus:ring-2 focus:ring-amber-400 outline-none font-mono"
                    />
                    <button
                        onClick={() => void handleRedeemAccessCode()}
                        disabled={accessCodeLoading}
                        data-testid="payment-redeem-access-code"
                        className="bg-amber-500 text-white px-4 py-3 rounded-xl font-bold text-sm hover:bg-amber-600 transition-colors disabled:opacity-60"
                    >
                        {accessCodeLoading ? 'جارٍ التفعيل...' : 'تفعيل الكود'}
                    </button>
                </div>
            </div>

            {settings.notes && <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700 text-right">{settings.notes}</div>}
            {settingsLoading && <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 text-right">جارٍ تحميل إعدادات الدفع...</div>}
            {!settingsLoading && enabledMethods.length === 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 text-right">
                    لا توجد وسيلة دفع مفعلة حاليًا. يمكنك استخدام كود تفعيل أو التواصل مع الإدارة.
                </div>
            )}

            {enabledMethods.includes('card') && renderMethodButton('card', settings.card.label || 'بطاقة بنكية', settings.card.instructions || 'إرسال طلب دفع ومراجعته من الإدارة أو تفعيل الدفع الآمن لاحقًا.', <CreditCard size={24} />, 'bg-indigo-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white')}
            {enabledMethods.includes('transfer') && renderMethodButton('transfer', settings.transfer.label || 'تحويل بنكي', settings.transfer.instructions || 'إنشاء طلب تحويل بنكي للمراجعة.', <Landmark size={24} />, 'bg-amber-100 text-amber-600 group-hover:bg-amber-600 group-hover:text-white')}
            {enabledMethods.includes('wallet') && renderMethodButton('wallet', settings.wallet.label || 'محفظة إلكترونية', settings.wallet.instructions || 'إنشاء طلب دفع عبر المحفظة للمراجعة.', <Wallet size={24} />, 'bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white')}
        </div>
    );

    const renderDetails = () => (
        <div className="space-y-6 animate-fade-in text-right">
            <button className="flex items-center gap-2 text-indigo-600 mb-4" onClick={() => setStep('method')}>
                <ChevronLeft size={20} className="rotate-180" />
                <span className="font-bold text-sm">العودة لطرق الدفع</span>
            </button>

            {method === 'card' && (
                <div className="space-y-4">
                    <h3 className="text-xl font-black text-gray-800">طلب دفع بالبطاقة</h3>
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-700">
                        اضغط إنشاء الطلب، وسنرسل لك طريقة إكمال الدفع أو نفعّل الوصول بعد المراجعة.
                    </div>
                </div>
            )}

            {method === 'transfer' && (
                <div className="space-y-4">
                    <h3 className="text-xl font-black text-gray-800">بيانات التحويل</h3>
                    <div className="bg-gray-50 p-6 rounded-2xl space-y-4 border border-gray-100">
                        {settings.transfer.bankName && <InfoRow label="اسم البنك" value={settings.transfer.bankName} />}
                        {settings.transfer.iban && <InfoRow label="رقم الآيبان (IBAN)" value={settings.transfer.iban} mono />}
                        {settings.transfer.accountName && <InfoRow label="اسم المستفيد" value={settings.transfer.accountName} />}
                        {settings.transfer.accountNumber && <InfoRow label="رقم الحساب" value={settings.transfer.accountNumber} />}
                    </div>
                    <input disabled placeholder="رقم مرجع التحويل أو العملية — غير متاح حاليًا" className="w-full p-4 rounded-xl border border-gray-200 opacity-50" />
                </div>
            )}

            {method === 'wallet' && (
                <div className="space-y-4">
                    <h3 className="text-xl font-black text-gray-800">الدفع عبر المحفظة</h3>
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        {settings.wallet.instructions || 'يمكنك إنشاء طلب دفع عبر المحفظة للمراجعة.'}
                        {methodProviderLabel('wallet') ? <div className="mt-2 text-xs font-black">{methodProviderLabel('wallet')}</div> : null}
                    </div>
                    {settings.wallet.providerName && (
                        <div className="p-4 border-2 border-emerald-500 bg-emerald-50 rounded-xl text-center">
                            <p className="font-bold text-emerald-700">{settings.wallet.providerName}</p>
                            {settings.wallet.phoneNumber && <p className="text-xs text-emerald-500 mt-1">{settings.wallet.phoneNumber}</p>}
                        </div>
                    )}
                    <input disabled placeholder="رقم المحفظة / الجوال — غير متاح حاليًا" className="w-full p-4 rounded-xl border border-gray-200 opacity-50" />
                </div>
            )}

            <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">إرفاق الإيصال وبيانات مرجع التحويل أو المحفظة غير متاح حاليًا. لا يتم إرسال هذه البيانات مع الطلب.</div>
            <input
                value={discountCode}
                onChange={(event) => setDiscountCode(event.target.value.toUpperCase().replace(/\s+/g, '').slice(0, 40))}
                placeholder="كود خصم (اختياري)"
                className="w-full p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
            />
            {discountCode.trim() && (
                <div className={`rounded-xl border px-4 py-3 text-sm font-bold ${
                    discountPreview?.valid
                        ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                        : 'border-amber-100 bg-amber-50 text-amber-700'
                }`}>
                    {discountPreviewLoading
                        ? 'جاري فحص كود الخصم...'
                        : discountPreview?.valid
                            ? `تم تطبيق الخصم: ${discountPreview.discountAmount} ${getCurrency()}`
                            : discountPreview?.message || 'كود الخصم سيتم فحصه قبل إرسال الطلب'}
                </div>
            )}
            {renderPaymentDecisionSummary()}
            <div className="pt-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center mb-6 bg-gray-50 p-4 rounded-xl">
                    <span className="text-gray-500 font-bold">إجمالي المبلغ:</span>
                    <span className="text-xl sm:text-2xl font-black text-indigo-600">
                        {discountPreview?.valid ? discountPreview.finalAmount : getPrice()} {getCurrency()}
                    </span>
                    {discountPreview?.valid && (
                        <span className="text-xs font-bold text-gray-500 line-through">
                            {discountPreview.originalAmount} {getCurrency()}
                        </span>
                    )}
                </div>

                <button onClick={() => void handlePayment()} disabled={loading} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-50">
                    {loading ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            جارٍ إرسال الطلب...
                        </>
                    ) : (
                        <>إنشاء طلب شراء <ShieldCheck size={20} /></>
                    )}
                </button>
                <div className="flex items-center justify-center gap-2 mt-4 text-gray-400 text-xs">
                    <Lock size={12} />
                    <span>سيظهر رقم الطلب بعد الإرسال</span>
                </div>
            </div>
        </div>
    );

    const renderSuccess = () => (
        <div className="text-center py-12 animate-scale-up">
            <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce-slow">
                <CheckCircle2 size={64} />
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-gray-900 mb-4 leading-tight">تم تسجيل الطلب بنجاح</h3>
            <p className="text-gray-500 mb-8 sm:mb-10 max-w-sm mx-auto leading-relaxed">
                {successMessage}
            </p>
            {request?.providerRedirectUrl ? <a data-testid="payment-provider-redirect" href={request.providerRedirectUrl} className="mb-4 inline-flex rounded-xl bg-indigo-600 px-4 py-3 font-black text-white">متابعة الدفع</a> : null}
            <button onClick={onClose} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-lg">
                إغلاق
            </button>
        </div>
    );

    return (
        <div data-testid="payment-modal-shell" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
            <div className={`bg-white w-full ${'max-w-xl'} max-h-[92vh] overflow-y-auto rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl relative animate-scale-up`}>
                <button onClick={onClose} className="absolute top-6 left-6 p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors z-10" aria-label="إغلاق">
                    <X size={20} />
                </button>
                <div className="p-5 sm:p-8 md:p-12">
                    {step !== 'success' && renderActionError()}
                    {step === 'intro' && renderIntro()}
                    {step === 'method' && renderMethodSelector()}
                    {step === 'details' && renderDetails()}
                    {step === 'success' && renderSuccess()}
                    {step === 'previous' && renderPrevious()}
                </div>
            </div>
        </div>
    );
};

const InfoRow = ({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) => (
    <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className={`font-bold text-gray-800 break-all ${mono ? 'font-mono text-indigo-600 text-lg' : ''}`}>{value}</p>
    </div>
);
