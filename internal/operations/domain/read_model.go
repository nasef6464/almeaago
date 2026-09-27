package domain

import "time"

type AuditStatus string

const (
	AuditSuccess AuditStatus = "success"
	AuditBlocked AuditStatus = "blocked"
	AuditFailed  AuditStatus = "failed"
)

func ValidAuditStatus(status AuditStatus) bool {
	return status == AuditSuccess || status == AuditBlocked || status == AuditFailed
}

type AuditQuery struct {
	Action       string
	Status       AuditStatus
	ResourceType string
	ActorUserID  string
	Page         int
	Limit        int
}

type AuditRecord struct {
	ID           string         `json:"id"`
	ActorUserID  string         `json:"actorUserId"`
	ActorName    string         `json:"actorName"`
	Action       string         `json:"action"`
	ResourceType string         `json:"resourceType"`
	ResourceID   string         `json:"resourceId"`
	Status       AuditStatus    `json:"status"`
	Metadata     map[string]any `json:"metadata"`
	CreatedAt    time.Time      `json:"createdAt"`
}

type AuditPage struct {
	Items            []AuditRecord `json:"items"`
	Page             int           `json:"page"`
	Limit            int           `json:"limit"`
	Total            int           `json:"total"`
	HasMore          bool          `json:"hasMore"`
	BlockedCount24h  int           `json:"blockedCount24h"`
	FailedCount24h   int           `json:"failedCount24h"`
}

type DependencyHealth struct {
	Postgres bool `json:"postgres"`
	Redis    bool `json:"redis"`
}

type IntegrationCheck struct {
	ID         string `json:"id"`
	Configured bool   `json:"configured"`
	Required   bool   `json:"required"`
	Detail     string `json:"detail"`
}

type OperationalCounts struct {
	NotificationPending  int `json:"notificationPending"`
	NotificationRetrying int `json:"notificationRetrying"`
	NotificationFailed   int `json:"notificationFailed"`
	AuditBlocked24h      int `json:"auditBlocked24h"`
	AuditFailed24h       int `json:"auditFailed24h"`
	LiveClassrooms       int `json:"liveClassrooms"`
	EnabledAIProviders   int `json:"enabledAiProviders"`
}

type Readiness struct {
	CheckedAt            time.Time          `json:"checkedAt"`
	Status               string             `json:"status"`
	Dependencies         DependencyHealth   `json:"dependencies"`
	Integrations         []IntegrationCheck `json:"integrations"`
	Counts               OperationalCounts  `json:"counts"`
	BackupRestoreProof   string             `json:"backupRestoreProof"`
	BackupRestoreDetail  string             `json:"backupRestoreDetail"`
}
