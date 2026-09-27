package redisbus

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"

	realtime "github.com/nasef6464/almeaago/internal/realtime/domain"
)

const (
	eventPrefix    = "almeaa:realtime:classroom:event:"
	presencePrefix = "almeaa:realtime:classroom:presence:"
	presenceTTL    = 45 * time.Second
)

type Bus struct {
	client *redis.Client
}

func New(client *redis.Client) *Bus {
	return &Bus{client: client}
}

func (b *Bus) Publish(ctx context.Context, event realtime.StreamEvent) error {
	if b == nil || b.client == nil || strings.TrimSpace(event.SessionID) == "" {
		return nil
	}
	raw, err := json.Marshal(event)
	if err != nil {
		return err
	}
	return b.client.Publish(ctx, eventPrefix+event.SessionID, raw).Err()
}

type subscription struct {
	pubsub *redis.PubSub
	events chan realtime.StreamEvent
	errs   chan error
	cancel context.CancelFunc
}

func (s *subscription) Events() <-chan realtime.StreamEvent { return s.events }
func (s *subscription) Errors() <-chan error                { return s.errs }

func (s *subscription) Close() error {
	s.cancel()
	return s.pubsub.Close()
}

func (b *Bus) Subscribe(ctx context.Context, sessionID string) (realtime.EventSubscription, error) {
	if b == nil || b.client == nil {
		return nil, fmt.Errorf("realtime redis bus unavailable")
	}
	subCtx, cancel := context.WithCancel(ctx)
	pubsub := b.client.Subscribe(subCtx, eventPrefix+sessionID)
	if _, err := pubsub.Receive(subCtx); err != nil {
		cancel()
		_ = pubsub.Close()
		return nil, err
	}
	out := &subscription{
		pubsub: pubsub,
		events: make(chan realtime.StreamEvent, 32),
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
				var event realtime.StreamEvent
				if err := json.Unmarshal([]byte(message.Payload), &event); err != nil {
					select {
					case out.errs <- err:
					default:
					}
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

func (b *Bus) TouchPresence(
	ctx context.Context,
	sessionID, userID, role string,
) (int64, error) {
	if b == nil || b.client == nil {
		return 0, fmt.Errorf("realtime redis bus unavailable")
	}
	now := time.Now().UTC()
	key := presencePrefix + sessionID
	member := role + ":" + userID
	expiresAt := now.Add(presenceTTL).UnixMilli()
	pipe := b.client.TxPipeline()
	pipe.ZRemRangeByScore(ctx, key, "-inf", strconv.FormatInt(now.UnixMilli(), 10))
	pipe.ZAdd(ctx, key, redis.Z{Score: float64(expiresAt), Member: member})
	pipe.Expire(ctx, key, 2*presenceTTL)
	countCmd := pipe.ZCard(ctx, key)
	if _, err := pipe.Exec(ctx); err != nil {
		return 0, err
	}
	return countCmd.Val(), nil
}

func (b *Bus) RemovePresence(
	ctx context.Context,
	sessionID, userID, role string,
) (int64, error) {
	if b == nil || b.client == nil {
		return 0, nil
	}
	key := presencePrefix + sessionID
	member := role + ":" + userID
	now := time.Now().UTC()
	pipe := b.client.TxPipeline()
	pipe.ZRem(ctx, key, member)
	pipe.ZRemRangeByScore(ctx, key, "-inf", strconv.FormatInt(now.UnixMilli(), 10))
	countCmd := pipe.ZCard(ctx, key)
	if _, err := pipe.Exec(ctx); err != nil {
		return 0, err
	}
	return countCmd.Val(), nil
}

func (b *Bus) PresenceCount(ctx context.Context, sessionID string) (int64, error) {
	if b == nil || b.client == nil {
		return 0, nil
	}
	key := presencePrefix + sessionID
	now := time.Now().UTC()
	pipe := b.client.TxPipeline()
	pipe.ZRemRangeByScore(ctx, key, "-inf", strconv.FormatInt(now.UnixMilli(), 10))
	countCmd := pipe.ZCard(ctx, key)
	if _, err := pipe.Exec(ctx); err != nil {
		return 0, err
	}
	return countCmd.Val(), nil
}
