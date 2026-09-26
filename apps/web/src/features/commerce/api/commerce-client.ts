import type {
  CommerceAccessCode,
  CommerceAccessCodeStatus,
  CommerceAccessDecision,
  CommerceDiscount,
  CommerceDiscountPreview,
  CommerceDiscountStatus,
  CommerceDiscountWrite,
  CommerceEntitlement,
  CommercePage,
  CommercePaymentMethod,
  CommercePaymentRequest,
  CommercePaymentStatus,
  CommerceRevenueEntry,
  CommerceRevenueAllocationStatus,
  CommercePayoutStatus,
  CommerceProduct,
  CommerceProductType,
  CommerceProductWrite,
  CommerceSchoolSeat,
} from './commerce-types';
const BASE=(import.meta.env.VITE_API_BASE_URL??'').replace(/\/$/,'');
async function req<T>(path:string,init:RequestInit={}):Promise<T>{
 const r=await fetch(BASE+path,{...init,credentials:'include',headers:{Accept:'application/json',...init.headers}});
 if(!r.ok){const body=await r.json().catch(()=>({message:'تعذر تنفيذ الطلب'}));throw new Error(body.message||'تعذر تنفيذ الطلب')}
 return r.json() as Promise<T>;
}
export const commerceClient={
 products:(page=1,limit=50,productType:CommerceProductType|''='',search='',signal?:AbortSignal)=>{
   const p=new URLSearchParams({page:String(page),limit:String(limit)});if(productType)p.set('productType',productType);if(search)p.set('search',search);
   return req<CommercePage<CommerceProduct>>(`/api/v1/commerce/products?${p}`,{signal});
 },
 product:(id:string,signal?:AbortSignal)=>req<{product:CommerceProduct}>(`/api/v1/commerce/products/${encodeURIComponent(id)}`,{signal}),
 createProduct:(product:CommerceProductWrite,csrf:string)=>req<{product:CommerceProduct}>('/api/v1/commerce/products',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(product)}),
 updateProduct:(row:CommerceProduct,product:CommerceProductWrite,csrf:string)=>req<{product:CommerceProduct}>(`/api/v1/commerce/products/${encodeURIComponent(row.id)}`,{method:'PUT',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({expectedRevision:row.revision,product})}),
 entitlements:(page=1,limit=50,signal?:AbortSignal)=>req<CommercePage<CommerceEntitlement>>(`/api/v1/commerce/entitlements?page=${page}&limit=${limit}`,{signal}),
 grant:(input:{subjectType:'user'|'school';userId:string;schoolId:string;productId:string;expiresAt:string|null;idempotencyKey:string},csrf:string)=>req<{entitlement:CommerceEntitlement}>('/api/v1/commerce/entitlements',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(input)}),
 revoke:(row:CommerceEntitlement,reason:string,csrf:string)=>req<{entitlement:CommerceEntitlement}>(`/api/v1/commerce/entitlements/${encodeURIComponent(row.id)}/revoke`,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({expectedRevision:row.revision,reason})}),
 courseAccess:(courseId:string,signal?:AbortSignal)=>req<{access:CommerceAccessDecision}>(`/api/v1/commerce/access/courses/${encodeURIComponent(courseId)}`,{signal}),
 catalogProduct:(id:string,signal?:AbortSignal)=>req<{product:CommerceProduct}>(`/api/v1/commerce/catalog/products/${encodeURIComponent(id)}`,{signal}),
 previewDiscount:(productId:string,code:string)=>req<{preview:CommerceDiscountPreview}>('/api/v1/commerce/discounts/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId,code})}),
 createCheckout:(input:{productId:string;discountCode:string;paymentMethod:CommercePaymentMethod;idempotencyKey:string},csrf:string)=>req<{request:CommercePaymentRequest}>('/api/v1/commerce/checkout/requests',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(input)}),
 myPaymentRequests:(page=1,limit=20,signal?:AbortSignal)=>req<CommercePage<CommercePaymentRequest>>(`/api/v1/commerce/checkout/requests?page=${page}&limit=${limit}`,{signal}),
 discounts:(page=1,limit=50,status:CommerceDiscountStatus|''='',search='',signal?:AbortSignal)=>{const p=new URLSearchParams({page:String(page),limit:String(limit)});if(status)p.set('status',status);if(search)p.set('search',search);return req<CommercePage<CommerceDiscount>>(`/api/v1/commerce/admin/discounts?${p}`,{signal})},
 createDiscount:(discount:CommerceDiscountWrite,csrf:string)=>req<{discount:CommerceDiscount}>('/api/v1/commerce/admin/discounts',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(discount)}),
 updateDiscount:(row:CommerceDiscount,discount:CommerceDiscountWrite,csrf:string)=>req<{discount:CommerceDiscount}>(`/api/v1/commerce/admin/discounts/${encodeURIComponent(row.id)}`,{method:'PUT',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({expectedRevision:row.revision,discount})}),
 paymentRequests:(page=1,limit=50,status:CommercePaymentStatus|''='',signal?:AbortSignal)=>{const p=new URLSearchParams({page:String(page),limit:String(limit)});if(status)p.set('status',status);return req<CommercePage<CommercePaymentRequest>>(`/api/v1/commerce/admin/payment-requests?${p}`,{signal})},
 revenueEntries:(page=1,limit=50,allocationStatus:CommerceRevenueAllocationStatus|''='',payoutStatus:CommercePayoutStatus|''='',signal?:AbortSignal)=>{const p=new URLSearchParams({page:String(page),limit:String(limit)});if(allocationStatus)p.set('allocationStatus',allocationStatus);if(payoutStatus)p.set('payoutStatus',payoutStatus);return req<CommercePage<CommerceRevenueEntry>>(`/api/v1/commerce/admin/revenue?${p}`,{signal})},
 allocateRevenue:(row:CommerceRevenueEntry,input:{providerFeeMinor:number;trainerShareMinor:number;platformShareMinor:number;evidence:string},csrf:string)=>req<{entry:CommerceRevenueEntry}>(`/api/v1/commerce/admin/revenue/${encodeURIComponent(row.id)}/allocation`,{method:'PATCH',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({expectedRevision:row.revision,...input})}),
 markPayoutPaid:(row:CommerceRevenueEntry,evidence:string,csrf:string)=>req<{entry:CommerceRevenueEntry}>(`/api/v1/commerce/admin/revenue/${encodeURIComponent(row.id)}/payout`,{method:'PATCH',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({expectedRevision:row.revision,evidence})}),
 reviewPayment:(row:CommercePaymentRequest,status:'paid'|'rejected'|'cancelled',reviewerNotes:string,approvalEvidence:string,csrf:string)=>req<{request:CommercePaymentRequest}>(`/api/v1/commerce/admin/payment-requests/${encodeURIComponent(row.id)}/review`,{method:'PATCH',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({expectedRevision:row.revision,status,reviewerNotes,approvalEvidence})}),
 accessCodes:(page=1,limit=50,signal?:AbortSignal)=>req<CommercePage<CommerceAccessCode>>(`/api/v1/commerce/admin/access-codes?page=${page}&limit=${limit}`,{signal}),
 createAccessCode:(input:{code:string;productId:string;schoolId:string;maxUses:number;expiresAt:string},csrf:string)=>req<{accessCode:CommerceAccessCode}>('/api/v1/commerce/admin/access-codes',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(input)}),
 setAccessCodeStatus:(row:CommerceAccessCode,status:CommerceAccessCodeStatus,csrf:string)=>req<{accessCode:CommerceAccessCode}>(`/api/v1/commerce/admin/access-codes/${encodeURIComponent(row.id)}/status`,{method:'PATCH',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({expectedRevision:row.revision,status})}),
 redeemAccessCode:(code:string,csrf:string)=>req<{accessCode:CommerceAccessCode;entitlement:CommerceEntitlement}>('/api/v1/commerce/access-codes/redeem',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({code})}),
 schoolSeats:(schoolEntitlementId:string,page=1,limit=50,signal?:AbortSignal)=>req<CommercePage<CommerceSchoolSeat>>(`/api/v1/commerce/admin/school-entitlements/${encodeURIComponent(schoolEntitlementId)}/seats?page=${page}&limit=${limit}`,{signal}),
 assignSchoolSeat:(schoolEntitlementId:string,userId:string,csrf:string)=>req<{seat:CommerceSchoolSeat}>(`/api/v1/commerce/admin/school-entitlements/${encodeURIComponent(schoolEntitlementId)}/seats`,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({userId})}),
 revokeSchoolSeat:(row:CommerceSchoolSeat,reason:string,csrf:string)=>req<{seat:CommerceSchoolSeat}>(`/api/v1/commerce/admin/school-seats/${encodeURIComponent(row.id)}/revoke`,{method:'PATCH',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({expectedRevision:row.revision,reason})}),
};
