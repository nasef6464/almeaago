export type NotificationChannel='in_app'|'email'|'whatsapp';
export type NotificationStatus='pending'|'sent'|'retrying'|'failed';

export interface NotificationTemplate{
 id:string;key:string;name:string;channel:NotificationChannel;subject:string;title:string;body:string;
 variables:string[];isActive:boolean;revision:number;createdAt:string;updatedAt:string;
}
export interface NotificationTemplateWrite{
 key:string;name:string;channel:NotificationChannel;subject:string;title:string;body:string;
 variables:string[];isActive:boolean;expectedRevision:number;
}
export interface NotificationDelivery{
 id:string;campaignId:string;templateKey:string;channel:NotificationChannel;status:NotificationStatus;
 title:string;subject:string;body:string;recipientUserId:string;recipientEmail?:string;recipientPhone?:string;
 provider:string;providerMessageId:string;failureReason:string;retryCount:number;
 nextAttemptAt:string|null;sentAt:string|null;readAt:string|null;createdAt:string;updatedAt:string;
}
export interface NotificationPage<T>{items:T[];page:number;limit:number;hasMore:boolean}
export interface NotificationCampaignWrite{
 templateKey:string;title:string;subject:string;body:string;channels:NotificationChannel[];
 userIds:string[];roles:string[];variables:Record<string,string|number|boolean|null>;
}
export interface NotificationCampaignResult{
 campaign:{campaignId:string;recipients:number;created:number;pending:number;sent:number};
 maxRecipients:number;
}
