package domain

import "context"

type EventPublisher interface {
	Publish(context.Context, StreamEvent) error
}

type EventSubscription interface {
	Events() <-chan StreamEvent
	Errors() <-chan error
	Close() error
}

type StreamCoordinator interface {
	EventPublisher
	Subscribe(context.Context, string) (EventSubscription, error)
	TouchPresence(context.Context, string, string, string) (int64, error)
	RemovePresence(context.Context, string, string, string) (int64, error)
	PresenceCount(context.Context, string) (int64, error)
}
