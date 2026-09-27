package redisbroker

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"

	realtime "github.com/nasef6464/almeaago/internal/realtime/domain"
)

const presenceTTL = 45 * time.Second

type Subscription struct {
	Events <-chan []byte
	close  func()
}

func (s *Subscription) Close() {
	if s != nil && s.close != nil {
		s.close()
	}
}

type Broker struct {
	client *redis.Client
}

func New(client *redis.Client) *Broker {
	return &Broker{client: client}
}

func channel(sessionID string) string {
	return "almeaa:classroom:" + sessionID + ":events"
}

func presenceKey(sessionID, userID string) string {
	return "almeaa:classroom:" + sessionID + ":presence:" + userID
}

func (b *Broker) Publish(ctx context.Context, event realtime.StreamEvent) error {
	if b == nil || b.client == nil || strings.TrimSpace(event.SessionID) == "" {
		return fmt.Errorf("realtime redis broker unavailable")
	}
	raw, err := json.Marshal(event)
	if err != nil {
		return err
	}
	return b.client.Publish(ctx, channel(event.SessionID), raw).Err()
}

func (b *Broker) Subscribe(ctx context.Context, sessionID string) (*Subscription, error) {
	if b == nil || b.client == nil || strings.TrimSpace(sessionID) == "" {
		return nil, fmt.Errorf("realtime redis broker unavailable")
	}
	pubsub := b.client.Subscribe(ctx, channel(sessionID))
	if _, err := pubsub.Receive(ctx); err != nil {
		_ = pubsub.Close()
		return nil, err
	}
	out := make(chan []byte, 32)
	subCtx, cancel := context.WithCancel(ctx)
	go func() {
		defer close(out)
		ch := pubsub.Channel()
		for {
			select {
			case <-subCtx.Done():
				return
			case message, ok := <-ch:
				if !ok {
					return
				}
				raw := []byte(message.Payload)
				select {
				case out <- raw:
				case <-subCtx.Done():
					return
				}
			}
		}
	}()
	return &Subscription{
		Events: out,
		close: func() {
			cancel()
			_ = pubsub.Close()
		},
	}, nil
}

func (b *Broker) TouchPresence(
	ctx context.Context,
	sessionID, userID, role string,
) error {
	if b == nil || b.client == nil {
		return fmt.Errorf("realtime redis broker unavailable")
	}
	return b.client.Set(ctx, presenceKey(sessionID, userID), role, presenceTTL).Err()
}

func (b *Broker) DropPresence(ctx context.Context, sessionID, userID string) error {
	if b == nil || b.client == nil {
		return nil
	}
	return b.client.Del(ctx, presenceKey(sessionID, userID)).Err()
}

func PresenceRefreshInterval() time.Duration {
	return 20 * time.Second
}
