import type {
 CommerceAccessDecision,CommerceCheckoutQuote,CommerceDiscountCode,CommerceDiscountStatus,CommerceDiscountWrite,
 CommerceEntitlement,CommercePage,CommercePaymentMethod,CommercePaymentRequest,CommercePaymentStatus,
 CommerceProduct,CommerceProductType,CommerceProductWrite
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
 quote:(productId:string,discountCode='',signal?:AbortSignal)=>{
   const p=new URLSearchParams({productId});if(discountCode)p.set('discountCode',discountCode);
   return req<{quote:CommerceCheckoutQuote}>(`/api/v1/commerce/checkout/quote?${p.toString()}`,{signal});
 },
 createPaymentRequest:(input:{productId:string;discountCode:string;paymentMethod:CommercePaymentMethod;paymentCountry:string;transferReference:string;walletNumber:string;notes:string;idempotencyKey:string},csrf:string)=>
   req<{request:CommercePaymentRequest}>('/api/v1/commerce/payment-requests',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(input)}),
 myPaymentRequests:(page=1,limit=20,signal?:AbortSignal)=>req<CommercePage<CommercePaymentRequest>>(`/api/v1/commerce/payment-requests/mine?page=${page}&limit=${limit}`,{signal}),
 paymentRequests:(page=1,limit=50,status:CommercePaymentStatus|''='',signal?:AbortSignal)=>{
   const p=new URLSearchParams({page:String(page),limit:String(limit)});if(status)p.set('status',status);
   return req<CommercePage<CommercePaymentRequest>>(`/api/v1/commerce/payment-requests?${p.toString()}`,{signal});
 },
 reviewPaymentRequest:(row:CommercePaymentRequest,status:'approved'|'rejected'|'cancelled',reviewerNotes:string,approvalEvidence:string,csrf:string)=>
   req<{request:CommercePaymentRequest}>(`/api/v1/commerce/payment-requests/${encodeURIComponent(row.id)}/review`,{method:'PATCH',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({expectedRevision:row.revision,status,reviewerNotes,approvalEvidence})}),
 discounts:(page=1,limit=50,status:CommerceDiscountStatus|''='',search='',signal?:AbortSignal)=>{
   const p=new URLSearchParams({page:String(page),limit:String(limit)});if(status)p.set('status',status);if(search)p.set('search',search);
   return req<CommercePage<CommerceDiscountCode>>(`/api/v1/commerce/discount-codes?${p.toString()}`,{signal});
 },
 createDiscount:(discount:CommerceDiscountWrite,csrf:string)=>req<{discount:CommerceDiscountCode}>('/api/v1/commerce/discount-codes',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(discount)}),
 updateDiscount:(row:CommerceDiscountCode,discount:CommerceDiscountWrite,csrf:string)=>req<{discount:CommerceDiscountCode}>(`/api/v1/commerce/discount-codes/${encodeURIComponent(row.id)}`,{method:'PUT',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({expectedRevision:row.revision,discount})}),
};
