package domain

import "time"

type Channel string

const (
	ChannelInApp    Channel = "in_app"
	ChannelEmail    Channel = "email"
	ChannelWhatsApp Channel = "whatsapp"
)

func ValidChannel(channel Channel) bool {
	return channel == ChannelInApp || channel == ChannelEmail || channel == ChannelWhatsApp
}

type DeliveryStatus string

const (
	DeliveryPending  DeliveryStatus = "pending"
	DeliverySent     DeliveryStatus = "sent"
	DeliveryRetrying DeliveryStatus = "retrying"
	DeliveryFailed   DeliveryStatus = "failed"
)

func ValidDeliveryStatus(status DeliveryStatus) bool {
	return status == DeliveryPending || status == DeliverySent || status == DeliveryRetrying || status == DeliveryFailed
}

type Template struct {
	ID        string    `json:"id"`
	Key       string    `json:"key"`
	Name      string    `json:"name"`
	Channel   Channel   `json:"channel"`
	Subject   string    `json:"subject"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	Variables []string  `json:"variables"`
	IsActive  bool      `json:"isActive"`
	Revision  int       `json:"revision"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type TemplateWrite struct {
	Key              string   `json:"key"`
	Name             string   `json:"name"`
	Channel          Channel  `json:"channel"`
	Subject          string   `json:"subject"`
	Title            string   `json:"title"`
	Body             string   `json:"body"`
	Variables        []string `json:"variables"`
	IsActive         bool     `json:"isActive"`
	ExpectedRevision int      `json:"expectedRevision"`
}

type TemplatePage struct {
	Items   []Template `json:"items"`
	Page    int        `json:"page"`
	Limit   int        `json:"limit"`
	HasMore bool       `json:"hasMore"`
}

type CampaignWrite struct {
	TemplateKey string         `json:"templateKey"`
	Title       string         `json:"title"`
	Subject     string         `json:"subject"`
	Body        string         `json:"body"`
	Channels    []Channel      `json:"channels"`
	UserIDs     []string       `json:"userIds"`
	Roles       []string       `json:"roles"`
	Variables   map[string]any `json:"variables"`
}

type CampaignResult struct {
	CampaignID string `json:"campaignId"`
	Recipients int    `json:"recipients"`
	Created    int    `json:"created"`
	Pending    int    `json:"pending"`
	Sent       int    `json:"sent"`
	Reused     bool   `json:"reused,omitempty"`
}

type Delivery struct {
	ID                string         `json:"id"`
	CampaignID        string         `json:"campaignId"`
	TemplateKey       string         `json:"templateKey"`
	Channel           Channel        `json:"channel"`
	Status            DeliveryStatus `json:"status"`
	Title             string         `json:"title"`
	Subject           string         `json:"subject"`
	Body              string         `json:"body"`
	RecipientUserID   string         `json:"recipientUserId"`
	RecipientEmail    string         `json:"recipientEmail,omitempty"`
	RecipientPhone    string         `json:"recipientPhone,omitempty"`
	Provider          string         `json:"provider"`
	ProviderMessageID string         `json:"providerMessageId"`
	FailureReason     string         `json:"failureReason"`
	RetryCount        int            `json:"retryCount"`
	NextAttemptAt     *time.Time     `json:"nextAttemptAt"`
	SentAt            *time.Time     `json:"sentAt"`
	ReadAt            *time.Time     `json:"readAt"`
	CreatedAt         time.Time      `json:"createdAt"`
	UpdatedAt         time.Time      `json:"updatedAt"`
}

type DeliveryPage struct {
	Items   []Delivery `json:"items"`
	Page    int        `json:"page"`
	Limit   int        `json:"limit"`
	HasMore bool       `json:"hasMore"`
}

type DeliveryFilter struct {
	Status  DeliveryStatus
	Channel Channel
	Page    int
	Limit   int
}

type CampaignMessage struct {
	TemplateID  string
	TemplateKey string
	Title       string
	Subject     string
	Body        string
	Channels    []Channel
}

type CampaignRecipient struct {
	UserID string
	Email  string
	Phone  string
	Name   string
}

type CampaignCommand struct {
	ActorUserID    string
	IdempotencyKey string
	Message        CampaignMessage
	Recipients     []CampaignRecipient
}

type DeliveryAttemptResult struct {
	Provider          string
	ProviderMessageID string
	FailureReason     string
}
