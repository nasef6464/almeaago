package domain

type AuditEvent struct {
	ActorUserID  string
	Action       string
	ResourceType string
	ResourceID   string
	Status       string
	Metadata     map[string]any
}
