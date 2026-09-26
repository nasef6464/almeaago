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
export type CommerceDiscountScopeType='all'|'product'|'product_type';
export type CommercePaymentMethod='card'|'transfer'|'wallet';
export type CommerceGatewayMode='manual_review'|'webhook'|'payment_link';
export type CommercePaymentStatus='pending'|'paid'|'rejected'|'cancelled'|'failed'|'refunded'|'chargeback';

export interface CommerceDiscountScope{scopeType:CommerceDiscountScopeType;productId:string;productType:CommerceProductType|''}
export interface CommerceDiscount{
 id:string;code:string;label:string;discountType:CommerceDiscountType;percentageBps:number|null;fixedMinor:number|null;
 status:CommerceDiscountStatus;minAmountMinor:number;maxRedemptions:number;reservedCount:number;redeemedCount:number;
 startsAt:string|null;expiresAt:string|null;revision:number;scopes:CommerceDiscountScope[];createdAt:string;updatedAt:string;
}
export interface CommerceDiscountWrite{
 code:string;label:string;discountType:CommerceDiscountType;percentageBps:number|null;fixedMinor:number|null;
 status:CommerceDiscountStatus;minAmountMinor:number;maxRedemptions:number;startsAt:string|null;expiresAt:string|null;
 scopes:CommerceDiscountScope[];
}
export interface CommerceDiscountPreview{
 valid:boolean;code:string;label:string;originalAmountMinor:number;discountAmountMinor:number;finalAmountMinor:number;
 currency:string;message:string;
}
export interface CommercePaymentRequest{
 id:string;userId:string;productId:string;productRevision:number;productName:string;originalAmountMinor:number;
 discountAmountMinor:number;finalAmountMinor:number;currency:string;discountId:string;discountCode:string;
 paymentMethod:CommercePaymentMethod;gatewayMode:CommerceGatewayMode;providerCode:string;status:CommercePaymentStatus;
 idempotencyKey:string;providerTransactionId:string;providerSessionId:string;providerRedirectUrl:string;providerSessionStatus:string;paidAt:string|null;reviewedBy:string;reviewedAt:string|null;
 reviewerNotes:string;approvalEvidence:string;revision:number;createdAt:string;updatedAt:string;
}

export type CommerceAccessCodeStatus='active'|'paused'|'archived';
export interface CommerceAccessCode{id:string;code:string;productId:string;schoolId:string;status:CommerceAccessCodeStatus;maxUses:number;currentUses:number;startsAt:string;expiresAt:string;revision:number;createdAt:string;updatedAt:string}
export interface CommerceSchoolSeat{id:string;schoolEntitlementId:string;userId:string;userEntitlementId:string;status:'active'|'revoked';revision:number;revokedAt:string|null;revokeReason:string;createdAt:string;updatedAt:string}


export type CommerceRevenueAllocationStatus='not_applicable'|'policy_missing'|'pending'|'allocated';
export type CommercePayoutStatus='not_applicable'|'pending'|'paid';
export interface CommerceRevenueEntry{
 id:string;paymentRequestId:string;productId:string;productType:CommerceProductType;courseId:string;buyerUserId:string;
 trainerUserId:string;revenueSharePercentage:number|null;grossAmountMinor:number;discountAmountMinor:number;paidAmountMinor:number;
 currency:string;providerFeeMinor:number|null;trainerShareMinor:number|null;platformShareMinor:number|null;
 allocationStatus:CommerceRevenueAllocationStatus;payoutStatus:CommercePayoutStatus;allocationEvidence:string;allocatedBy:string;
 allocatedAt:string|null;payoutEvidence:string;paidBy:string;payoutPaidAt:string|null;reversalType:''|'refund'|'chargeback';reversedAmountMinor:number|null;
 reversalReference:string;reversedAt:string|null;revision:number;createdAt:string;updatedAt:string;
}
export interface CommercePaymentReversal{
 id:string;paymentRequestId:string;reversalType:'refund'|'chargeback';amountMinor:number;currency:string;providerCode:string;
 providerReference:string;source:'provider_webhook'|'admin_evidence';evidence:string;occurredAt:string|null;createdAt:string;
}
