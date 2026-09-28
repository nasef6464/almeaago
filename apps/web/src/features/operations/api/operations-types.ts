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
