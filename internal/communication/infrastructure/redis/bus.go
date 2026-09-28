package redisbus

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/redis/go-redis/v9"

	communication "github.com/nasef6464/almeaago/internal/communication/domain"
)

const inboxPrefix = "almeaa:communication:inbox:"

type Bus struct {
	client *redis.Client
}

func New(client *redis.Client) *Bus {
	return &Bus{client: client}
}

func (b *Bus) Publish(ctx context.Context, event communication.InboxEvent) error {
	if b == nil || b.client == nil || strings.TrimSpace(event.UserID) == "" {
		return nil
	}
	raw, err := json.Marshal(event)
	if err != nil {
		return err
	}
	return b.client.Publish(ctx, inboxPrefix+event.UserID, raw).Err()
}

func (b *Bus) PublishBatch(ctx context.Context, events []communication.InboxEvent) error {
	if b == nil || b.client == nil || len(events) == 0 {
		return nil
	}
	pipe := b.client.Pipeline()
	for _, event := range events {
		if strings.TrimSpace(event.UserID) == "" {
			continue
		}
		raw, err := json.Marshal(event)
		if err != nil {
			return err
		}
		pipe.Publish(ctx, inboxPrefix+event.UserID, raw)
	}
	_, err := pipe.Exec(ctx)
	return err
}

type subscription struct {
	pubsub *redis.PubSub
	events chan communication.InboxEvent
	errs   chan error
	cancel context.CancelFunc
}

func (s *subscription) Events() <-chan communication.InboxEvent { return s.events }
func (s *subscription) Errors() <-chan error                    { return s.errs }

func (s *subscription) Close() error {
	s.cancel()
	return s.pubsub.Close()
}

func (b *Bus) Subscribe(ctx context.Context, userID string) (communication.InboxEventSubscription, error) {
	userID = strings.TrimSpace(userID)
	if b == nil || b.client == nil || userID == "" {
		return nil, fmt.Errorf("notification realtime unavailable")
	}
	subCtx, cancel := context.WithCancel(ctx)
	pubsub := b.client.Subscribe(subCtx, inboxPrefix+userID)
	if _, err := pubsub.Receive(subCtx); err != nil {
		cancel()
		_ = pubsub.Close()
		return nil, err
	}
	out := &subscription{
		pubsub: pubsub,
		events: make(chan communication.InboxEvent, 32),
		errs:   make(chan error, 1),
		cancel: cancel,
	}
	go func() {
		defer close(out.events)
		defer close(out.errs)
		channel := pubsub.Channel()
		for {
			select {
			case <-subCtx.Done():
				return
			case message, ok := <-channel:
				if !ok {
					return
				}
				var event communication.InboxEvent
				if err := json.Unmarshal([]byte(message.Payload), &event); err != nil {
					select {
					case out.errs <- err:
					default:
					}
					continue
				}
				if event.UserID != userID {
					continue
				}
				select {
				case out.events <- event:
				case <-subCtx.Done():
					return
				}
			}
		}
	}()
	return out, nil
}
