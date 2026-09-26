export type CommerceProductType='course'|'package'|'membership';
export type CommerceProductStatus='active'|'inactive'|'archived';
export type CommerceAccessMode='free'|'paid';
export type CommerceSubjectType='user'|'school';
export type CommercePackageScope='course'|'path'|'subject'|'content_type'|'all';
export type CommerceContentType='courses'|'foundation'|'banks'|'tests'|'mock_exams'|'library'|'all';

export interface CommercePackageItem{scopeType:CommercePackageScope;courseId:string;pathId:string;subjectId:string;contentType:CommerceContentType|''}
export interface CommercePackage{ id:string;productId:string;packageKind:'bundle'|'membership'|'school';seatCapacity:number|null;validityDays:number|null;items?:CommercePackageItem[] }
export interface CommerceProduct{
 id:string;code:string;productType:CommerceProductType;name:string;description:string;status:CommerceProductStatus;
 accessMode:CommerceAccessMode;priceMinor:number;currency:string;courseId:string;isVisible:boolean;revision:number;
 package?:CommercePackage;createdAt:string;updatedAt:string;
}
export interface CommerceProductWrite{
 code:string;productType:CommerceProductType;name:string;description:string;status:CommerceProductStatus;
 accessMode:CommerceAccessMode;priceMinor:number;currency:string;courseId:string;isVisible:boolean;
 package?:{packageKind:'bundle'|'membership'|'school';seatCapacity:number|null;validityDays:number|null;items:CommercePackageItem[]};
}
export interface CommerceEntitlement{
 id:string;subjectType:CommerceSubjectType;userId:string;schoolId:string;productId:string;sourceType:string;sourceId:string;
 status:'active'|'revoked'|'expired';grantedByUserId:string;startsAt:string;expiresAt:string|null;revokedAt:string|null;
 revokeReason:string;idempotencyKey:string;revision:number;createdAt:string;updatedAt:string;
}
export interface CommerceAccessDecision{allowed:boolean;configured:boolean;reason:string;productId:string;entitlementId:string;entitlementSource:string}
export interface CommercePage<T>{items:T[];page:number;limit:number;hasMore:boolean}

export type CommerceDiscountType='percentage'|'fixed';
export type CommerceDiscountStatus='active'|'paused'|'expired';
export type CommercePaymentMethod='card'|'transfer'|'wallet';
export type CommercePaymentStatus='pending'|'approved'|'rejected'|'cancelled';
export type CommerceGatewayMode='manual_review'|'payment_link'|'webhook';

export interface CommerceDiscountCode{
 id:string;code:string;label:string;type:CommerceDiscountType;value:number;currency:string;status:CommerceDiscountStatus;
 productId:string;productType:CommerceProductType|'';minAmountMinor:number;maxRedemptions:number;currentRedemptions:number;
 startsAt:string|null;expiresAt:string|null;revision:number;createdAt:string;updatedAt:string;
}
export interface CommerceDiscountWrite{
 code:string;label:string;type:CommerceDiscountType;value:number;currency:string;status:CommerceDiscountStatus;
 productId:string;productType:CommerceProductType|'';minAmountMinor:number;maxRedemptions:number;startsAt:string|null;expiresAt:string|null;
}
export interface CommerceCheckoutQuote{
 productId:string;productName:string;productType:CommerceProductType;courseId:string;productRevision:number;
 originalAmountMinor:number;discountCode:string;discountAmountMinor:number;finalAmountMinor:number;currency:string;
}
export interface CommercePaymentRequest{
 id:string;userId:string;productId:string;productRevision:number;productName:string;productType:CommerceProductType;
 originalAmountMinor:number;discountAmountMinor:number;finalAmountMinor:number;currency:string;discountCodeId:string;discountCode:string;
 paymentMethod:CommercePaymentMethod;providerCode:string;gatewayMode:CommerceGatewayMode;paymentCountry:string;
 transferReference:string;walletNumber:string;notes:string;status:CommercePaymentStatus;reviewerNotes:string;approvalEvidence:string;
 reviewedBy:string;reviewedAt:string|null;providerTransactionId:string;providerEventId:string;paidAt:string|null;
 idempotencyKey:string;revision:number;createdAt:string;updatedAt:string;
}
