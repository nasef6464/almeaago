export type AiProvider='gemini'|'openrouter'|'qwen'|'deepseek'|'openai'|'ollama'|'lmstudio';
export type AiHelpLevel='hint'|'stronger_hint'|'concept'|'steps'|'follow_up';
export type AiInteractionStatus='success'|'fallback'|'error';

export interface AiProviderHealth{
 consecutiveFailures:number;
 openUntil:string|null;
 lastError:string;
 lastSuccessAt:string|null;
 lastFailureAt:string|null;
 updatedAt:string;
}

export interface AiProviderSetting{
 provider:AiProvider;
 enabled:boolean;
 model:string;
 baseUrl:string;
 priority:number;
 maxOutputTokens:number;
 revision:number;
 secretConfigured:boolean;
 health:AiProviderHealth;
 createdAt:string;
 updatedAt:string;
}

export interface AiProviderWrite{
 enabled:boolean;
 model:string;
 baseUrl:string;
 priority:number;
 maxOutputTokens:number;
 expectedRevision:number;
}

export interface AiUsage{
 inputTokens:number;
 outputTokens:number;
 totalTokens:number;
 cachedTokens:number;
 estimated:boolean;
}

export interface AiProviderTestResult{
 text:string;
 provider:AiProvider;
 model:string;
 usage:AiUsage;
}

export interface AiQuestionAssistResult{
 text:string;
 helpLevel:AiHelpLevel;
 provider:AiProvider|'none';
 model:string;
 usedFallback:boolean;
 cacheHit:boolean;
 promptVersion:string;
}

export interface AiInteraction{
 id:string;
 userId:string;
 audience:string;
 endpoint:string;
 capability:string;
 provider:AiProvider|'none';
 model:string;
 status:AiInteractionStatus;
 usedFallback:boolean;
 cacheHit:boolean;
 questionId:string;
 questionVersion:number;
 reviewCardId:string;
 promptVersion:string;
 latencyMs:number;
 inputTokens:number;
 outputTokens:number;
 totalTokens:number;
 usageEstimated:boolean;
 responseLength:number;
 errorCategory:string;
 metadata:Record<string,unknown>;
 retentionUntil:string|null;
 createdAt:string;
}

export interface AiInteractionPage{
 items:AiInteraction[];
 page:number;
 limit:number;
 hasMore:boolean;
}


export interface AiDailyUsage{
 dayKey:string;scopeType:string;scopeId:string;requestCount:number;
 inputTokens:number;outputTokens:number;totalTokens:number;cachedTokens:number;
 fallbackCount:number;errorCount:number;updatedAt:string;
}

export interface AiProviderUsageSummary{
 provider:AiProvider|'none';requests:number;totalTokens:number;fallbacks:number;errors:number;avgLatencyMs:number;
}

export interface AiUsageSummary{
 today:AiDailyUsage;last24h:number;fallback24h:number;error24h:number;cacheHit24h:number;
 inputTokens24h:number;outputTokens24h:number;totalTokens24h:number;cachedTokens24h:number;
 byProvider:AiProviderUsageSummary[];
}

export interface AiAdminReadiness{
 checkedAt:string;status:'ready'|'degraded'|'fallback_only'|string;
 enabledProviders:number;configuredProviders:number;openCircuits:AiProvider[];
 todayRequests:number;globalDailyLimit:number;userDailyLimit:number;
 fallback24h:number;error24h:number;notes:string[];
}

export interface AiAdminCopilotResult{
 text:string;provider:AiProvider|'none';model:string;usedFallback:boolean;promptVersion:string;readiness:AiAdminReadiness;
}
