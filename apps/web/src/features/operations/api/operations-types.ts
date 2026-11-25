export type AuditStatus='success'|'blocked'|'failed';

export interface AuditRecord{
 id:string;actorUserId:string;actorName:string;action:string;resourceType:string;resourceId:string;
 status:AuditStatus;metadata:Record<string,unknown>;createdAt:string;
}
export interface AuditPage{
 items:AuditRecord[];page:number;limit:number;total:number;hasMore:boolean;blockedCount24h:number;failedCount24h:number;
}
export interface OperationsReadiness{
 checkedAt:string;status:'ready'|'ready_with_notes'|'blocked';
 dependencies:{postgres:boolean;redis:boolean};
 integrations:Array<{id:string;configured:boolean;required:boolean;detail:string}>;
 counts:{notificationPending:number;notificationRetrying:number;notificationFailed:number;auditBlocked24h:number;auditFailed24h:number;liveClassrooms:number;enabledAiProviders:number};
 releaseIdentity:{environment:string;commitSha:string;deploymentProvider:string;proof:string;detail:string};
 releaseEvidence:Array<{id:string;status:string;detail:string}>;
 releaseDecision:string;
 backupRestoreProof:string;backupRestoreDetail:string;
}
export interface AuditQuery{action?:string;status?:AuditStatus|'';resourceType?:string;actorUserId?:string;page?:number;limit?:number}

export interface PlatformAuthSettings {
 allowSelfRegistration: boolean;
 allowEmailPassword: boolean;
 requireEmailVerification: boolean;
 requireAdminApproval: boolean;
 defaultRole: 'student' | 'parent' | string;
 registrationTitle: string;
 registrationSubtitle: string;
 termsLink: string;
 privacyLink: string;
 maxAccountsPerDevice: number;
}

export interface PlatformProviderSetting {
 enabled: boolean;
 mode: string;
 note: string;
}

export interface PlatformSEOSettings {
 siteName: string;
 defaultTitle: string;
 defaultDescription: string;
 canonicalBaseUrl: string;
 googleAnalyticsId: string;
 googleTagManagerId: string;
 robotsIndexing: boolean;
}

export interface PlatformContactWidgetSettings {
 enabled: boolean;
 channel: 'whatsapp' | 'telegram' | 'phone' | string;
 whatsappNumber: string;
 whatsappMessage: string;
 openInNewTab: boolean;
 showOnPublicPages: boolean;
 showOnDashboardPages: boolean;
}

export interface PlatformIntegrationSettings {
 auth: PlatformAuthSettings;
 providers: Record<string, PlatformProviderSetting>;
 seo: PlatformSEOSettings;
 contactWidget: PlatformContactWidgetSettings;
}

export interface IntegrationRuntimeStatus {
 configured: boolean;
 detail: string;
}

export interface PlatformIntegrationState {
 settings: PlatformIntegrationSettings;
 revision: number;
 updatedAt: string;
 runtimeStatus?: Record<string, IntegrationRuntimeStatus>;
}

export interface PlatformIntegrationPatch {
 auth?: PlatformAuthSettings;
 providers?: Record<string, PlatformProviderSetting>;
 seo?: PlatformSEOSettings;
 contactWidget?: PlatformContactWidgetSettings;
 expectedRevision?: number;
}

export interface BackupExportRecord {
 id: string;
 title: string;
 scope: string;
 schemaVersion: number;
 summary: Record<string, number>;
 totalRecords: number;
 createdBy: string;
 createdByEmail: string;
 createdAt: string;
}

export interface BackupExportPayload {
 kind: 'almeaa-platform-backup';
 schemaVersion: 1;
 createdAt: string;
 summary: Record<string, number>;
 collections: Record<string, unknown[]>;
}

export interface BackupExportResult {
 exportRecord: BackupExportRecord;
 payload: BackupExportPayload;
}

export interface BackupValidateResult {
 valid: boolean;
 collectionsCount: number;
 totalRecords: number;
 summary: Record<string, number>;
}
