package domain

import (
	"context"
	"time"
)

type InboxEvent struct {
	Type       string    `json:"type"`
	UserID     string    `json:"userId"`
	CampaignID string    `json:"campaignId,omitempty"`
	At         time.Time `json:"at"`
}

type InboxEventPublisher interface {
	Publish(context.Context, InboxEvent) error
}

type InboxEventBatchPublisher interface {
	PublishBatch(context.Context, []InboxEvent) error
}

type InboxEventSubscription interface {
	Events() <-chan InboxEvent
	Errors() <-chan error
	Close() error
}

type InboxRealtime interface {
	InboxEventPublisher
	Subscribe(context.Context, string) (InboxEventSubscription, error)
}
